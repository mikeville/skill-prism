// Deterministic checks computed locally from raw model outputs. These were
// previously delegated to the Opus 4.7 judge but they're pure string ops —
// running them locally costs nothing, is faster, and never disagrees with
// itself across runs.
//
// What stays in the LLM judge (judgePrompt.ts): scope match, field primacy,
// currency, coverage, specificity, doorway, diversity, overall quality, and
// the holistic voice read. Those require world knowledge or subjective
// judgment.

// ---------- shared parsing (mirrors src/lib/api.ts + insightApi.ts) ----------

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

// ---------- breakdown checks ----------

const FILLER_RE = /\b(fundamentals?|basics?|advanced|intro|introduction|overview|principles?)\b/i;

export type BreakdownLocalScore = {
  json_valid: boolean;
  fully_filled: boolean;
  labels_terse_pct: number;
  has_filler_terms: boolean;
  has_duplicates: boolean;
};

export function checkBreakdownLocal(raw: string): BreakdownLocalScore {
  let parsed: { mains?: unknown; subs?: unknown };
  try {
    parsed = JSON.parse(extractLastJsonObject(raw));
  } catch {
    return {
      json_valid: false,
      fully_filled: false,
      labels_terse_pct: 0,
      has_filler_terms: false,
      has_duplicates: false,
    };
  }

  const mains = Array.isArray(parsed.mains)
    ? (parsed.mains as unknown[]).map((x) => String(x ?? '').trim())
    : [];
  const subs: string[][] = Array.isArray(parsed.subs)
    ? (parsed.subs as unknown[]).map((row) =>
        Array.isArray(row) ? (row as unknown[]).map((x) => String(x ?? '').trim()) : [],
      )
    : [];

  const fullyFilled =
    mains.length === 8 &&
    mains.every((m) => m.length > 0) &&
    subs.length === 8 &&
    subs.every((row) => row.length === 8 && row.every((s) => s.length > 0));

  const allLabels = [...mains, ...subs.flat()].filter((s) => s.length > 0);
  const isTerse = (s: string): boolean => {
    const wordCount = s.split(/\s+/).filter((w) => w.length > 0).length;
    return wordCount <= 2 && s.length <= 18;
  };
  const terseCount = allLabels.filter(isTerse).length;
  const labelsTersePct = allLabels.length === 0 ? 0 : (100 * terseCount) / allLabels.length;

  const hasFiller = allLabels.some((s) => FILLER_RE.test(s));

  // Duplicates: across mains OR within any subs row. Case-insensitive.
  const mainSet = new Set(mains.map((s) => s.toLowerCase()));
  const mainsDup = mainSet.size !== mains.length;
  const rowDup = subs.some((row) => {
    const lc = row.map((s) => s.toLowerCase());
    return new Set(lc).size !== lc.length;
  });

  return {
    json_valid: true,
    fully_filled: fullyFilled,
    labels_terse_pct: Math.round(labelsTersePct),
    has_filler_terms: hasFiller,
    has_duplicates: mainsDup || rowDup,
  };
}

// ---------- insight checks ----------

// AI-tell vocabulary from the production prompt (insightPrompt.ts:103). If
// any of these appear (as standalone words), flag a voice warning. Captures
// most "AI sounding" cases without needing LLM judgment.
const AI_TELLS = [
  'leverage', 'unlock', 'journey', 'dive in', 'delve', 'intricate', 'tapestry',
  'vital', 'crucial', 'pivotal', 'testament', 'underscore', 'enduring',
  'vibrant', 'profound', 'enhance', 'empower', 'foster', 'cultivate',
  'ensure', 'showcase', 'robust', 'seamless', 'holistic', 'comprehensive',
];

// "X isn't Y — it's Z" / "It's not just X, it's Y" — negative-parallelism patterns.
const NEGATIVE_PARALLELISM_RE =
  /\b(isn'?t|is not|not just|not only|not merely)\b.{0,80}?[\—\-,]\s*(it'?s|but|rather|instead)\b/i;

// "At its core" / "the real question is" / "fundamentally" / "in essence" — hedges.
const HEDGE_RE = /\b(at its core|the real question is|fundamentally,?|what really matters|in essence|truly)\b/i;

// Starts with an imperative verb? Allow a small set we expect from the prompt
// (read/watch/follow/build/join/practice/study/learn/...). Anything starting
// with "to ", "this ", "the ", "by ", "you" etc. is NOT imperative.
const IMPERATIVE_FIRST_WORD = /^(read|watch|follow|build|join|practice|study|listen|browse|subscribe|skim|try|use|track|sketch|draw|write|cook|run|train|measure|sign|enroll|attend|visit|explore|memorize|absorb|copy|drill|review|pick|start|open|bookmark|tour|sample|order|brew|knead|grade|review|consult|recreate)\b/i;

export type Move = { kind: string; title: string; action: string; url?: string };
export type Insight = { framing: string; moves: Move[] };

export type InsightLocalScore = {
  json_valid: boolean;
  structure_ok: boolean;
  moves_count: number;
  framing_word_count: number;
  framing_within_22w: boolean;
  actions_terse_pct: number;            // % of moves with action ≤15 words AND imperative-leading
  actions_imperative_pct: number;       // % of moves with action that starts with an allowed imperative verb
  ai_tell_hits_count: number;           // count of AI-tell words across framing + actions
  ai_tell_examples: string[];           // up to 5 specific tells found
  negative_parallelism_found: boolean;  // framing matches "X isn't Y, it's Z" patterns
  hedge_found: boolean;                 // framing contains a persuasive-authority hedge
  has_em_dash_in_framing: boolean;      // any "—" in framing — Mike's prompt flags this
  duplicate_titles: boolean;
};

export function checkInsightLocal(rawOrParsed: string | Insight | null): InsightLocalScore {
  let parsed: Insight | null;
  if (rawOrParsed === null) {
    return emptyInsightLocal();
  }
  if (typeof rawOrParsed === 'string') {
    try {
      const p = JSON.parse(extractLastJsonObject(rawOrParsed)) as {
        framing?: unknown;
        moves?: unknown;
      };
      const framing = typeof p.framing === 'string' ? p.framing : '';
      const moves: Move[] = Array.isArray(p.moves)
        ? (p.moves as unknown[])
            .map((m): Move | null => {
              if (!m || typeof m !== 'object') return null;
              const obj = m as { kind?: unknown; title?: unknown; action?: unknown; url?: unknown };
              const kind = typeof obj.kind === 'string' ? obj.kind : '';
              const title = typeof obj.title === 'string' ? obj.title : '';
              const action = typeof obj.action === 'string' ? obj.action : '';
              const url = typeof obj.url === 'string' ? obj.url : undefined;
              return { kind, title, action, ...(url ? { url } : {}) };
            })
            .filter((m): m is Move => m !== null)
        : [];
      parsed = { framing, moves };
    } catch {
      return { ...emptyInsightLocal(), json_valid: false };
    }
  } else {
    parsed = rawOrParsed;
  }

  if (!parsed) return emptyInsightLocal();

  const framing = parsed.framing ?? '';
  const moves = parsed.moves ?? [];
  const framingWords = framing.split(/\s+/).filter((w) => w.length > 0).length;

  const structureOk =
    framing.length > 0 &&
    moves.length === 3 &&
    moves.every((m) => m.kind && m.title && m.action);

  const wordCount = (s: string): number => s.split(/\s+/).filter((w) => w.length > 0).length;
  const actionWordCounts = moves.map((m) => wordCount(m.action));
  const actionsTerseCount = actionWordCounts.filter((w) => w > 0 && w <= 15).length;
  const imperativeCount = moves.filter((m) => IMPERATIVE_FIRST_WORD.test(m.action.trim())).length;

  const actionsTersePct =
    moves.length === 0 ? 0 : Math.round((100 * actionsTerseCount) / moves.length);
  const actionsImperativePct =
    moves.length === 0 ? 0 : Math.round((100 * imperativeCount) / moves.length);

  // AI-tell hits across framing + all actions.
  const corpus = [framing, ...moves.map((m) => m.action)].join(' ').toLowerCase();
  const tellHits: string[] = [];
  for (const tell of AI_TELLS) {
    // Word-boundary match.
    const re = new RegExp(`\\b${tell.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (re.test(corpus)) tellHits.push(tell);
  }

  const titleSet = new Set(moves.map((m) => m.title.toLowerCase().trim()).filter(Boolean));
  const duplicateTitles = titleSet.size !== moves.filter((m) => m.title.trim()).length;

  return {
    json_valid: true,
    structure_ok: structureOk,
    moves_count: moves.length,
    framing_word_count: framingWords,
    framing_within_22w: framingWords > 0 && framingWords <= 22,
    actions_terse_pct: actionsTersePct,
    actions_imperative_pct: actionsImperativePct,
    ai_tell_hits_count: tellHits.length,
    ai_tell_examples: tellHits.slice(0, 5),
    negative_parallelism_found: NEGATIVE_PARALLELISM_RE.test(framing),
    hedge_found: HEDGE_RE.test(framing),
    has_em_dash_in_framing: framing.includes('—'),
    duplicate_titles: duplicateTitles,
  };
}

function emptyInsightLocal(): InsightLocalScore {
  return {
    json_valid: false,
    structure_ok: false,
    moves_count: 0,
    framing_word_count: 0,
    framing_within_22w: false,
    actions_terse_pct: 0,
    actions_imperative_pct: 0,
    ai_tell_hits_count: 0,
    ai_tell_examples: [],
    negative_parallelism_found: false,
    hedge_found: false,
    has_em_dash_in_framing: false,
    duplicate_titles: false,
  };
}
