// Skill retrieval for the insight panel.
//
// Calls the skill-prism-skills-worker Vercel project's /api/search endpoint,
// which proxies skills.sh's official /api/v1/skills/search (semantic for
// multi-word queries, fuzzy for single-word). The response carries every
// field the insight prompt needs, so there is no separate hydration step.
//
// The local skills_catalog table in Supabase is still mirrored by the
// worker's daily cron — that's data infrastructure for future surfaces
// (browse-by-topic, source filtering) but is not on this code path.
//
// Graceful degradation: if the worker is unreachable, mis-secret'd, or
// upstream returns 5xx, we return [] so the insight panel still renders
// with only book/course/person/site moves.

export type SkillCandidate = {
  slug: string;
  display_name: string;
  description: string;
  install_count: number;
  skills_sh_url: string;
  install_command: string;
  score: number;
};

type SearchData = {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  url: string;
  isOfficial?: boolean;
};

type SearchResponse = {
  data: SearchData[];
};

function toCandidate(s: SearchData, indexFromTop: number, total: number): SkillCandidate {
  const parts = s.source.split('/');
  const owner = parts[0];
  const repo = parts[1] ?? parts[0];
  return {
    slug: `${owner}/${repo}@${s.slug}`,
    display_name: s.name,
    description: '',
    install_count: s.installs,
    skills_sh_url: s.url,
    install_command: `npx skills add ${owner}/${repo}@${s.slug}`,
    // Synthetic score that preserves the upstream ranking. The prompt does
    // not actually use the value — only the order — but the field is part
    // of the API contract with the client.
    score: total - indexFromTop,
  };
}

export async function retrieveSkills(opts: {
  term: string;
  limit?: number;
}): Promise<SkillCandidate[]> {
  const url = process.env.SKILLS_PROXY_URL;
  const secret = process.env.SKILLS_PROXY_SECRET;
  if (!url || !secret) return [];

  const term = opts.term.trim();
  if (term.length < 2) return [];

  const limit = opts.limit ?? 10;
  const target = `${url.replace(/\/$/, '')}/api/search?q=${encodeURIComponent(term)}&limit=${limit}`;
  try {
    const r = await fetch(target, {
      headers: { 'x-skills-proxy-secret': secret },
    });
    if (!r.ok) {
      console.error(`[skillsRetrieval] worker returned ${r.status}`);
      return [];
    }
    const body = (await r.json()) as SearchResponse;
    if (!Array.isArray(body.data)) return [];
    return body.data.map((s, i) => toCandidate(s, i, body.data.length));
  } catch (e) {
    console.error('[skillsRetrieval] fetch failed:', e instanceof Error ? e.message : e);
    return [];
  }
}
