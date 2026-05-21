# Skill Prism

A fractal topic browser and learning tool. Type a topic, Claude returns a Harada-style 9×9 decomposition: 8 main sub-skills around the centre, 8 sub-sub-skills under each. Tap any cell to descend into it; the next decomposition takes its place. The URL hash tracks where you are, so every drill-down is a shareable link. Each cell has a "now what?" affordance that surfaces three concrete first moves toward mastering the term — a book, a course, a person to follow, a site — drawn from a thoughtful-practitioner frame.

## Typography notes

- **One typeface (Anybody Variable) handles every label** through its variable axes. Each grid cell binary-searches `wdth → wght → fontSize` until the text fills the cell — flush left and right, flush top and bottom — then applies letter-spacing to soak up any remaining horizontal slack.
- **Cap-to-baseline trim** (`text-box-trim: cap alphabetic`) snaps grid text against cell edges with no whitespace gap.
- **Syllable-aware hyphenation** for long words. TeX patterns first; when the dictionary gives a lopsided result on a compound it doesn't know (e.g. `WEIGHTLIFT-ING`), a scoring fallback prefers natural English onsets and balanced midpoints (`WEIGHT-LIFTING`). Code lives in [src/lib/fitText.ts](src/lib/fitText.ts).
- **Plain mode and poster mode** ship together — same content, different rhetorical register.

## The insight pipeline

Clicking the "now what?" icon on any cell opens a side panel with a one-sentence framing of what mastery of the term requires, plus exactly three first moves. Behind the panel is a two-stage pipeline designed to fight a specific failure mode: scope drift.

- **Stage 1 (parallel):** a scope-trap classifier ([src/lib/subDisciplinePrompt.ts](src/lib/subDisciplinePrompt.ts)) lists named sub-disciplines *within* the topic and *adjacent* disciplines whose canonical resources commonly get mis-recommended for it. In parallel, the generation prompt ([src/lib/insightPrompt.ts](src/lib/insightPrompt.ts)) runs and streams partial moves into the UI.
- **Stage 2 (conditional):** a lightweight heuristic ([src/lib/insightApi.ts](src/lib/insightApi.ts)) checks generated titles against the trap lists. If anything looks suspicious, an adversarial editor pass ([src/lib/critiquePrompt.ts](src/lib/critiquePrompt.ts)) audits all three moves for scope failures and replaces any that fail.

The trade is a small drop in average generation quality (it runs without yet knowing the trap list) for a faster perceived response, with the critique pass as the safety net.

## Stack

- Vite + React 18 + TypeScript
- Tailwind for utilities
- Hash-routed paths (`#/segment-1/segment-2`) for shareable URLs and browser back/forward
- Netlify Functions (v2 / Web Fetch) proxy `/api/complete` and `/api/insight` to Anthropic, streaming SSE through
- LocalStorage cache on the client; optional Supabase-backed cache + analytics on the server (gated on env vars)

## Local development

Prereqs: Node 20+, an Anthropic API key. Supabase is optional — the app runs without it, just without the server-side cache or admin dashboard.

```bash
cp .env.example .env       # then paste your Anthropic key
npm install
npm run dev                # Vite + inline API proxies on http://localhost:5173
```

`npm run dev:netlify` runs the same app under `netlify dev` on port 8888 for full Netlify Functions parity. Day-to-day, plain `npm run dev` is faster and identical for everything except function-runtime quirks.

## Scripts

|                       |                                                          |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Vite + inline API proxies. Port 5173.                    |
| `npm run dev:netlify` | Local dev under `netlify dev`. Port 8888.                |
| `npm run build`       | Type-check + Vite build → `dist/`.                       |
| `npm run preview`     | Serve the built bundle.                                  |
| `npm run typecheck`   | `tsc --noEmit`.                                          |
| `npm run format`      | Prettier write across the repo.                          |

## Project layout

```
src/
  App.tsx                       # root: route → view selection (empty / mobile / desktop / admin)
  main.tsx                      # ReactDOM mount
  types.ts                      # CellStatus, Breakdown, Path
  components/
    EmptyState/                 # landing input + examples
    Topbar/                     # breadcrumb + path controls + color picker
    FractalView/                # 9×9 grid + zoom-from-cell animation (Level recursion)
    Cell/                       # cell rendering + multi-line fit hookup + skeletons
    Insight/                    # "now what?" side panel + streaming content render
    Export/                     # SVG / PNG / PDF export panel and canvas
    Admin/                      # /admin dashboard: gate, stats, drill-down tree, event list
    SkillSidebar/               # dormant: future export-as-Claude-skill flow
  contexts/
    ColorTheme.tsx              # palette selection persisted to localStorage
    TypeMode.tsx                # plain vs poster mode
    Animating.tsx               # zoom-animation flag exposed as a getter
  hooks/
    useBreakdown.ts             # cache lookup → API call → stale-request guard
    useInsight.ts               # same shape for insight payloads, per-term cache key
    usePath.ts                  # window.location.hash ↔ string[]
    useContainerDepth.ts        # depth context for nested fractal levels
    useGridDimensions.ts        # shared cell-size math (empty state ↔ active grid)
    useFitText.ts               # imperative hook around fitText.ts
  lib/
    api.ts                      # POST /api/complete; streaming + non-streaming
    streamSse.ts                # SSE client with non-SSE fallback
    prompt.ts                   # buildPrompt({ topic, path }) → string
    insightApi.ts               # orchestrates the two-stage insight pipeline
    insightPrompt.ts            # main insight generation prompt
    subDisciplinePrompt.ts      # scope-trap classifier prompt
    critiquePrompt.ts           # adversarial editor prompt
    insightCache.ts             # localStorage cache for insight payloads
    cache.ts                    # localStorage cache for breakdowns (v1 prefix)
    fitText.ts                  # multi-line cell fit + hyphenation scoring
    fontConfig.ts               # active typeface + variable-axis presets
    gridTracks.ts               # shared track templates (Level, FractalView)
    themes.ts                   # palette definitions
    anthropicPricing.ts         # list pricing for usage-log cost estimates
    logEvent.ts                 # client-side event logger (sendBeacon)
    session.ts                  # per-tab session ID
    exportSkill.ts              # dormant: skill-markdown emitter
    export/                     # SVG/PNG/PDF capture + font embedding pipeline
  styles/
    globals.css                 # reset, palette CSS vars, font import

netlify/
  functions/
    complete.ts                 # /api/complete handler — dev + prod, streaming
    insight.ts                  # /api/insight handler — streaming
    log-event.ts                # /api/log-event — cache-hit logging from the client
    admin-*.ts                  # /admin dashboard endpoints (login, me, sessions, events, stats)
  lib/
    handleSearch.ts             # shared cache → Anthropic → DB pipeline
    handleLogEvent.ts           # shared cache-hit log path
    db.ts                       # Supabase client + typed wrappers
    auth.ts                     # HMAC-signed admin cookie

vite-plugins/
  api-complete.ts               # mirrors complete.ts inside the Vite dev server
  api-insight.ts                # mirrors insight.ts
  api-log-event.ts              # mirrors log-event.ts
  api-admin.ts                  # mirrors the admin endpoints
  tailwind-config-hmr.ts        # hot-reload tailwind.config.cjs edits
```

`SkillSidebar` and `lib/exportSkill.ts` are intentionally dormant — scaffolding for a future "export this branch as a Claude skill" flow, signposted but not wired into the UI.

## Caching

Two layers, both optional independently:

1. **Per-user localStorage**, keyed by the path JSON string with prefix `skill-prism:cache:v1:`. Inspect via DevTools → Application → Local Storage. To clear: `import { cacheClear } from './lib/cache'` then call it. Bump the prefix in [src/lib/cache.ts](src/lib/cache.ts) when the breakdown shape changes — old data is then orphaned and ignored automatically.
2. **Shared Supabase cache** (server-side), gated on `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`. When configured, the Netlify function checks for a cached breakdown for the current `(model, path)` before calling Anthropic, with a TTL controlled by `CACHE_TTL_DAYS` (default 30, set to 0 to disable temporarily). Without those env vars, the server cache is silently off and only localStorage is used.

Insight payloads are localStorage-only — keyed by term alone, so revisiting a term via a different path is free.

## Usage logging

The Netlify function logs every Anthropic call:

- **Always** to stdout — both a human-readable line and a JSON line per call (visible in Netlify function logs in production, and in your shell during `netlify dev`).
- **When Supabase is configured**, the same metadata is persisted to the `breakdowns` and `searches` tables for the admin dashboard.

Each log line includes `ts`, `model`, `topic`, `input_tokens`, `output_tokens`, and a rough `estimated_cost_usd`. The estimate uses list pricing in [src/lib/anthropicPricing.ts](src/lib/anthropicPricing.ts), shared between the Netlify function and the Vite dev plugin. The canonical billing is in the Anthropic console.

## Admin dashboard

Visit `/admin` in dev or prod. Paste the value of `ADMIN_TOKEN` to authenticate; an HMAC-signed httpOnly cookie keeps the session for repeat visits. The dashboard surfaces aggregate counters, a sparkline, a drill-down tree of recent searches, and a paginated event list. All data sources are the Supabase tables — without Supabase configured, the dashboard is unavailable.

## Deploy (Netlify)

1. Connect the repo in the Netlify dashboard.
2. Set environment variables in **Site settings → Environment variables**:
   - `ANTHROPIC_API_KEY` (required)
   - `ANTHROPIC_MODEL` (optional; default `claude-haiku-4-5-20251001`)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (optional; enables server cache + dashboard)
   - `ADMIN_TOKEN` (required to use `/admin` when Supabase is set)
   - `CACHE_TTL_DAYS` (optional; default 30)
3. Build command and publish dir come from `netlify.toml`.

## License

[MIT](LICENSE).
