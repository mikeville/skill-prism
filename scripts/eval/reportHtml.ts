// HTML report generator. Reads a .scored.jsonl and writes a single,
// self-contained .html file next to it. No external deps, no CDN — inline
// CSS + a few lines of vanilla JS for sort/expand.
//
// Usage:
//   tsx scripts/eval/reportHtml.ts                      # most-recent scored run
//   tsx scripts/eval/reportHtml.ts <path/to/scored>     # explicit input

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

// ----- types (mirror the scored JSONL shape from judge.ts) -----

type Move = { kind: string; title: string; action: string; url?: string };
type Insight = { framing: string; moves: Move[] };

type BreakdownScore = {
  json_valid?: boolean;
  fully_filled?: boolean;
  labels_terse_pct?: number;
  has_filler_terms?: boolean;
  has_duplicates?: boolean;
  coverage_score?: number;
  specificity_score?: number;
  overall_quality?: number;
  notes?: string;
};

type InsightScore = {
  json_valid?: boolean;
  structure_ok?: boolean;
  scope_violations?: number;
  field_primacy_score?: number;
  currency_score?: number;
  doorway_score?: number;
  diversity_score?: number;
  framing_voice_score?: number;
  actions_terse_pct?: number;
  overall_quality?: number;
  notes?: string;
};

// The .scored.jsonl was written by judge.ts but only carries the parsed
// final insight and the raw breakdown text — we don't have the breakdown's
// parsed mains/subs there. To show the breakdown grids in the HTML, we
// re-parse the raw text on the fly from the matching .jsonl (same path,
// without `.scored`).
type ScoredRow = {
  variantId: string;
  variantLabel: string;
  topicId: string;
  topicBucket: string;
  topic: string;
  clickTerm: string;
  totals: { inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number };
  breakdownScore: BreakdownScore | { error: string };
  insightScore: InsightScore | { error: string };
  judgeUsage: { inputTokens: number; outputTokens: number; costUsd: number | null };
};

type RawRow = {
  variantId: string;
  topicId: string;
  breakdown: { raw: string; parsed: { mains: string[]; subs: string[][] } | null };
  insight: {
    critiqueFired: boolean;
    classifier: { parsed: { subDisciplines: string[]; adjacentDisciplines: string[] } } | null;
    finalInsight: Insight | null;
    generation: { raw: string };
  };
};

// ----- helpers -----

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

const fmt = (n: number, d = 1): string => n.toFixed(d);

// Map a 0–5 score to a CSS color (red → amber → green).
function scoreColor(score: number): string {
  if (score < 0) return '#999';
  const t = Math.max(0, Math.min(1, score / 5));
  // hsl: 0=red, 60=yellow, 120=green
  const hue = Math.round(t * 120);
  return `hsl(${hue} 65% 45%)`;
}

function isBreakdownOk(s: ScoredRow['breakdownScore']): s is BreakdownScore {
  return !('error' in s);
}
function isInsightOk(s: ScoredRow['insightScore']): s is InsightScore {
  return !('error' in s);
}

// ----- variant summary -----

type VariantSummary = {
  variantId: string;
  variantLabel: string;
  count: number;
  avgInTokens: number;
  avgOutTokens: number;
  avgCostUsd: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  breakdownOverall: number;
  breakdownCoverage: number;
  breakdownSpecificity: number;
  breakdownTerse: number;
  insightOverall: number;
  insightFieldPrimacy: number;
  insightCurrency: number;
  insightDoorway: number;
  insightDiversity: number;
  insightVoice: number;
  insightTerse: number;
  scopeOkPct: number;
  structureOkCount: number;
};

function summarize(rows: ScoredRow[]): VariantSummary {
  const inTokens = rows.map((r) => r.totals.inputTokens);
  const outTokens = rows.map((r) => r.totals.outputTokens);
  const costs = rows.map((r) => r.totals.costUsd ?? 0);
  const latencies = rows.map((r) => r.totals.latencyMs);

  const bs = rows.map((r) => r.breakdownScore).filter(isBreakdownOk);
  const is = rows.map((r) => r.insightScore).filter(isInsightOk);

  const scopeViolations = is.reduce((s, x) => s + (x.scope_violations ?? 0), 0);
  const totalMoves = is.length * 3;

  return {
    variantId: rows[0].variantId,
    variantLabel: rows[0].variantLabel,
    count: rows.length,
    avgInTokens: mean(inTokens),
    avgOutTokens: mean(outTokens),
    avgCostUsd: mean(costs),
    totalCostUsd: costs.reduce((s, c) => s + c, 0),
    avgLatencyMs: mean(latencies),
    breakdownOverall: mean(bs.map((x) => x.overall_quality ?? 0)),
    breakdownCoverage: mean(bs.map((x) => x.coverage_score ?? 0)),
    breakdownSpecificity: mean(bs.map((x) => x.specificity_score ?? 0)),
    breakdownTerse: mean(bs.map((x) => x.labels_terse_pct ?? 0)),
    insightOverall: mean(is.map((x) => x.overall_quality ?? 0)),
    insightFieldPrimacy: mean(is.map((x) => x.field_primacy_score ?? 0)),
    insightCurrency: mean(is.map((x) => x.currency_score ?? 0)),
    insightDoorway: mean(is.map((x) => x.doorway_score ?? 0)),
    insightDiversity: mean(is.map((x) => x.diversity_score ?? 0)),
    insightVoice: mean(is.map((x) => x.framing_voice_score ?? 0)),
    insightTerse: mean(is.map((x) => x.actions_terse_pct ?? 0)),
    scopeOkPct: totalMoves === 0 ? 0 : 100 * (1 - scopeViolations / totalMoves),
    structureOkCount: is.filter((x) => x.structure_ok).length,
  };
}

// ----- HTML rendering -----

function renderBreakdownGrid(parsed: { mains: string[]; subs: string[][] } | null): string {
  if (!parsed || parsed.mains.length === 0) return '<div class="empty">(no parsed breakdown)</div>';
  return `<div class="grid">${parsed.mains
    .map(
      (m, i) =>
        `<div class="grid-main"><div class="main-label">${escapeHtml(m)}</div>` +
        `<ul>${(parsed.subs[i] ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` +
        `</div>`,
    )
    .join('')}</div>`;
}

function renderInsight(insight: Insight | null): string {
  if (!insight) return '<div class="empty">(no parsed insight)</div>';
  return `
    <div class="insight">
      <div class="framing">${escapeHtml(insight.framing || '(empty framing)')}</div>
      <ol class="moves">
        ${insight.moves
          .map(
            (m) =>
              `<li>
                <span class="kind kind-${escapeHtml(m.kind)}">${escapeHtml(m.kind)}</span>
                <span class="title">${escapeHtml(m.title)}</span>
                <div class="action">${escapeHtml(m.action)}</div>
                ${m.url ? `<a class="url" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.url)}</a>` : ''}
              </li>`,
          )
          .join('')}
      </ol>
    </div>`;
}

function renderTraps(traps: { subDisciplines: string[]; adjacentDisciplines: string[] } | null): string {
  if (!traps || (traps.subDisciplines.length === 0 && traps.adjacentDisciplines.length === 0)) {
    return '<span class="muted">(no scope traps identified)</span>';
  }
  const parts: string[] = [];
  if (traps.subDisciplines.length > 0) parts.push(`<b>sub:</b> ${traps.subDisciplines.map(escapeHtml).join(', ')}`);
  if (traps.adjacentDisciplines.length > 0) parts.push(`<b>adj:</b> ${traps.adjacentDisciplines.map(escapeHtml).join(', ')}`);
  return parts.join(' &nbsp; · &nbsp; ');
}

function scoreCell(score: number | undefined | null, max = 5): string {
  if (score === undefined || score === null) return '<td class="score">–</td>';
  return `<td class="score" style="background:${scoreColor((score / max) * 5)}33;color:${scoreColor((score / max) * 5)}"><b>${fmt(score)}</b></td>`;
}

function main() {
  const arg = process.argv[2];
  const inputPath = arg ?? mostRecentScored();
  const rawPath = inputPath.replace(/\.scored\.jsonl$/, '.jsonl');
  console.log(`[reportHtml] scored: ${inputPath}`);
  console.log(`[reportHtml] raw:    ${rawPath}`);

  const scored: ScoredRow[] = readFileSync(inputPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
  const raw: RawRow[] = readFileSync(rawPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));

  const rawByKey = new Map<string, RawRow>();
  for (const r of raw) rawByKey.set(`${r.variantId}|${r.topicId}`, r);

  // Group scored by variant.
  const byVariant = new Map<string, ScoredRow[]>();
  for (const row of scored) {
    if (!byVariant.has(row.variantId)) byVariant.set(row.variantId, []);
    byVariant.get(row.variantId)!.push(row);
  }
  const summaries = [...byVariant.values()].map(summarize);
  summaries.sort((a, b) => a.variantId.localeCompare(b.variantId));

  const variantIds = summaries.map((s) => s.variantId);
  const topicIds = [...new Set(scored.map((r) => r.topicId))];

  // Build per-topic × variant Insight overall map for the comparison grid.
  type Cell = { score: number | null; insight: Insight | null; notes: string | null };
  const cells = new Map<string, Cell>();
  for (const row of scored) {
    const key = `${row.variantId}|${row.topicId}`;
    const score = isInsightOk(row.insightScore) ? row.insightScore.overall_quality ?? null : null;
    const notes = isInsightOk(row.insightScore) ? row.insightScore.notes ?? null : null;
    const rawRec = rawByKey.get(key);
    cells.set(key, { score, insight: rawRec?.insight.finalInsight ?? null, notes });
  }

  const totalCost = scored.reduce((s, r) => s + (r.totals.costUsd ?? 0), 0);
  const totalJudgeCost = scored.reduce((s, r) => s + (r.judgeUsage.costUsd ?? 0), 0);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Skill Prism — Prompt eval report</title>
<style>
  :root {
    --bg: #fafaf7;
    --fg: #1a1a1a;
    --muted: #666;
    --border: #e3e3df;
    --card-bg: #fff;
    --accent: #2a5a8a;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  body { font-family: var(--sans); background: var(--bg); color: var(--fg); margin: 0; padding: 0; line-height: 1.5; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 32px 24px 96px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 20px; margin: 48px 0 16px; letter-spacing: -0.01em; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  h3 { font-size: 16px; margin: 24px 0 12px; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
  .meta code { font-family: var(--mono); font-size: 12px; }
  .summary-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-top: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .summary-card .stat { font-size: 13px; color: var(--muted); }
  .summary-card .stat b { display: block; font-size: 18px; color: var(--fg); margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: #f4f3ef; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  td.score { text-align: center; font-family: var(--mono); padding: 8px 4px; min-width: 48px; }
  td.num { text-align: right; font-family: var(--mono); }
  .vid { font-family: var(--mono); font-weight: 600; }
  .label { color: var(--muted); font-size: 12px; }
  .pareto-frontier { background: #effaef !important; }
  .baseline { background: #fdfbe8 !important; }

  /* Per-topic grid */
  .topic-grid { overflow-x: auto; }
  .topic-grid table { min-width: 100%; }
  .topic-grid td.topic { font-weight: 600; }

  /* Expandable per-topic detail */
  details { margin: 12px 0; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; }
  details > summary { padding: 12px 16px; cursor: pointer; user-select: none; font-weight: 600; list-style: none; display: flex; justify-content: space-between; align-items: center; }
  details > summary::-webkit-details-marker { display: none; }
  details > summary::after { content: '▸'; color: var(--muted); transition: transform 0.15s; }
  details[open] > summary::after { transform: rotate(90deg); }
  details .body { padding: 16px; border-top: 1px solid var(--border); }
  .topic-cell-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
  .variant-card { background: #fcfcfb; border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; }
  .variant-card .hdr { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .variant-card .hdr .vid { font-size: 13px; }
  .variant-card .hdr .label { font-size: 11px; }
  .variant-card .scoreline { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-bottom: 8px; }
  .variant-card .notes { font-size: 12px; color: var(--muted); font-style: italic; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); }

  /* Insight rendering */
  .insight .framing { font-style: italic; color: #444; margin-bottom: 8px; font-size: 13px; }
  .insight .moves { margin: 0; padding-left: 18px; font-size: 13px; }
  .insight .moves li { margin-bottom: 6px; }
  .kind { font-family: var(--mono); font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #ececea; color: #555; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .insight .title { font-weight: 600; }
  .insight .action { color: #555; font-size: 12px; margin-top: 2px; }
  .insight .url { font-family: var(--mono); font-size: 11px; color: var(--accent); text-decoration: none; word-break: break-all; }
  .insight .url:hover { text-decoration: underline; }

  /* Breakdown grid (Harada-style 9-cell) */
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px; }
  .grid-main { border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; background: #fff; }
  .grid-main .main-label { font-weight: 600; font-size: 12px; margin-bottom: 4px; color: var(--accent); }
  .grid-main ul { margin: 0; padding-left: 14px; color: #555; }
  .grid-main li { font-size: 11px; line-height: 1.4; }
  .traps { font-size: 11px; color: var(--muted); margin-top: 6px; padding: 6px 8px; background: #f8f7f3; border-radius: 4px; font-family: var(--mono); }
  .empty { color: var(--muted); font-style: italic; font-size: 12px; }
  .muted { color: var(--muted); font-size: 12px; }

  .legend { display: flex; gap: 12px; font-size: 12px; color: var(--muted); margin-top: 8px; }
  .legend span { display: inline-flex; align-items: center; gap: 4px; }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
</style>
</head>
<body>
<div class="wrap">

<h1>Skill Prism — Prompt eval</h1>
<div class="meta">
  Source: <code>${escapeHtml(inputPath.split('/').slice(-1)[0])}</code> ·
  Records: ${scored.length} ·
  Variants: ${summaries.length} ·
  Topics per variant: ${topicIds.length}
</div>

<div class="summary-card">
  <div class="stat">Producer cost (total) <b>$${totalCost.toFixed(2)}</b></div>
  <div class="stat">Judge cost (Opus 4.7) <b>$${totalJudgeCost.toFixed(2)}</b></div>
  <div class="stat">Records <b>${scored.length}</b></div>
  <div class="stat">Variants × topics <b>${summaries.length} × ${topicIds.length}</b></div>
</div>

<h2>Variant summary — cost × quality</h2>
<div class="legend">
  <span><i style="background:${scoreColor(5)}"></i>5 (excellent)</span>
  <span><i style="background:${scoreColor(3.5)}"></i>3.5</span>
  <span><i style="background:${scoreColor(2)}"></i>2 (concerning)</span>
  <span><i style="background:${scoreColor(0.5)}"></i>0–1 (broken)</span>
</div>
<table style="margin-top:12px">
<thead>
  <tr>
    <th>Variant</th><th>Label</th>
    <th class="num">Avg in</th><th class="num">Avg out</th>
    <th class="num">Avg $/click</th><th class="num">Total $</th>
    <th class="num">Latency</th>
    <th>Breakdown</th><th>Insight</th>
    <th>Scope-OK</th><th>Structure-OK</th>
  </tr>
</thead>
<tbody>
${summaries
  .map(
    (s) => `<tr class="${s.variantId === 'V0' ? 'baseline' : ''}">
    <td class="vid">${s.variantId}</td>
    <td>${escapeHtml(s.variantLabel)}</td>
    <td class="num">${fmt(s.avgInTokens, 0)}</td>
    <td class="num">${fmt(s.avgOutTokens, 0)}</td>
    <td class="num">$${fmt(s.avgCostUsd, 4)}</td>
    <td class="num">$${fmt(s.totalCostUsd, 2)}</td>
    <td class="num">${(s.avgLatencyMs / 1000).toFixed(1)}s</td>
    ${scoreCell(s.breakdownOverall)}
    ${scoreCell(s.insightOverall)}
    <td class="num">${fmt(s.scopeOkPct, 0)}%</td>
    <td class="num">${s.structureOkCount}/${s.count}</td>
  </tr>`,
  )
  .join('')}
</tbody>
</table>
<div class="meta" style="margin-top:8px">Baseline (V0) row highlighted. Breakdown & Insight scores are Opus 4.7 overall_quality on a 0–5 scale.</div>

<h2>Breakdown axes</h2>
<table>
<thead>
  <tr>
    <th>Variant</th><th>Label</th>
    <th>Overall</th><th>Coverage</th><th>Specificity</th>
    <th class="num">Terse-label %</th>
  </tr>
</thead>
<tbody>
${summaries
  .map(
    (s) => `<tr class="${s.variantId === 'V0' ? 'baseline' : ''}">
    <td class="vid">${s.variantId}</td>
    <td>${escapeHtml(s.variantLabel)}</td>
    ${scoreCell(s.breakdownOverall)}
    ${scoreCell(s.breakdownCoverage)}
    ${scoreCell(s.breakdownSpecificity)}
    <td class="num">${fmt(s.breakdownTerse, 0)}%</td>
  </tr>`,
  )
  .join('')}
</tbody>
</table>

<h2>Insight axes</h2>
<table>
<thead>
  <tr>
    <th>Variant</th><th>Label</th>
    <th>Overall</th><th>Field-primacy</th><th>Currency</th><th>Doorway</th><th>Diversity</th><th>Voice</th>
    <th class="num">Actions terse %</th>
  </tr>
</thead>
<tbody>
${summaries
  .map(
    (s) => `<tr class="${s.variantId === 'V0' ? 'baseline' : ''}">
    <td class="vid">${s.variantId}</td>
    <td>${escapeHtml(s.variantLabel)}</td>
    ${scoreCell(s.insightOverall)}
    ${scoreCell(s.insightFieldPrimacy)}
    ${scoreCell(s.insightCurrency)}
    ${scoreCell(s.insightDoorway)}
    ${scoreCell(s.insightDiversity)}
    ${scoreCell(s.insightVoice)}
    <td class="num">${fmt(s.insightTerse, 0)}%</td>
  </tr>`,
  )
  .join('')}
</tbody>
</table>

<h2>Per-topic Insight scores (where variants disagree)</h2>
<div class="topic-grid">
<table>
<thead>
  <tr>
    <th>Topic</th>
    ${variantIds.map((v) => `<th class="vid">${v}</th>`).join('')}
    <th class="num">Range</th>
  </tr>
</thead>
<tbody>
${topicIds
  .map((tid) => {
    const scores = variantIds.map((v) => cells.get(`${v}|${tid}`)?.score ?? null);
    const valid = scores.filter((s): s is number => s !== null);
    const range = valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : 0;
    return { tid, scores, range };
  })
  .sort((a, b) => b.range - a.range)
  .map(
    ({ tid, scores, range }) => `<tr>
    <td class="topic">${escapeHtml(tid)}</td>
    ${scores.map((s) => (s === null ? '<td class="score">–</td>' : scoreCell(s))).join('')}
    <td class="num"><b>${fmt(range)}</b></td>
  </tr>`,
  )
  .join('')}
</tbody>
</table>
</div>

<h2>Per-topic detail (click to expand)</h2>
<div class="meta">For each topic, shows what every variant actually produced — so you can read the outputs and form your own judgment beyond the numeric scores.</div>

${topicIds
  .map((tid) => {
    const topicLabel = scored.find((r) => r.topicId === tid)?.topic ?? tid;
    const clickTerm = scored.find((r) => r.topicId === tid)?.clickTerm ?? '';
    const bucket = scored.find((r) => r.topicId === tid)?.topicBucket ?? '';

    const variantCards = variantIds
      .map((vid) => {
        const row = scored.find((r) => r.variantId === vid && r.topicId === tid);
        const rawRec = rawByKey.get(`${vid}|${tid}`);
        if (!row || !rawRec) return '';
        const iScore = isInsightOk(row.insightScore) ? row.insightScore : null;
        const bScore = isBreakdownOk(row.breakdownScore) ? row.breakdownScore : null;
        const traps = rawRec.insight.classifier?.parsed ?? null;
        return `<div class="variant-card">
          <div class="hdr">
            <div><span class="vid">${vid}</span> <span class="label">${escapeHtml(row.variantLabel)}</span></div>
            <div class="label">$${(row.totals.costUsd ?? 0).toFixed(4)} · ${(row.totals.latencyMs / 1000).toFixed(1)}s</div>
          </div>
          <div class="scoreline">
            breakdown: ${bScore ? `<b style="color:${scoreColor(bScore.overall_quality ?? 0)}">${fmt(bScore.overall_quality ?? 0)}</b>` : '—'} ·
            insight: ${iScore ? `<b style="color:${scoreColor(iScore.overall_quality ?? 0)}">${fmt(iScore.overall_quality ?? 0)}</b>` : '—'} ·
            scope-viol: ${iScore ? iScore.scope_violations ?? 0 : '—'}/3 ·
            structure: ${iScore ? (iScore.structure_ok ? 'ok' : 'fail') : '—'}
            ${rawRec.insight.critiqueFired ? ' · <span style="color:#a06000">critique fired</span>' : ''}
          </div>
          <h3 style="margin:12px 0 6px">Insight (term: ${escapeHtml(clickTerm)})</h3>
          ${renderInsight(rawRec.insight.finalInsight)}
          ${iScore?.notes ? `<div class="notes">judge: ${escapeHtml(iScore.notes)}</div>` : ''}
          <h3 style="margin:16px 0 6px">Breakdown</h3>
          <div class="traps">scope traps · ${renderTraps(traps)}</div>
          ${renderBreakdownGrid(rawRec.breakdown.parsed)}
          ${bScore?.notes ? `<div class="notes">judge: ${escapeHtml(bScore.notes)}</div>` : ''}
        </div>`;
      })
      .join('');

    return `<details>
      <summary>${escapeHtml(topicLabel)} <span class="label" style="font-weight:400;margin-left:8px">${bucket} · click=${escapeHtml(clickTerm)}</span></summary>
      <div class="body">
        <div class="topic-cell-grid">${variantCards}</div>
      </div>
    </details>`;
  })
  .join('')}

</div>
</body>
</html>`;

  const outputPath = inputPath.replace(/\.scored\.jsonl$/, '.html');
  writeFileSync(outputPath, html);
  console.log(`[reportHtml] Output: ${outputPath}`);
}

main();
