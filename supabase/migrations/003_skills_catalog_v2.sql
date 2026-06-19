-- Skill Prism — skills catalog v2.
--
-- The previous shape was built around the HTML-scraper in scripts/scrape-skills.ts,
-- which captured ~187 of skills.sh's ~9,602 skills and depended on the SKILL.md
-- description text as the load-bearing signal for tokenized retrieval ranking.
--
-- v2 cuts ties with that scraper: the catalog is now mirrored from skills.sh's
-- official /api/v1/skills endpoint by the skill-prism-skills-worker Vercel
-- project, and retrieval no longer runs locally — it goes through
-- /api/v1/skills/search (semantic). Local rows exist only to hydrate the
-- ranked IDs the search returns.

-- Columns no longer used:
--  - description: was the load-bearing retrieval signal; semantic search owns
--    relevance now.
--  - activity_8w: leaderboard sparkline sum; not surfaced anywhere.
--  - github_url: never used in retrieval or UI.
--  - last_updated_at: not used; last_seen_at covers the freshness need.
alter table public.skills_catalog drop column if exists description;
alter table public.skills_catalog drop column if exists activity_8w;
alter table public.skills_catalog drop column if exists github_url;
alter table public.skills_catalog drop column if exists last_updated_at;

-- New columns mirrored from /api/v1/skills:
--  - source_type: "github" | "mintlify.com" | ... (per V1Skill.sourceType)
--  - is_official: marks first-party "makers teaching their own product" skills
alter table public.skills_catalog add column if not exists source_type text;
alter table public.skills_catalog add column if not exists is_official boolean not null default false;

-- The install_count desc index was used for ranking pre-filters in the old
-- retrieval code. With retrieval owned by skills.sh, it has no callers.
drop index if exists public.skills_catalog_installs;
