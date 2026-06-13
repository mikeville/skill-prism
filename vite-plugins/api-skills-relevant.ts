// Vite middleware that handles /api/skills-relevant in dev. Mirrors the
// Netlify Function in netlify/functions/skills-relevant.ts. Reads from the
// same Supabase service-role client as handleSearch.
//
// Production unchanged: served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { getSupabase } from '../netlify/lib/db';
import { scoreCandidates, type CatalogSkill } from '../netlify/lib/skillsRetrieval';

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

export function apiSkillsRelevantProxy(): Plugin {
  return {
    name: 'api-skills-relevant-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
    },
    configureServer(server) {
      server.middlewares.use('/api/skills-relevant', async (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
        const fullUrl = new URL(req.url ?? '/', 'http://localhost');
        const term = fullUrl.searchParams.get('term')?.trim() ?? '';
        const pathParam = fullUrl.searchParams.get('path') ?? '';
        const path = pathParam ? pathParam.split('|').map((s) => s.trim()).filter(Boolean) : [];
        if (!term) return jsonResponse(res, 400, { error: 'Missing term' });

        try {
          const catalog = await loadCatalog();
          const candidates = scoreCandidates({ term, path, catalog });
          return jsonResponse(res, 200, { candidates });
        } catch (e) {
          console.error('[/api/skills-relevant] error', e);
          return jsonResponse(res, 500, {
            error: e instanceof Error ? e.message : 'Server error',
          });
        }
      });
    },
  };
}

function jsonResponse(res: ServerResponse, statusCode: number, body: object) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}
