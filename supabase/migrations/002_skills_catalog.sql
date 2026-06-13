-- Skill Prism — skills catalog.
-- Populated by scripts/scrape-skills.ts (run on demand via `npm run scrape:skills`).
-- Read by netlify/functions/skills-relevant.ts to surface candidate skills
-- alongside book/course/person/site recommendations in the insight panel.

create table if not exists public.skills_catalog (
  id              uuid primary key default gen_random_uuid(),
  -- Canonical identifier "<owner>/<repo>@<skill-name>" — same shape as the
  -- `npx skills add <slug>` install command. Dedup key for future
  -- multi-source merges (GitHub fan-out, other aggregators).
  slug            text not null,
  owner           text not null,
  repo            text not null,
  skill_name      text not null,
  display_name    text not null,
  -- From SKILL.md frontmatter `description:` field. Load-bearing for the
  -- keyword retrieval step — empty descriptions can't match topics, so
  -- they sink to the bottom of the ranking.
  description     text not null,
  install_count   int  not null default 0,
  -- Sum of the 8 weekly install values from the leaderboard sparkline.
  activity_8w     int  not null default 0,
  skills_sh_url   text not null,
  github_url      text not null,
  install_command text not null,
  -- last_seen_at advances on every scrape run where the skill appears in
  -- the upstream leaderboard. Rows that fall out of the leaderboard keep
  -- the stale timestamp — surfaceable later as a "delisted" filter.
  last_seen_at    timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create unique index if not exists skills_catalog_slug
  on public.skills_catalog (slug);

create index if not exists skills_catalog_installs
  on public.skills_catalog (install_count desc);

alter table public.skills_catalog enable row level security;

grant all on public.skills_catalog to service_role;
