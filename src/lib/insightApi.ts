import { buildInsightPrompt } from './insightPrompt';

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

export async function fetchInsight({
  path,
  term,
}: {
  path: string[];
  term: string;
}): Promise<Insight> {
  const prompt = buildInsightPrompt({ path, term });

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

function parseInsight(raw: string): Insight {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);

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
