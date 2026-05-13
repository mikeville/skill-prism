import type { Breakdown } from '../types';
import { buildPrompt } from './prompt';
import { getSessionId } from './session';

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
    body: JSON.stringify({ prompt, path, session_id: getSessionId() }),
  });

  const body = (await r.json().catch(() => ({}))) as {
    completion?: string;
    cache_hit?: boolean;
    error?: string;
  };
  if (!r.ok || body.error) {
    throw new Error(body.error || `API error (${r.status})`);
  }
  const raw = body.completion ?? '';

  return parseBreakdown(raw);
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
