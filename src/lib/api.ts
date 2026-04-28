// Client-side API: builds the prompt, posts to /api/complete (the Netlify function),
// parses the JSON breakdown, and returns a typed Breakdown.
// The prototype's window.claude.complete shim is gone — this fetches directly.

import type { Breakdown } from '../types';
import { MAIN_TO_BLOCK } from './gridMapping';
import { buildPrompt } from './prompt';

export async function generateBreakdown({
  topic,
  path,
}: {
  topic: string;
  path: string[];
}): Promise<Breakdown> {
  const prompt = buildPrompt({ topic, path });

  const r = await fetch('/api/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const body = await r.json().catch(() => ({}) as { completion?: string; error?: string });
  if (!r.ok || body.error) {
    throw new Error(body.error || `API error (${r.status})`);
  }
  const raw = body.completion ?? '';

  return parseBreakdown(raw);
}

// Strip fences, locate the JSON object, parse, and pad to exactly 8/8/8.
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

  const subs: Record<number, string[]> = {};
  if (Array.isArray(parsed.subs)) {
    for (let i = 0; i < 8; i++) {
      const blockIdx = MAIN_TO_BLOCK[i];
      const rawRow = (parsed.subs as unknown[])[i];
      const row: string[] = Array.isArray(rawRow)
        ? (rawRow as unknown[]).slice(0, 8).map((x) => String(x ?? ''))
        : [];
      while (row.length < 8) row.push('');
      subs[blockIdx] = row;
    }
  } else {
    for (let i = 0; i < 8; i++) subs[MAIN_TO_BLOCK[i]] = ['', '', '', '', '', '', '', ''];
  }

  return { mains, subs };
}
