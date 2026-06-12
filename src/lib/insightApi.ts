import { buildInsightPrompt } from './insightPrompt';
import { buildSubDisciplinePrompt } from './subDisciplinePrompt';
import { buildCritiquePrompt } from './critiquePrompt';
import { streamCompletion } from './streamSse';

export type ResourceKind = 'book' | 'course' | 'person' | 'community' | 'site';

export type InsightMove = {
  kind: ResourceKind;
  title: string;
  action: string;
  // Optional canonical URL. The model populates it for site/person/course
  // when confident; the UI constructs a Goodreads search link for books.
  // Missing is fine — UI falls back to plain text.
  url?: string;
};

export type Insight = {
  framing: string;
  moves: InsightMove[];
  // Exact Wikipedia article title the model believes best matches this term
  // in context, or null when no real article fits (colloquial phrases,
  // novel coinages, ambiguous titles with no good disambiguation). When
  // null the UI suppresses the WIKI chip entirely rather than dumping the
  // user into a search results page.
  wikipediaTitle?: string | null;
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
  onPartial,
}: {
  path: string[];
  term: string;
  // Streaming callback. If provided, the generation stage streams tokens via
  // SSE and onPartial is invoked with progressively-complete Insight objects
  // as framing and moves arrive. After critique (when it fires), onPartial
  // is called once more with the corrected final insight. Caller is
  // responsible for treating the streamed insight as ephemeral and
  // replacing it with the resolved return value.
  onPartial?: (partial: Insight) => void;
}): Promise<Insight> {
  // Stages 1 and 2 run in PARALLEL. Generation runs with empty scope traps
  // (it doesn't yet know what the classifier found) — critique is the safety
  // net for scope failures. This trades a small drop in generation base
  // quality for a 3s latency win, since most generations are clean and
  // critique only fires when the heuristic flags suspicion.
  const [traps, initial] = await Promise.all([
    fetchScopeTraps({ term }).catch(() => EMPTY_TRAPS),
    fetchGeneration({ path, term, traps: EMPTY_TRAPS, onPartial }),
  ]);

  // Stage 3: conditional critique. Run the adversarial editor pass only when
  // a generated title looks suspicious against the scope traps. The
  // heuristic is intentionally loose (3-char common prefix) to err toward
  // catching real failures at the cost of occasional false-positive critiques.
  if (!critiqueNeeded(traps, initial, term)) return initial;

  const corrected = await fetchCritique({ term, traps, candidate: initial }).catch(
    () => initial,
  );
  // When the critique replaces moves, push the corrected version to the UI
  // so the streamed (possibly wrong-scope) result gets superseded.
  if (corrected !== initial) onPartial?.(corrected);
  return corrected;
}

// Stopwords prevent over-triggering on generic terms that appear in most
// design titles (e.g., almost every design-topic title contains "design").
const STOPWORDS: ReadonlySet<string> = new Set(['design', 'art', 'work', 'studio']);

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Returns true if a generated title word shares a 3+ char prefix with any
// word inside any scope-trap (excluding stopwords and trap-words that
// substantially overlap with the topic name itself — those would over-fire
// on every legitimate on-topic recommendation).
//
// Why 3 chars? Examples like "Type" (title) vs "typography" (trap) only
// share 3 chars before diverging — "typ" vs "typo" — but we still want to
// catch this case as suspicious. Pure 4-char-equality misses it.
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
        .filter(
          (w) => !STOPWORDS.has(w) && w.length >= 4 && !trapWordOverlapsTopic(w),
        );
      for (const trapWord of trapWords) {
        for (const titleWord of titleWords) {
          if (titleWord.length >= 4 && commonPrefixLength(titleWord, trapWord) >= 3) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

async function fetchGeneration({
  path,
  term,
  traps,
  onPartial,
}: {
  path: string[];
  term: string;
  traps: ScopeTraps;
  onPartial?: (partial: Insight) => void;
}): Promise<Insight> {
  const prompt = buildInsightPrompt({
    path,
    term,
    subDisciplines: traps.subDisciplines,
    adjacentDisciplines: traps.adjacentDisciplines,
  });

  // Non-streaming path (used by classifier and critique stages, and by any
  // caller that doesn't pass onPartial).
  if (!onPartial) {
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

  // Streaming path. The proxy passes through Anthropic's SSE stream; we
  // accumulate the text and re-parse on each delta to emit progressively
  // complete Insight objects to the caller.
  const text = await streamCompletion('api/insight', { prompt }, (accumulated) => {
    const partial = parsePartialInsight(accumulated);
    onPartial(partial);
  });
  return parseInsight(text);
}

// Progressive parser that extracts whatever's parseable from an in-flight
// JSON string. Anchors on the schema keys (`"framing"`, `"moves"`) so it
// doesn't false-positive on reasoning text that may precede the actual JSON.
function parsePartialInsight(buffer: string): Insight {
  let framing = '';

  // Find the framing key, then the value's opening quote, then read up to
  // the next unescaped closing quote OR end of buffer (partial value still
  // streaming in).
  const framingKey = buffer.indexOf('"framing"');
  if (framingKey >= 0) {
    const afterColon = buffer.indexOf(':', framingKey);
    if (afterColon >= 0) {
      const openQuote = buffer.indexOf('"', afterColon);
      if (openQuote >= 0) {
        let i = openQuote + 1;
        while (i < buffer.length) {
          if (buffer[i] === '\\') {
            i += 2;
            continue;
          }
          if (buffer[i] === '"') break;
          i++;
        }
        framing = buffer
          .slice(openQuote + 1, i)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    }
  }

  // Scope move-parsing to the chunk after `"moves"` to avoid false-positive
  // matches on JSON-like patterns in any pre-JSON reasoning text.
  const movesKeyIdx = buffer.indexOf('"moves"');
  const movesScope = movesKeyIdx >= 0 ? buffer.slice(movesKeyIdx) : '';
  const moves: InsightMove[] = [];

  // Match complete move objects: { kind, title, action, url? }. url is
  // optional in the schema, so the regex makes the url segment optional.
  const completeRe = /\{\s*"kind"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"action"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*"url"\s*:\s*"((?:[^"\\]|\\.)*)"\s*)?\}/g;
  let m: RegExpExecArray | null;
  let lastCompleteEnd = 0;
  const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  while ((m = completeRe.exec(movesScope)) !== null) {
    if (moves.length >= 3) break;
    const kindRaw = m[1].trim().toLowerCase();
    const kind = (VALID_KINDS.has(kindRaw as ResourceKind) ? kindRaw : 'site') as ResourceKind;
    const url = m[4] ? unescape(m[4]).trim() : undefined;
    moves.push({
      kind,
      title: unescape(m[2]),
      action: unescape(m[3]),
      ...(url ? { url } : {}),
    });
    lastCompleteEnd = m.index + m[0].length;
  }

  // After the last complete move, look for one move-in-progress that has
  // at least a complete title. We surface kind+title with an empty action
  // so the UI can render the title immediately; the action arrives later.
  if (moves.length < 3) {
    const tail = movesScope.slice(lastCompleteEnd);
    const partialRe = /\{\s*"kind"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"((?:[^"\\]|\\.)*)"/;
    const pm = tail.match(partialRe);
    if (pm) {
      const kindRaw = pm[1].trim().toLowerCase();
      const kind = (VALID_KINDS.has(kindRaw as ResourceKind) ? kindRaw : 'site') as ResourceKind;
      moves.push({
        kind,
        title: pm[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
        action: '',
      });
    }
  }

  return { framing, moves };
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
    // Critique focuses on move scope; preserve the original wikipedia_title
    // decision rather than risking the critique pass dropping or changing it.
    return { ...corrected, wikipediaTitle: candidate.wikipediaTitle ?? null };
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
  let parsed: { framing?: unknown; moves?: unknown; wikipedia_title?: unknown };
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
          const obj = m as {
            kind?: unknown;
            title?: unknown;
            action?: unknown;
            url?: unknown;
          };
          const title = typeof obj.title === 'string' ? obj.title.trim() : '';
          const action = typeof obj.action === 'string' ? obj.action.trim() : '';
          const kindRaw = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
          const kind = (VALID_KINDS.has(kindRaw as ResourceKind) ? kindRaw : 'site') as ResourceKind;
          const urlRaw = typeof obj.url === 'string' ? obj.url.trim() : '';
          if (!title || !action) return null;
          // Accept http/https only — reject anything that doesn't look like a
          // real URL to avoid rendering broken links from hallucinated values.
          const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : undefined;
          return { kind, title, action, ...(url ? { url } : {}) };
        })
        .filter((m): m is InsightMove => m !== null)
        .slice(0, 3)
    : [];

  // wikipedia_title may arrive as a string, JSON null, or be absent. Treat
  // empty strings and the literal "null" as null too (defensive against a
  // model stringifying it).
  const wikipediaTitleRaw =
    typeof parsed.wikipedia_title === 'string' ? parsed.wikipedia_title.trim() : '';
  const wikipediaTitle =
    wikipediaTitleRaw && wikipediaTitleRaw.toLowerCase() !== 'null'
      ? wikipediaTitleRaw
      : null;

  return { framing, moves, wikipediaTitle };
}
