// Netlify Function — GET /api/skills-relevant?term=X&path=A|B|C
//
// Returns the top N candidate skills (default 8) from public.skills_catalog
// ranked against the term + breadcrumb path. The client passes these into
// buildInsightPrompt so the generation model can choose whether any of them
// belongs in the three move slots.
//
// Degrades gracefully when Supabase isn't configured (returns `{ candidates:
// [] }`) so the insight panel still works without the catalog wired up.

import type { Context } from '@netlify/functions';
import { getSupabase } from '../lib/db';
import { scoreCandidates, type CatalogSkill } from '../lib/skillsRetrieval';

// In-memory cache of the full catalog within a single Netlify Function
// instance. Netlify recycles instances frequently enough that this is
// effectively a "warm" cache rather than a stale-data risk.
const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogCache: { rows: CatalogSkill[]; loadedAt: number } | null = null;

async function loadCatalog(): Promise<CatalogSkill[]> {
  if (catalogCache && Date.now() - catalogCache.loadedAt < CATALOG_TTL_MS) {
    return catalogCache.rows;
  }
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('skills_catalog')
    .select('slug, display_name, description, install_count, skills_sh_url, install_command');
  if (error) {
    console.error('[/api/skills-relevant] catalog load failed:', error.message);
    return [];
  }
  const rows = (data ?? []) as CatalogSkill[];
  catalogCache = { rows, loadedAt: Date.now() };
  return rows;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  const url = new URL(req.url);
  const term = url.searchParams.get('term')?.trim() ?? '';
  const pathParam = url.searchParams.get('path') ?? '';
  const path = pathParam ? pathParam.split('|').map((s) => s.trim()).filter(Boolean) : [];
  if (!term) return jsonResponse(400, { error: 'Missing term' });

  try {
    const catalog = await loadCatalog();
    const candidates = scoreCandidates({ term, path, catalog });
    return jsonResponse(200, { candidates });
  } catch (e) {
    console.error('[/api/skills-relevant] handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
