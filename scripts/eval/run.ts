// Eval runner. Executes (variant × topic) combinations and writes one JSONL
// line per topic per variant to scripts/eval/results/<run-id>.jsonl.
//
// Usage:
//   tsx scripts/eval/run.ts                              # all variants × all topics
//   tsx scripts/eval/run.ts --topics 2                   # first 2 topics, all variants
//   tsx scripts/eval/run.ts --variants V0,V2             # all topics, two variants
//   tsx scripts/eval/run.ts --topics 2 --variants V0,V2  # smoke test
//   tsx scripts/eval/run.ts --concurrency 4              # parallelism cap (default 4)
//
// Each result line carries:
//   - variant id + label, topic id + label
//   - breakdown: raw text, parse status, per-call usage + latency
//   - insight: classifier usage, generation usage, critique usage (if fired),
//     parsed insight, parse status, totals
//   - aggregated: totalInputTokens, totalOutputTokens, totalCostUsd, totalLatencyMs

import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS, type Topic } from './topics';
import { VARIANTS, variantById, type Variant } from './variants';
import { callAnthropic, sumUsage, type Usage } from './anthropic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliArgs = {
  topicsLimit: number | null;
  variantIds: string[] | null;
  concurrency: number;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { topicsLimit: null, variantIds: null, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--topics') args.topicsLimit = parseInt(argv[++i], 10);
    else if (a === '--variants') args.variantIds = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
  }
  return args;
}

type CallRecord = {
  stage: string;
  model: string;
  promptCharCount: number;
  usage: Usage;
  latencyMs: number;
};

type BreakdownResult = {
  raw: string;
  parsed: { mains: string[]; subs: string[][] } | null;
  parseError: string | null;
  call: CallRecord;
};

type InsightResult = {
  classifier: { raw: string; parsed: ScopeTraps; call: CallRecord } | null;
  generation: { raw: string; parsed: Insight | null; parseError: string | null; call: CallRecord };
  critiqueFired: boolean;
  critique: { raw: string; parsed: Insight | null; parseError: string | null; call: CallRecord } | null;
  finalInsight: Insight | null;
};

type ScopeTraps = { subDisciplines: string[]; adjacentDisciplines: string[] };
// Import canonical types from the production module to stay aligned with
// the prompt builders' expectations (critique builder requires ResourceKind).
import type { Insight, InsightMove, ResourceKind } from '../../src/lib/insightApi';

// ---------- parsers (mirror src/lib/insightApi.ts) ----------

function extractLastJsonObject(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  const lastClose = cleaned.lastIndexOf('}');
  if (lastClose < 0) return cleaned;
  let depth = 0;
  for (let i = lastClose; i >= 0; i--) {
    const ch = cleaned[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      depth--;
      if (depth === 0) return cleaned.slice(i, lastClose + 1);
    }
  }
  return cleaned;
}

function parseBreakdownRaw(raw: string): { mains: string[]; subs: string[][] } {
  const cleaned = extractLastJsonObject(raw);
  const parsed = JSON.parse(cleaned) as { mains?: unknown; subs?: unknown };
  const mains = Array.isArray(parsed.mains) ? (parsed.mains as unknown[]).map((x) => String(x ?? '')) : [];
  const subs: string[][] = Array.isArray(parsed.subs)
    ? (parsed.subs as unknown[]).map((row) =>
        Array.isArray(row) ? (row as unknown[]).map((x) => String(x ?? '')) : [],
      )
    : [];
  return { mains, subs };
}

const VALID_KINDS = new Set(['book', 'course', 'person', 'community', 'site']);

function parseInsightRaw(raw: string): Insight {
  const cleaned = extractLastJsonObject(raw);
  const parsed = JSON.parse(cleaned) as { framing?: unknown; moves?: unknown };
  const framing = typeof parsed.framing === 'string' ? parsed.framing.trim() : '';
  const moves: InsightMove[] = Array.isArray(parsed.moves)
    ? (parsed.moves as unknown[])
        .map((m): InsightMove | null => {
          if (!m || typeof m !== 'object') return null;
          const obj = m as { kind?: unknown; title?: unknown; action?: unknown; url?: unknown };
          const title = typeof obj.title === 'string' ? obj.title.trim() : '';
          const action = typeof obj.action === 'string' ? obj.action.trim() : '';
          const kindRaw = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
          const kind = (VALID_KINDS.has(kindRaw) ? kindRaw : 'site') as ResourceKind;
          const urlRaw = typeof obj.url === 'string' ? obj.url.trim() : '';
          if (!title || !action) return null;
          const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : undefined;
          return { kind, title, action, ...(url ? { url } : {}) };
        })
        .filter((m): m is InsightMove => m !== null)
    : [];
  return { framing, moves };
}

function parseScopeTrapsRaw(raw: string): ScopeTraps {
  const cleaned = extractLastJsonObject(raw);
  const parsed = JSON.parse(cleaned) as { sub_disciplines?: unknown; adjacent_disciplines?: unknown };
  const toArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
      : [];
  return {
    subDisciplines: toArr(parsed.sub_disciplines),
    adjacentDisciplines: toArr(parsed.adjacent_disciplines),
  };
}

// ---------- critique-trigger heuristic (mirrors src/lib/insightApi.ts) ----------

const STOPWORDS = new Set(['design', 'art', 'work', 'studio']);

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function critiqueNeeded(traps: ScopeTraps, insight: Insight, term: string): boolean {
  const allTraps = [...traps.subDisciplines, ...traps.adjacentDisciplines];
  if (allTraps.length === 0) return false;
  const topicWords = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  const trapWordOverlapsTopic = (trapWord: string): boolean =>
    topicWords.some((tw) => commonPrefixLength(trapWord, tw) >= 3);
  for (const move of insight.moves) {
    const titleWords = move.title.toLowerCase().match(/[a-z]+/g) ?? [];
    for (const trap of allTraps) {
      const trapWords = trap
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => !STOPWORDS.has(w) && w.length >= 4 && !trapWordOverlapsTopic(w));
      for (const trapWord of trapWords) {
        for (const titleWord of titleWords) {
          if (titleWord.length >= 4 && commonPrefixLength(titleWord, trapWord) >= 3) return true;
        }
      }
    }
  }
  return false;
}

// ---------- stage runners ----------

async function runBreakdown(variant: Variant, topic: Topic): Promise<BreakdownResult> {
  const prompt = variant.breakdownPromptBuilder({ topic: topic.topic, path: [topic.topic] });
  const res = await callAnthropic({ model: variant.breakdownModel, prompt });
  const call: CallRecord = {
    stage: 'breakdown',
    model: variant.breakdownModel,
    promptCharCount: prompt.length,
    usage: res.usage,
    latencyMs: res.latencyMs,
  };
  try {
    const parsed = parseBreakdownRaw(res.text);
    return { raw: res.text, parsed, parseError: null, call };
  } catch (e) {
    return {
      raw: res.text,
      parsed: null,
      parseError: e instanceof Error ? e.message : String(e),
      call,
    };
  }
}

async function runInsight(variant: Variant, topic: Topic): Promise<InsightResult> {
  const path = [topic.topic];
  const term = topic.clickTerm;
  const empty: ScopeTraps = { subDisciplines: [], adjacentDisciplines: [] };

  if (variant.pipeline === 'parallel-then-critique') {
    // Stages 1+2 in parallel; generation runs with empty traps.
    const classifierPrompt = variant.classifierPromptBuilder({ term });
    const generationPrompt = variant.generationPromptBuilder({
      path,
      term,
      subDisciplines: empty.subDisciplines,
      adjacentDisciplines: empty.adjacentDisciplines,
    });

    const [classRes, genRes] = await Promise.all([
      callAnthropic({ model: variant.classifierModel, prompt: classifierPrompt }),
      callAnthropic({ model: variant.generationModel, prompt: generationPrompt }),
    ]);

    const classifierCall: CallRecord = {
      stage: 'classifier',
      model: variant.classifierModel,
      promptCharCount: classifierPrompt.length,
      usage: classRes.usage,
      latencyMs: classRes.latencyMs,
    };
    let traps: ScopeTraps = empty;
    try {
      traps = parseScopeTrapsRaw(classRes.text);
    } catch {
      // degrade silently — same as prod
    }

    const generationCall: CallRecord = {
      stage: 'generation',
      model: variant.generationModel,
      promptCharCount: generationPrompt.length,
      usage: genRes.usage,
      latencyMs: genRes.latencyMs,
    };
    let initial: Insight | null = null;
    let genParseError: string | null = null;
    try {
      initial = parseInsightRaw(genRes.text);
    } catch (e) {
      genParseError = e instanceof Error ? e.message : String(e);
    }

    const out: InsightResult = {
      classifier: { raw: classRes.text, parsed: traps, call: classifierCall },
      generation: { raw: genRes.text, parsed: initial, parseError: genParseError, call: generationCall },
      critiqueFired: false,
      critique: null,
      finalInsight: initial,
    };

    if (initial && critiqueNeeded(traps, initial, term)) {
      const critiquePrompt = variant.critiquePromptBuilder({
        term,
        subDisciplines: traps.subDisciplines,
        adjacentDisciplines: traps.adjacentDisciplines,
        candidate: initial,
      });
      const critRes = await callAnthropic({ model: variant.critiqueModel, prompt: critiquePrompt });
      const critCall: CallRecord = {
        stage: 'critique',
        model: variant.critiqueModel,
        promptCharCount: critiquePrompt.length,
        usage: critRes.usage,
        latencyMs: critRes.latencyMs,
      };
      let corrected: Insight | null = null;
      let critParseError: string | null = null;
      try {
        const c = parseInsightRaw(critRes.text);
        if (c.moves.length > 0) corrected = c;
      } catch (e) {
        critParseError = e instanceof Error ? e.message : String(e);
      }
      out.critiqueFired = true;
      out.critique = { raw: critRes.text, parsed: corrected, parseError: critParseError, call: critCall };
      out.finalInsight = corrected ?? initial;
    }

    return out;
  }

  // sequential-no-critique: run classifier, then generation with traps embedded.
  const classifierPrompt = variant.classifierPromptBuilder({ term });
  const classRes = await callAnthropic({ model: variant.classifierModel, prompt: classifierPrompt });
  const classifierCall: CallRecord = {
    stage: 'classifier',
    model: variant.classifierModel,
    promptCharCount: classifierPrompt.length,
    usage: classRes.usage,
    latencyMs: classRes.latencyMs,
  };
  let traps: ScopeTraps = empty;
  try {
    traps = parseScopeTrapsRaw(classRes.text);
  } catch {
    // degrade silently
  }

  const generationPrompt = variant.generationPromptBuilder({
    path,
    term,
    subDisciplines: traps.subDisciplines,
    adjacentDisciplines: traps.adjacentDisciplines,
  });
  const genRes = await callAnthropic({ model: variant.generationModel, prompt: generationPrompt });
  const generationCall: CallRecord = {
    stage: 'generation',
    model: variant.generationModel,
    promptCharCount: generationPrompt.length,
    usage: genRes.usage,
    latencyMs: genRes.latencyMs,
  };
  let finalInsight: Insight | null = null;
  let genParseError: string | null = null;
  try {
    finalInsight = parseInsightRaw(genRes.text);
  } catch (e) {
    genParseError = e instanceof Error ? e.message : String(e);
  }

  return {
    classifier: { raw: classRes.text, parsed: traps, call: classifierCall },
    generation: { raw: genRes.text, parsed: finalInsight, parseError: genParseError, call: generationCall },
    critiqueFired: false,
    critique: null,
    finalInsight,
  };
}

// ---------- per-(variant, topic) record ----------

export type RunRecord = {
  runId: string;
  variantId: string;
  variantLabel: string;
  topicId: string;
  topicBucket: Topic['bucket'];
  topic: string;
  clickTerm: string;
  breakdown: BreakdownResult;
  insight: InsightResult;
  totals: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    latencyMs: number;
  };
  error: string | null;
};

function totalUsage(breakdown: BreakdownResult, insight: InsightResult): Usage {
  const usages: Usage[] = [breakdown.call.usage, insight.generation.call.usage];
  if (insight.classifier) usages.push(insight.classifier.call.usage);
  if (insight.critique) usages.push(insight.critique.call.usage);
  return sumUsage(usages);
}

function totalLatency(breakdown: BreakdownResult, insight: InsightResult): number {
  // Sum the longest path: breakdown is independent of insight. For insight,
  // sequential adds classifier + generation; parallel takes max of those.
  let insightLatency: number;
  const classMs = insight.classifier?.call.latencyMs ?? 0;
  const genMs = insight.generation.call.latencyMs;
  const critMs = insight.critique?.call.latencyMs ?? 0;
  // We don't know the exact pipeline shape here, but for reporting we
  // approximate parallel = max, sequential = sum. Critique always adds.
  insightLatency = insight.critique
    ? Math.max(classMs, genMs) + critMs
    : critMs + Math.max(classMs, genMs);
  // (Sequential case overstates slightly; that's fine for headline reporting.)
  return breakdown.call.latencyMs + insightLatency;
}

async function runOne(runId: string, variant: Variant, topic: Topic): Promise<RunRecord> {
  try {
    const [breakdown, insight] = await Promise.all([runBreakdown(variant, topic), runInsight(variant, topic)]);
    const totals = totalUsage(breakdown, insight);
    return {
      runId,
      variantId: variant.id,
      variantLabel: variant.label,
      topicId: topic.id,
      topicBucket: topic.bucket,
      topic: topic.topic,
      clickTerm: topic.clickTerm,
      breakdown,
      insight,
      totals: {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        costUsd: totals.costUsd,
        latencyMs: totalLatency(breakdown, insight),
      },
      error: null,
    };
  } catch (e) {
    return {
      runId,
      variantId: variant.id,
      variantLabel: variant.label,
      topicId: topic.id,
      topicBucket: topic.bucket,
      topic: topic.topic,
      clickTerm: topic.clickTerm,
      breakdown: { raw: '', parsed: null, parseError: null, call: emptyCall('breakdown', variant.breakdownModel) },
      insight: {
        classifier: null,
        generation: { raw: '', parsed: null, parseError: null, call: emptyCall('generation', variant.generationModel) },
        critiqueFired: false,
        critique: null,
        finalInsight: null,
      },
      totals: { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function emptyCall(stage: string, model: string): CallRecord {
  return {
    stage,
    model,
    promptCharCount: 0,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    latencyMs: 0,
  };
}

// Simple concurrency-capped runner. Each task is async; we keep at most
// `concurrency` in flight at once.
async function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const topics = args.topicsLimit ? TOPICS.slice(0, args.topicsLimit) : TOPICS;
  const variants = args.variantIds
    ? (args.variantIds.map(variantById).filter((v): v is Variant => v !== undefined))
    : VARIANTS;

  if (variants.length === 0) {
    console.error('No matching variants. Provided:', args.variantIds);
    process.exit(1);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = resolve(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const outputPath = resolve(resultsDir, `${runId}.jsonl`);
  writeFileSync(outputPath, ''); // truncate

  const tasks: Array<{ variant: Variant; topic: Topic }> = [];
  for (const variant of variants) {
    for (const topic of topics) {
      tasks.push({ variant, topic });
    }
  }

  console.log(`[eval] run=${runId}`);
  console.log(`[eval] ${tasks.length} tasks (${variants.length} variants × ${topics.length} topics), concurrency=${args.concurrency}`);
  console.log(`[eval] output: ${outputPath}\n`);

  let done = 0;
  let totalCostUsd = 0;
  await parallelMap(tasks, args.concurrency, async ({ variant, topic }) => {
    const rec = await runOne(runId, variant, topic);
    appendFileSync(outputPath, JSON.stringify(rec) + '\n');
    done++;
    const cost = rec.totals.costUsd ?? 0;
    totalCostUsd += cost;
    const status = rec.error
      ? 'ERROR'
      : rec.breakdown.parsed && rec.insight.finalInsight
      ? 'ok'
      : 'partial';
    console.log(
      `[${done}/${tasks.length}] ${variant.id} · ${topic.id} · ${status} · ` +
        `in=${rec.totals.inputTokens} out=${rec.totals.outputTokens} ` +
        `$${cost.toFixed(4)} (running $${totalCostUsd.toFixed(2)})` +
        (rec.error ? ` · err: ${rec.error.slice(0, 80)}` : ''),
    );
    return rec;
  });

  console.log(`\n[eval] DONE. Total cost: $${totalCostUsd.toFixed(2)}`);
  console.log(`[eval] Output: ${outputPath}`);
  console.log(`[eval] Next: tsx scripts/eval/judge.ts ${outputPath}`);
}

main().catch((e) => {
  console.error('[eval] FATAL', e);
  process.exit(1);
});
