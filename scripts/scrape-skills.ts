// Scrape skills.sh leaderboard + GitHub SKILL.md descriptions into
// public.skills_catalog. Run manually:
//
//   npm run scrape:skills
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_KEY from .env at the project root.
// Optional GITHUB_TOKEN raises the GitHub REST rate limit from 60/hr to
// 5000/hr — useful but not required for the ~50–100 repo tree calls.
//
// Failure mode is intentionally LOUD: if the upstream HTML structure shifts
// and we parse fewer than MIN_EXPECTED_SKILLS rows, the run bails before
// writing anything so we don't silently truncate the catalog.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const LEADERBOARD_URL = 'https://skills.sh/';
const MIN_EXPECTED_SKILLS = 100;
const GITHUB_CONCURRENCY = 5;

type LeaderboardRow = {
  rank: number;
  owner: string;
  repo: string;
  skillName: string;
  displayName: string;
  installCount: number;
  activity8w: number;
};

type EnrichedRow = LeaderboardRow & {
  description: string;
  githubUrl: string;
};

function loadDotenv(): void {
  const envPath = resolve(projectRoot, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseInstallCount(raw: string): number {
  // skills.sh formats counts as "2.0M", "185K", "1.2K", "523", etc.
  const trimmed = raw.trim();
  const m = trimmed.match(/^([\d.]+)([KMB])?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return 0;
  const suffix = (m[2] || '').toUpperCase();
  if (suffix === 'B') return Math.round(n * 1_000_000_000);
  if (suffix === 'M') return Math.round(n * 1_000_000);
  if (suffix === 'K') return Math.round(n * 1_000);
  return Math.round(n);
}

function parseLeaderboard(html: string): LeaderboardRow[] {
  // Each row is an <a class="group grid ..." href="/<owner>/<repo>/<skill>">…</a>.
  // We grab each anchor and pull the parts out with focused regexes — robust
  // enough for the current markup, loud about failure if it shifts.
  const rows: LeaderboardRow[] = [];
  const anchorRe = /<a\s+class="group grid[^"]*"\s+href="\/([^/]+)\/([^/]+)\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const [, owner, repo, skillName, inner] = m;

    const rankMatch = inner.match(/font-mono[^"]*">(\d+)<\/span>/);
    const displayMatch = inner.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const ariaMatch = inner.match(/aria-label="Weekly installs:\s*([^"]+)"/);
    // The total-install span is the LAST font-mono span in the row.
    const totalRe = /<span class="font-mono[^"]*">([^<]+)<\/span>/g;
    let lastTotal: string | null = null;
    let tm: RegExpExecArray | null;
    while ((tm = totalRe.exec(inner)) !== null) lastTotal = tm[1];

    if (!rankMatch || !displayMatch || !lastTotal) continue;

    const activity8w = ariaMatch
      ? ariaMatch[1]
          .split(',')
          .map((s) => parseInt(s.trim().replace(/,/g, ''), 10))
          .filter((n) => isFinite(n))
          .reduce((a, b) => a + b, 0)
      : 0;

    rows.push({
      rank: parseInt(rankMatch[1], 10),
      owner,
      repo,
      skillName,
      displayName: displayMatch[1].trim(),
      installCount: parseInstallCount(lastTotal),
      activity8w,
    });
  }
  return rows;
}

type TreeEntry = { path: string; type: string };

const treeCache = new Map<string, TreeEntry[] | null>();

async function fetchRepoTree(owner: string, repo: string): Promise<TreeEntry[] | null> {
  const key = `${owner}/${repo}`;
  if (treeCache.has(key)) return treeCache.get(key) ?? null;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'skill-prism-scraper',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const r = await fetch(url, { headers });
  if (!r.ok) {
    treeCache.set(key, null);
    return null;
  }
  const body = (await r.json()) as { tree?: TreeEntry[] };
  const tree = body.tree ?? [];
  treeCache.set(key, tree);
  return tree;
}

async function findSkillMdPath(
  owner: string,
  repo: string,
  skillName: string,
): Promise<string | null> {
  // Try the two most common conventions first to skip a tree fetch when
  // possible. Falls back to the recursive tree lookup for repos with custom
  // layouts (e.g. nested `skills/deprecated/...` folders).
  const direct = [
    `${skillName}/SKILL.md`,
    `skills/${skillName}/SKILL.md`,
  ];
  for (const path of direct) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
    const r = await fetch(url, { method: 'HEAD' });
    if (r.ok) return path;
  }
  const tree = await fetchRepoTree(owner, repo);
  if (!tree) return null;
  // Match any SKILL.md whose immediate parent folder is the skill name.
  // Apostrophes/hyphens in skill names map 1:1 to folder names on skills.sh,
  // so an exact basename match is sufficient.
  for (const entry of tree) {
    if (entry.type !== 'blob') continue;
    if (!entry.path.endsWith('/SKILL.md')) continue;
    const parts = entry.path.split('/');
    if (parts[parts.length - 2] === skillName) return entry.path;
  }
  return null;
}

function parseFrontmatterDescription(md: string): string {
  // SKILL.md frontmatter is YAML between two `---` lines at the top. The
  // `description:` field can span multiple lines (YAML folded/literal block)
  // or sit on one line. Capture from `description:` to the next top-level
  // key or the closing `---`.
  if (!md.startsWith('---')) return '';
  const end = md.indexOf('\n---', 3);
  if (end < 0) return '';
  const front = md.slice(3, end);
  const descMatch = front.match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z_][\w-]*:|\n*$)/m);
  if (!descMatch) return '';
  return descMatch[1]
    .replace(/^[>|]-?\s*/, '')
    .replace(/\n\s+/g, ' ')
    .trim();
}

async function fetchDescription(
  owner: string,
  repo: string,
  path: string,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
  const r = await fetch(url);
  if (!r.ok) return '';
  const text = await r.text();
  return parseFrontmatterDescription(text);
}

async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function enrich(rows: LeaderboardRow[]): Promise<EnrichedRow[]> {
  return pMap(rows, GITHUB_CONCURRENCY, async (row) => {
    const path = await findSkillMdPath(row.owner, row.repo, row.skillName);
    const description = path ? await fetchDescription(row.owner, row.repo, path) : '';
    const githubUrl = path
      ? `https://github.com/${row.owner}/${row.repo}/blob/HEAD/${path}`
      : `https://github.com/${row.owner}/${row.repo}`;
    return { ...row, description, githubUrl };
  });
}

async function main(): Promise<void> {
  loadDotenv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }

  console.log(`Fetching ${LEADERBOARD_URL}…`);
  const r = await fetch(LEADERBOARD_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 skill-prism-scraper' },
  });
  if (!r.ok) {
    console.error(`skills.sh returned ${r.status}`);
    process.exit(1);
  }
  const html = await r.text();
  const rows = parseLeaderboard(html);
  console.log(`Parsed ${rows.length} leaderboard rows.`);

  if (rows.length < MIN_EXPECTED_SKILLS) {
    console.error(
      `Bailing: parsed ${rows.length} rows but expected >= ${MIN_EXPECTED_SKILLS}. ` +
        `The skills.sh markup may have changed — inspect /tmp/skills-sh.html and update the parser.`,
    );
    process.exit(1);
  }

  console.log('Enriching with SKILL.md descriptions from GitHub…');
  const enriched = await enrich(rows);
  const withDesc = enriched.filter((r) => r.description.length > 0).length;
  console.log(`Resolved descriptions for ${withDesc}/${enriched.length} skills.`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();
  const payload = enriched.map((row) => ({
    slug: `${row.owner}/${row.repo}@${row.skillName}`,
    owner: row.owner,
    repo: row.repo,
    skill_name: row.skillName,
    display_name: row.displayName,
    description: row.description,
    install_count: row.installCount,
    activity_8w: row.activity8w,
    skills_sh_url: `https://skills.sh/${row.owner}/${row.repo}/${row.skillName}`,
    github_url: row.githubUrl,
    install_command: `npx skills add ${row.owner}/${row.repo}@${row.skillName}`,
    last_seen_at: now,
    last_updated_at: now,
  }));

  console.log(`Upserting ${payload.length} rows into skills_catalog…`);
  // Upsert in batches to stay under PostgREST request limits.
  const batchSize = 100;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { error } = await supabase
      .from('skills_catalog')
      .upsert(batch, { onConflict: 'slug' });
    if (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log(`✓ Wrote ${payload.length} skills.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
