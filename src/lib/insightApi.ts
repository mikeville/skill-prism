import { buildInsightPrompt } from './insightPrompt';

export type ResourceKind = 'book' | 'course' | 'person' | 'community' | 'site';

export type InsightResource = {
  title: string;
  kind: ResourceKind;
  note: string;
};

export type Insight = {
  framing: string;
  resources: InsightResource[];
  actions: string[];
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

  let parsed: { framing?: unknown; resources?: unknown; actions?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse insight output as JSON.');
  }

  const framing = typeof parsed.framing === 'string' ? parsed.framing.trim() : '';

  const resources: InsightResource[] = Array.isArray(parsed.resources)
    ? (parsed.resources as unknown[])
        .map((r): InsightResource | null => {
          if (!r || typeof r !== 'object') return null;
          const obj = r as { title?: unknown; kind?: unknown; note?: unknown };
          const title = typeof obj.title === 'string' ? obj.title.trim() : '';
          const note = typeof obj.note === 'string' ? obj.note.trim() : '';
          const kindRaw = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
          const kind = (VALID_KINDS.has(kindRaw as ResourceKind) ? kindRaw : 'site') as ResourceKind;
          if (!title) return null;
          return { title, kind, note };
        })
        .filter((r): r is InsightResource => r !== null)
        .slice(0, 5)
    : [];

  const actions: string[] = Array.isArray(parsed.actions)
    ? (parsed.actions as unknown[])
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return { framing, resources, actions };
}
