import type { Breakdown } from '../types';
import { buildPrompt } from './prompt';
import { getSessionId } from './session';
import { streamCompletion } from './streamSse';

export async function generateBreakdown({
  topic,
  path,
  onPartial,
}: {
  topic: string;
  path: string[];
  // When provided, the proxy streams Anthropic's SSE response and onPartial is
  // invoked with progressively-complete Breakdowns as mains and sub-rows
  // arrive. Arrays may be shorter than 8 while the stream is in flight —
  // callers should keep their loading flag on so empty cells render skeletons.
  // The returned Breakdown is the final, padded shape (8×8).
  onPartial?: (partial: Breakdown) => void;
}): Promise<Breakdown> {
  const prompt = buildPrompt({ topic, path });
  const session_id = getSessionId();

  if (!onPartial) {
    const r = await fetch('api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, path, session_id }),
    });

    const body = (await r.json().catch(() => ({}))) as {
      completion?: string;
      cache_hit?: boolean;
      error?: string;
    };
    if (!r.ok || body.error) {
      throw new Error(body.error || `API error (${r.status})`);
    }
    return parseBreakdown(body.completion ?? '');
  }

  // Streaming path. streamCompletion handles SSE + non-SSE fallback; we just
  // re-parse the accumulating buffer on every delta and forward the partial.
  const text = await streamCompletion(
    'api/complete',
    { prompt, path, session_id },
    (accumulated) => onPartial(parsePartialBreakdown(accumulated)),
  );
  return parseBreakdown(text);
}

// Progressive parser for an in-flight Breakdown JSON buffer. Anchors on the
// schema keys (`"mains"` and `"subs"`) and walks the buffer extracting any
// complete string values present. Returns arrays of whatever-real-length —
// does NOT pad to 8. Padding would make the streaming UX look instant-full
// instead of progressive; the components handle short arrays gracefully.
export function parsePartialBreakdown(buffer: string): Breakdown {
  return {
    mains: extractStringArray(buffer, '"mains"'),
    subs: extractStringMatrix(buffer, '"subs"'),
  };
}

// Find the `[ ... ]` that follows the given key in the buffer and pull out
// every complete `"..."` string up to (or short of) the closing `]`. Stops
// at the matching close bracket if found, otherwise reads as far as the
// buffer goes. Returns `[]` if the key or opening `[` isn't there yet.
function extractStringArray(buffer: string, key: string): string[] {
  const keyIdx = buffer.indexOf(key);
  if (keyIdx < 0) return [];
  const openIdx = buffer.indexOf('[', keyIdx);
  if (openIdx < 0) return [];
  const { strings } = walkStringList(buffer, openIdx + 1);
  return strings;
}

// Two-level version: each complete inner `[...]` is one row of strings.
// We only emit a row once we've seen its closing `]`, so the streaming UX
// reveals subs one row at a time as Anthropic finishes each inner array.
function extractStringMatrix(buffer: string, key: string): string[][] {
  const keyIdx = buffer.indexOf(key);
  if (keyIdx < 0) return [];
  const openIdx = buffer.indexOf('[', keyIdx);
  if (openIdx < 0) return [];

  const rows: string[][] = [];
  let i = openIdx + 1;
  while (i < buffer.length) {
    // Skip whitespace + commas between rows.
    while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\n' || buffer[i] === '\r' || buffer[i] === '\t' || buffer[i] === ',')) {
      i++;
    }
    if (i >= buffer.length) break;
    if (buffer[i] === ']') break; // outer close
    if (buffer[i] !== '[') break; // unexpected token; bail
    const { strings, end, closed } = walkStringList(buffer, i + 1);
    if (!closed) break; // row still streaming — don't emit a partial row
    rows.push(strings);
    i = end + 1;
  }
  return rows;
}

// Walk a JSON string-array body starting at index `start` (the char after `[`).
// Returns the strings extracted and where we ended up. `closed` is true if we
// hit the matching `]`; false means the buffer ran out mid-array.
function walkStringList(
  buffer: string,
  start: number,
): { strings: string[]; end: number; closed: boolean } {
  const strings: string[] = [];
  let i = start;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === ']') return { strings, end: i, closed: true };
    if (ch === '"') {
      // Read a string literal, honoring \" and \\ escapes.
      let j = i + 1;
      let value = '';
      let complete = false;
      while (j < buffer.length) {
        const c = buffer[j];
        if (c === '\\' && j + 1 < buffer.length) {
          const next = buffer[j + 1];
          if (next === 'n') value += '\n';
          else if (next === 't') value += '\t';
          else if (next === 'r') value += '\r';
          else value += next; // covers \" \\ etc.
          j += 2;
          continue;
        }
        if (c === '"') {
          complete = true;
          break;
        }
        value += c;
        j++;
      }
      if (!complete) {
        // Partial string still streaming — don't emit; stop here.
        return { strings, end: j, closed: false };
      }
      strings.push(value);
      i = j + 1;
      continue;
    }
    // Skip whitespace, commas, and any other filler.
    i++;
  }
  return { strings, end: i, closed: false };
}

function parseBreakdown(raw: string): Breakdown {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);

  let parsed: { mains?: unknown; subs?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('parse fail', raw);
    throw new Error('Could not parse model output as JSON.');
  }

  const mains: string[] = Array.isArray(parsed.mains)
    ? (parsed.mains as unknown[]).slice(0, 8).map((x) => String(x ?? ''))
    : [];
  while (mains.length < 8) mains.push('');

  const subs: string[][] = [];
  if (Array.isArray(parsed.subs)) {
    for (let i = 0; i < 8; i++) {
      const rawRow = (parsed.subs as unknown[])[i];
      const row: string[] = Array.isArray(rawRow)
        ? (rawRow as unknown[]).slice(0, 8).map((x) => String(x ?? ''))
        : [];
      while (row.length < 8) row.push('');
      subs.push(row);
    }
  } else {
    for (let i = 0; i < 8; i++) subs.push(['', '', '', '', '', '', '', '']);
  }

  return { mains, subs };
}
