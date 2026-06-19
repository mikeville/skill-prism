// Vite middleware that handles /api/skills-relevant in dev. Mirrors the
// Netlify Function in netlify/functions/skills-relevant.ts.
//
// Production unchanged: served by the Netlify Function.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { retrieveSkills } from '../netlify/lib/skillsRetrieval';

export function apiSkillsRelevantProxy(): Plugin {
  return {
    name: 'api-skills-relevant-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      for (const k of ['SKILLS_PROXY_URL', 'SKILLS_PROXY_SECRET']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
    },
    configureServer(server) {
      server.middlewares.use('/api/skills-relevant', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
        const fullUrl = new URL(req.url ?? '/', 'http://localhost');
        const term = fullUrl.searchParams.get('term')?.trim() ?? '';
        if (!term) return jsonResponse(res, 400, { error: 'Missing term' });

        try {
          const candidates = await retrieveSkills({ term });
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
