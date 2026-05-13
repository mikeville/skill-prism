-- Skill Prism initial schema.
-- Run this once in your Supabase SQL Editor (or via `supabase db push` if using the CLI).

-- ----------------------------------------------------------------------
-- breakdowns: the result cache + cost ledger.
-- One row per unique (model, path) pair. Cache hits read; misses insert.
-- ----------------------------------------------------------------------
create table if not exists public.breakdowns (
  id              uuid primary key default gen_random_uuid(),
  model           text not null,
  path            text[] not null,
  -- path joined with U+241E by the application before insert. Used for the
  -- cache lookup; kept as a plain column (not generated) so we don't depend
  -- on array_to_string being marked IMMUTABLE on every Postgres version.
  path_key        text not null,
  result          jsonb not null,
  input_tokens    int not null,
  output_tokens   int not null,
  cost_usd        numeric(10, 6) not null default 0,
  created_at      timestamptz not null default now()
);

create unique index if not exists breakdowns_cache_key
  on public.breakdowns (model, path_key);

create index if not exists breakdowns_created_at
  on public.breakdowns (created_at desc);

-- ----------------------------------------------------------------------
-- searches: every user-facing search event (cache hit OR miss).
-- ----------------------------------------------------------------------
create table if not exists public.searches (
  id              uuid primary key default gen_random_uuid(),
  ts              timestamptz not null default now(),
  session_id      uuid not null,
  path            text[] not null,
  breakdown_id    uuid not null references public.breakdowns(id) on delete cascade,
  cache_hit       boolean not null,
  depth           int not null,
  ip              text,
  country         text,
  city            text,
  user_agent      text,
  referrer        text
);

create index if not exists searches_ts on public.searches (ts desc);
create index if not exists searches_session on public.searches (session_id, ts);
create index if not exists searches_path on public.searches using gin (path);

-- ----------------------------------------------------------------------
-- Row-level security: data is accessed via the service_role key from
-- Netlify Functions only. Lock down direct anon/authenticated access.
-- ----------------------------------------------------------------------
alter table public.breakdowns enable row level security;
alter table public.searches   enable row level security;
-- No policies => no rows visible to non-service roles. The service_role
-- key used by Netlify Functions bypasses RLS by design.

-- ----------------------------------------------------------------------
-- Grants: service_role (used by Netlify Functions) needs explicit
-- table-level privileges. If the Supabase project was created with
-- "Automatically expose new tables" UNCHECKED, these grants don't happen
-- by default, so we set them here explicitly.
-- ----------------------------------------------------------------------
grant all on public.breakdowns to service_role;
grant all on public.searches   to service_role;
