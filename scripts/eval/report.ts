// Report generator. Reads a .scored.jsonl and writes a markdown comparison
// table next to it: <basename>.md.
//
// Usage:
//   tsx scripts/eval/report.ts                      # most-recent scored run
//   tsx scripts/eval/report.ts <path/to/scored>     # explicit input

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function mostRecentScored(): string {
  const resultsDir = resolve(__dirname, 'results');
  const files = readdirSync(resultsDir)
    .filter((f) => f.endsWith('.scored.jsonl'))
    .map((f) => resolve(resultsDir, f));
  if (files.length === 0) throw new Error('No .scored.jsonl files in scripts/eval/results/.');
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

type ScoredRow = {
  variantId: string;
  variantLabel: string;
  topicId: string;
  topicBucket: string;
  topic: string;
  totals: { inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number };
  breakdownScore: any;
  insightScore: any;
  judgeUsage: { inputTokens: number; outputTokens: number; costUsd: number | null };
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function summarizeVariant(rows: ScoredRow[]) {
  const inTokens = rows.map((r) => r.totals.inputTokens);
  const outTokens = rows.map((r) => r.totals.outputTokens);
  const costs = rows.map((r) => r.totals.costUsd ?? 0);
  const latencies = rows.map((r) => r.totals.latencyMs);

  const breakdownScored = rows.filter((r) => !('error' in (r.breakdownScore ?? {})));
  const insightScored = rows.filter((r) => !('error' in (r.insightScore ?? {})));

  const breakdownOverall = mean(breakdownScored.map((r) => r.breakdownScore.overall_quality ?? 0));
  const breakdownCoverage = mean(breakdownScored.map((r) => r.breakdownScore.coverage_score ?? 0));
  const breakdownSpecificity = mean(breakdownScored.map((r) => r.breakdownScore.specificity_score ?? 0));
  const breakdownTerse = mean(breakdownScored.map((r) => r.breakdownScore.labels_terse_pct ?? 0));
  const breakdownFiller = breakdownScored.filter((r) => r.breakdownScore.has_filler_terms).length;
  const breakdownFullFill = breakdownScored.filter((r) => r.breakdownScore.fully_filled).length;

  const insightOverall = mean(insightScored.map((r) => r.insightScore.overall_quality ?? 0));
  const insightFieldPrimacy = mean(insightScored.map((r) => r.insightScore.field_primacy_score ?? 0));
  const insightCurrency = mean(insightScored.map((r) => r.insightScore.currency_score ?? 0));
  const insightDoorway = mean(insightScored.map((r) => r.insightScore.doorway_score ?? 0));
  const insightDiversity = mean(insightScored.map((r) => r.insightScore.diversity_score ?? 0));
  const insightVoice = mean(insightScored.map((r) => r.insightScore.framing_voice_score ?? 0));
  const insightTerse = mean(insightScored.map((r) => r.insightScore.actions_terse_pct ?? 0));
  const totalScopeViolations = insightScored.reduce((s, r) => s + (r.insightScore.scope_violations ?? 0), 0);
  const totalMoves = insightScored.length * 3;
  const structureOk = insightScored.filter((r) => r.insightScore.structure_ok).length;

  return {
    variantId: rows[0].variantId,
    variantLabel: rows[0].variantLabel,
    count: rows.length,
    avgInTokens: mean(inTokens),
    avgOutTokens: mean(outTokens),
    avgCostUsd: mean(costs),
    totalCostUsd: costs.reduce((s, c) => s + c, 0),
    avgLatencyMs: mean(latencies),
    breakdownOverall,
    breakdownCoverage,
    breakdownSpecificity,
    breakdownTerse,
    breakdownFillerCount: breakdownFiller,
    breakdownFullFillCount: breakdownFullFill,
    insightOverall,
    insightFieldPrimacy,
    insightCurrency,
    insightDoorway,
    insightDiversity,
    insightVoice,
    insightTerse,
    scopeOkPct: totalMoves === 0 ? 0 : 100 * (1 - totalScopeViolations / totalMoves),
    structureOkCount: structureOk,
  };
}

function main() {
  const arg = process.argv[2];
  const inputPath = arg ?? mostRecentScored();
  console.log(`[report] input: ${inputPath}`);

  const lines = readFileSync(inputPath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const rows: ScoredRow[] = lines.map((l) => JSON.parse(l));

  // Group by variant.
  const byVariant = new Map<string, ScoredRow[]>();
  for (const row of rows) {
    if (!byVariant.has(row.variantId)) byVariant.set(row.variantId, []);
    byVariant.get(row.variantId)!.push(row);
  }
  const summaries = [...byVariant.values()].map(summarizeVariant);
  // Sort by variant id for stable output.
  summaries.sort((a, b) => a.variantId.localeCompare(b.variantId));

  // Build markdown.
  const md: string[] = [];
  md.push(`# Eval report\n`);
  md.push(`Input: \`${inputPath}\`  `);
  md.push(`Records: ${rows.length}  `);
  md.push(`Variants: ${summaries.length}  `);
  md.push(`Topics per variant: ${summaries[0]?.count ?? 0}\n`);

  md.push(`## Cost & latency per click (breakdown + full insight pipeline)\n`);
  md.push(`| Variant | Label | Avg in-tokens | Avg out-tokens | Avg \\$/click | Total \\$ | Avg latency |`);
  md.push(`|---|---|---:|---:|---:|---:|---:|`);
  for (const s of summaries) {
    md.push(
      `| ${s.variantId} | ${s.variantLabel} | ${fmt(s.avgInTokens, 0)} | ${fmt(s.avgOutTokens, 0)} | $${fmt(s.avgCostUsd, 4)} | $${fmt(s.totalCostUsd, 2)} | ${(s.avgLatencyMs / 1000).toFixed(1)}s |`,
    );
  }

  md.push(`\n## Breakdown quality (judge: Opus 4.7, scale 0–5)\n`);
  md.push(`| Variant | Label | Overall | Coverage | Specificity | Terse-label % | Filler hits | Fully-filled |`);
  md.push(`|---|---|---:|---:|---:|---:|---:|---:|`);
  for (const s of summaries) {
    md.push(
      `| ${s.variantId} | ${s.variantLabel} | ${fmt(s.breakdownOverall)} | ${fmt(s.breakdownCoverage)} | ${fmt(s.breakdownSpecificity)} | ${fmt(s.breakdownTerse, 0)}% | ${s.breakdownFillerCount}/${s.count} | ${s.breakdownFullFillCount}/${s.count} |`,
    );
  }

  md.push(`\n## Insight quality (judge: Opus 4.7, scale 0–5)\n`);
  md.push(`| Variant | Label | Overall | Scope-OK | Field-primacy | Currency | Doorway | Diversity | Voice | Actions terse | Structure-OK |`);
  md.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const s of summaries) {
    md.push(
      `| ${s.variantId} | ${s.variantLabel} | ${fmt(s.insightOverall)} | ${fmt(s.scopeOkPct, 0)}% | ${fmt(s.insightFieldPrimacy)} | ${fmt(s.insightCurrency)} | ${fmt(s.insightDoorway)} | ${fmt(s.insightDiversity)} | ${fmt(s.insightVoice)} | ${fmt(s.insightTerse, 0)}% | ${s.structureOkCount}/${s.count} |`,
    );
  }

  // Per-topic disagreement: where do variants disagree most on Insight overall quality?
  md.push(`\n## Per-topic Insight overall scores (where do variants disagree?)\n`);
  const topicIds = [...new Set(rows.map((r) => r.topicId))];
  const variantIds = summaries.map((s) => s.variantId);
  md.push(`| Topic | ${variantIds.join(' | ')} | Range |`);
  md.push(`|---${variantIds.map(() => '|---:').join('')}|---:|`);
  type TopicRow = { topicId: string; scores: Record<string, number>; range: number };
  const topicRows: TopicRow[] = [];
  for (const topicId of topicIds) {
    const scores: Record<string, number> = {};
    for (const vid of variantIds) {
      const row = rows.find((r) => r.variantId === vid && r.topicId === topicId);
      const sc = row && !('error' in (row.insightScore ?? {}))
        ? (row.insightScore.overall_quality ?? 0)
        : null;
      scores[vid] = sc ?? -1;
    }
    const valid = Object.values(scores).filter((s) => s >= 0);
    const range = valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : 0;
    topicRows.push({ topicId, scores, range });
  }
  topicRows.sort((a, b) => b.range - a.range);
  for (const tr of topicRows) {
    md.push(
      `| ${tr.topicId} | ${variantIds.map((v) => (tr.scores[v] >= 0 ? fmt(tr.scores[v]) : '–')).join(' | ')} | ${fmt(tr.range)} |`,
    );
  }

  md.push(`\n## Notable judge notes (per variant)\n`);
  for (const s of summaries) {
    md.push(`### ${s.variantId} — ${s.variantLabel}`);
    const variantRows = rows.filter((r) => r.variantId === s.variantId);
    for (const r of variantRows) {
      const breakNote = !('error' in (r.breakdownScore ?? {})) ? r.breakdownScore.notes : '(error)';
      const insightNote = !('error' in (r.insightScore ?? {})) ? r.insightScore.notes : '(error)';
      md.push(`- **${r.topicId}** · breakdown: ${breakNote} · insight: ${insightNote}`);
    }
    md.push('');
  }

  const outputPath = inputPath.replace(/\.scored\.jsonl$/, '.md');
  writeFileSync(outputPath, md.join('\n'));
  console.log(`[report] Output: ${outputPath}`);

  // Also echo the headline tables to stdout so a CLI run shows the summary.
  console.log('\n' + md.slice(0, md.findIndex((l) => l.startsWith('## Per-topic'))).join('\n'));
}

main();
