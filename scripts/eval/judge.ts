// Judge stage. Reads scripts/eval/results/<run-id>.jsonl and writes a
// .scored.jsonl alongside.
//
// Two-tier scoring:
//   1. Local mechanical checks (localChecks.ts) — free, instant, exact.
//      JSON validity, structural counts, label terseness, filler words,
//      duplicates, AI-tell vocabulary, em-dash drama, hedges, action word
//      counts, imperative voice heuristic.
//   2. LLM judgment on Opus 4.7 — the items that need world knowledge:
//      scope match, field primacy, currency, coverage, doorway, diversity,
//      holistic voice, overall quality.
//
// Usage:
//   tsx scripts/eval/judge.ts                          # most-recent run
//   tsx scripts/eval/judge.ts <path/to/run.jsonl>      # explicit input
//   tsx scripts/eval/judge.ts --dry-run                # print prompts only, no LLM calls
//   tsx scripts/eval/judge.ts --local-only             # local checks only, NO LLM calls (free!)

import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAnthropic, type Usage } from './anthropic';
import { buildBreakdownJudgePrompt, buildInsightJudgePrompt } from './judgePrompt';
import {
  checkBreakdownLocal,
  checkInsightLocal,
  type BreakdownLocalScore,
  type InsightLocalScore,
} from './localChecks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JUDGE_MODEL = 'claude-opus-4-7';
const CONCURRENCY = 4;

type CliArgs = { input: string | null; dryRun: boolean; localOnly: boolean };

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { input: null, dryRun: false, localOnly: false };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--local-only') args.localOnly = true;
    else if (!a.startsWith('--')) args.input = a;
  }
  return args;
}

function mostRecentRun(): string {
  const resultsDir = resolve(__dirname, 'results');
  const files = readdirSync(resultsDir)
    .filter((f) => f.endsWith('.jsonl') && !f.endsWith('.scored.jsonl'))
    .map((f) => resolve(resultsDir, f));
  if (files.length === 0) throw new Error('No run JSONL files in scripts/eval/results/.');
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

// LLM-side score (only the subjective items live here now).
type BreakdownLlmScore = {
  coverage_score: number;
  specificity_score: number;
  overall_quality: number;
  notes: string;
};

type InsightLlmScore = {
  scope_violations: number;
  field_primacy_score: number;
  currency_score: number;
  doorway_score: number;
  diversity_score: number;
  framing_voice_holistic: number;
  overall_quality: number;
  notes: string;
};

// Combined record: local + LLM merged into the same shape downstream
// (report.ts and reportHtml.ts) consumed before the split. We additionally
// surface the local-only fields so the HTML report can show them.
type BreakdownScoreOut = BreakdownLocalScore & Partial<BreakdownLlmScore> & { llm_error?: string };
type InsightScoreOut = InsightLocalScore & Partial<InsightLlmScore> & {
  llm_error?: string;
  // Back-compat aliases for report/reportHtml that reference these fields
  // by their old names.
  framing_voice_score?: number;
};

type ScoredRecord = {
  variantId: string;
  variantLabel: string;
  topicId: string;
  topicBucket: string;
  topic: string;
  clickTerm: string;
  totals: { inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number };
  breakdownScore: BreakdownScoreOut;
  insightScore: InsightScoreOut;
  judgeUsage: Usage;
};

function extractLastJson(raw: string): string {
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

const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ?? mostRecentRun();
  console.log(`[judge] input: ${inputPath}`);
  if (args.localOnly) console.log(`[judge] --local-only: skipping LLM calls (free pass)`);

  const lines = readFileSync(inputPath, 'utf8').split('\n').filter((l) => l.trim().length > 0);

  if (args.dryRun) {
    const first = JSON.parse(lines[0]);
    const breakdownLocal = checkBreakdownLocal(first.breakdown.raw || '');
    const insightLocal = checkInsightLocal(first.insight.finalInsight ?? first.insight.generation.raw ?? null);
    const breakdownPrompt = buildBreakdownJudgePrompt({
      topic: first.topic,
      breakdownJson: first.breakdown.raw || '(empty)',
    });
    const insightPrompt = buildInsightJudgePrompt({
      topic: first.topic,
      insightJson: JSON.stringify(first.insight.finalInsight ?? { error: 'empty' }, null, 2),
    });
    console.log('\n========== LOCAL BREAKDOWN CHECKS (sample) ==========\n');
    console.log(JSON.stringify(breakdownLocal, null, 2));
    console.log('\n========== LOCAL INSIGHT CHECKS (sample) ==========\n');
    console.log(JSON.stringify(insightLocal, null, 2));
    console.log('\n========== LLM BREAKDOWN JUDGE PROMPT ==========\n');
    console.log(breakdownPrompt);
    console.log('\n========== LLM INSIGHT JUDGE PROMPT ==========\n');
    console.log(insightPrompt);
    console.log(`\n[judge] dry-run only. Would judge ${lines.length} records on ${JUDGE_MODEL}.`);
    return;
  }

  const outputPath = inputPath.replace(/\.jsonl$/, '.scored.jsonl');
  writeFileSync(outputPath, ''); // truncate

  let done = 0;
  let totalCostUsd = 0;

  await parallelMap(lines, CONCURRENCY, async (line) => {
    const rec = JSON.parse(line);

    // ----- LOCAL CHECKS (free, instant) -----
    const breakdownLocal = checkBreakdownLocal(rec.breakdown.raw || '');
    const insightLocal = checkInsightLocal(rec.insight.finalInsight ?? rec.insight.generation.raw ?? null);

    // ----- LLM CHECKS (only if not --local-only) -----
    let breakdownLlm: BreakdownLlmScore | { error: string } | null = null;
    let insightLlm: InsightLlmScore | { error: string } | null = null;
    const usages: Usage[] = [];

    if (!args.localOnly) {
      const breakdownPrompt = buildBreakdownJudgePrompt({
        topic: rec.topic,
        breakdownJson: rec.breakdown.raw || '(empty output)',
      });
      const insightPrompt = buildInsightJudgePrompt({
        topic: rec.topic,
        insightJson: rec.insight.finalInsight
          ? JSON.stringify(rec.insight.finalInsight, null, 2)
          : rec.insight.generation.raw || '(empty output)',
      });
      try {
        const r = await callAnthropic({ model: JUDGE_MODEL, prompt: breakdownPrompt, maxTokens: 500 });
        usages.push(r.usage);
        breakdownLlm = JSON.parse(extractLastJson(r.text)) as BreakdownLlmScore;
      } catch (e) {
        breakdownLlm = { error: e instanceof Error ? e.message : String(e) };
      }
      try {
        const r = await callAnthropic({ model: JUDGE_MODEL, prompt: insightPrompt, maxTokens: 600 });
        usages.push(r.usage);
        insightLlm = JSON.parse(extractLastJson(r.text)) as InsightLlmScore;
      } catch (e) {
        insightLlm = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    // ----- MERGE -----
    const breakdownScore: BreakdownScoreOut = breakdownLlm && !('error' in breakdownLlm)
      ? { ...breakdownLocal, ...breakdownLlm }
      : { ...breakdownLocal, ...(breakdownLlm && 'error' in breakdownLlm ? { llm_error: breakdownLlm.error } : {}) };

    const insightScore: InsightScoreOut = insightLlm && !('error' in insightLlm)
      ? {
          ...insightLocal,
          ...insightLlm,
          // Back-compat alias: report/reportHtml read `framing_voice_score`.
          framing_voice_score: insightLlm.framing_voice_holistic,
        }
      : { ...insightLocal, ...(insightLlm && 'error' in insightLlm ? { llm_error: insightLlm.error } : {}) };

    const judgeUsage: Usage = usages.length === 0
      ? ZERO_USAGE
      : {
          inputTokens: usages.reduce((s, u) => s + u.inputTokens, 0),
          outputTokens: usages.reduce((s, u) => s + u.outputTokens, 0),
          costUsd: usages.reduce<number | null>((s, u) => {
            if (s === null || u.costUsd === null) return null;
            return s + u.costUsd;
          }, 0),
        };

    const scored: ScoredRecord = {
      variantId: rec.variantId,
      variantLabel: rec.variantLabel,
      topicId: rec.topicId,
      topicBucket: rec.topicBucket,
      topic: rec.topic,
      clickTerm: rec.clickTerm,
      totals: rec.totals,
      breakdownScore,
      insightScore,
      judgeUsage,
    };
    appendFileSync(outputPath, JSON.stringify(scored) + '\n');

    done++;
    totalCostUsd += judgeUsage.costUsd ?? 0;
    console.log(
      `[${done}/${lines.length}] ${rec.variantId} · ${rec.topicId} · ` +
        `judge $${(judgeUsage.costUsd ?? 0).toFixed(4)} (running $${totalCostUsd.toFixed(2)})`,
    );
  });

  console.log(`\n[judge] DONE. Judge cost: $${totalCostUsd.toFixed(2)}`);
  console.log(`[judge] Output: ${outputPath}`);
  console.log(`[judge] Next: tsx scripts/eval/report.ts ${outputPath}`);
}

main().catch((e) => {
  console.error('[judge] FATAL', e);
  process.exit(1);
});
