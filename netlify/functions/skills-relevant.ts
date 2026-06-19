// Netlify Function — GET /api/skills-relevant?term=X
//
// Returns ranked candidate skills from skills.sh's semantic search, via the
// skill-prism-skills-worker proxy. The client passes these into
// buildInsightPrompt so the generation model can choose whether any belongs
// in the three move slots.
//
// The `path` query param accepted by previous versions is no longer used:
// semantic search treats the bare term well enough that the breadcrumb
// context is no longer load-bearing, and concatenating it tended to drift
// the query away from the user's actual intent.

import type { Context } from '@netlify/functions';
import { retrieveSkills } from '../lib/skillsRetrieval';

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
  const url = new URL(req.url);
  const term = url.searchParams.get('term')?.trim() ?? '';
  if (!term) return json(400, { error: 'Missing term' });

  try {
    const candidates = await retrieveSkills({ term });
    return json(200, { candidates });
  } catch (e) {
    console.error('[/api/skills-relevant] handler error', e);
    return json(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function json(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
