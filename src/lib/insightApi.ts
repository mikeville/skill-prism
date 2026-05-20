import { buildInsightPrompt } from './insightPrompt';
import { buildSubDisciplinePrompt } from './subDisciplinePrompt';
import { buildCritiquePrompt } from './critiquePrompt';

export type ResourceKind = 'book' | 'course' | 'person' | 'community' | 'site';

export type InsightMove = {
  kind: ResourceKind;
  title: string;
  action: string;
};

export type Insight = {
  framing: string;
  moves: InsightMove[];
};

const VALID_KINDS: ReadonlySet<ResourceKind> = new Set([
  'book',
  'course',
  'person',
  'community',
  'site',
]);

type ScopeTraps = {
  subDisciplines: string[];
  adjacentDisciplines: string[];
};

const EMPTY_TRAPS: ScopeTraps = { subDisciplines: [], adjacentDisciplines: [] };

export async function fetchInsight({
  path,
  term,
}: {
  path: string[];
  term: string;
}): Promise<Insight> {
  // Stage 1: classify scope traps for this topic — sub-disciplines (narrower
  // practice areas within) and adjacent disciplines (sibling fields whose
  // canonical resources commonly get mistaken for this topic's). Both lists
  // are injected into stages 2 and 3 as anti-targets. On any failure, fall
  // through with empty lists — later stages are still functional.
  const traps = await fetchScopeTraps({ term }).catch(() => EMPTY_TRAPS);

  // Stage 2: generate initial 3 moves with scope-trap lists as anti-targets.
  const initial = await fetchGeneration({ path, term, traps });

  // Stage 3: adversarial critique. The generation pass can rationalize wrong-
  // scope picks ("foundational", "principles transfer", "practitioners use
  // this") that no in-prompt rule reliably catches. A separate pass framed as
  // an EDITOR auditing the generation gets a fresh forward pass with no
  // generation-side priors — different cognitive frame, different blind
  // spots. On any failure, fall back to the generation output.
  const corrected = await fetchCritique({ term, traps, candidate: initial }).catch(
    () => initial,
  );

  return corrected;
}

async function fetchGeneration({
  path,
  term,
  traps,
}: {
  path: string[];
  term: string;
  traps: ScopeTraps;
}): Promise<Insight> {
  const prompt = buildInsightPrompt({
    path,
    term,
    subDisciplines: traps.subDisciplines,
    adjacentDisciplines: traps.adjacentDisciplines,
  });
  const r = await fetch('api/insight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const body = (await r.json().catch(() => ({}))) as {
    completion?: string;
    error?: string;
  };
  if (!r.ok || body.error) {
    throw new Error(body.error || `API error (${r.status})`);
  }
  return parseInsight(body.completion ?? '');
}

async function fetchCritique({
  term,
  traps,
  candidate,
}: {
  term: string;
  traps: ScopeTraps;
  candidate: Insight;
}): Promise<Insight> {
  const prompt = buildCritiquePrompt({
    term,
    subDisciplines: traps.subDisciplines,
    adjacentDisciplines: traps.adjacentDisciplines,
    candidate,
  });
  const r = await fetch('api/insight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const body = (await r.json().catch(() => ({}))) as {
    completion?: string;
    error?: string;
  };
  if (!r.ok || body.error) {
    // Fall back to generation result on any failure.
    return candidate;
  }
  try {
    const corrected = parseInsight(body.completion ?? '');
    // If critique returns malformed/empty moves, fall back to generation.
    if (corrected.moves.length === 0) return candidate;
    return corrected;
  } catch {
    return candidate;
  }
}

async function fetchScopeTraps({ term }: { term: string }): Promise<ScopeTraps> {
  const prompt = buildSubDisciplinePrompt({ term });
  const r = await fetch('api/insight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const body = (await r.json().catch(() => ({}))) as {
    completion?: string;
    error?: string;
  };
  if (!r.ok || body.error) {
    // Degrade silently — main prompt without anti-targets still produces moves.
    return EMPTY_TRAPS;
  }
  return parseScopeTraps(body.completion ?? '');
}

// Extract the LAST complete top-level {...} object in the response. Models
// sometimes verbalize chain-of-thought reasoning before emitting the final
// JSON answer (e.g., "Candidate X — primary subject is Y. REJECT." followed
// by the actual JSON). The naïve first-{ to last-} heuristic spans across
// both, producing invalid JSON. Walking backward from the last } and
// tracking bracket depth finds the matching { of the last balanced block —
// which is the model's actual final answer.
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

function parseScopeTraps(raw: string): ScopeTraps {
  const cleaned = extractLastJsonObject(raw);
  let parsed: { sub_disciplines?: unknown; adjacent_disciplines?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return EMPTY_TRAPS;
  }
  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim())
      : [];
  return {
    subDisciplines: toStringArray(parsed.sub_disciplines),
    adjacentDisciplines: toStringArray(parsed.adjacent_disciplines),
  };
}

function parseInsight(raw: string): Insight {
  const cleaned = extractLastJsonObject(raw);
  let parsed: { framing?: unknown; moves?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse insight output as JSON.');
  }

  const framing = typeof parsed.framing === 'string' ? parsed.framing.trim() : '';

  const moves: InsightMove[] = Array.isArray(parsed.moves)
    ? (parsed.moves as unknown[])
        .map((m): InsightMove | null => {
          if (!m || typeof m !== 'object') return null;
          const obj = m as { kind?: unknown; title?: unknown; action?: unknown };
          const title = typeof obj.title === 'string' ? obj.title.trim() : '';
          const action = typeof obj.action === 'string' ? obj.action.trim() : '';
          const kindRaw = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
          const kind = (VALID_KINDS.has(kindRaw as ResourceKind) ? kindRaw : 'site') as ResourceKind;
          if (!title || !action) return null;
          return { kind, title, action };
        })
        .filter((m): m is InsightMove => m !== null)
        .slice(0, 3)
    : [];

  return { framing, moves };
}
