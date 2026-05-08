# Skill Prism

A fractal topic browser and learning tool. Type a topic, Claude returns a Harada-style 9×9 decomposition: 8 main sub-skills around the centre, 8 sub-sub-skills under each. Tap any cell to descend into it; the next decomposition takes its place. The URL hash tracks where you are, so every drill-down is a shareable link.

## Typography notes

- **One typeface (Anybody Variable) handles every label** through its variable axes. Each grid cell binary-searches `wdth → wght → fontSize` until the text fills the cell — flush left and right, flush top and bottom — then applies letter-spacing to soak up any remaining horizontal slack.
- **Cap-to-baseline trim** (`text-box-trim: cap alphabetic`) snaps grid text against cell edges with no whitespace gap.
- **Syllable-aware hyphenation** for long words. TeX patterns first; when the dictionary gives a lopsided result on a compound it doesn't know (e.g. `WEIGHTLIFT-ING`), a scoring fallback prefers natural English onsets and balanced midpoints (`WEIGHT-LIFTING`). Code lives in [src/lib/fitText.ts](src/lib/fitText.ts).
- **Plain mode and poster mode** ship together — same content, different rhetorical register.

## Stack

- Vite + React 18 + TypeScript
- Tailwind for utilities
- Hash-routed paths (`#/segment-1/segment-2`) for shareable URLs and browser back/forward
- Netlify Function for the `/api/complete` proxy to the Anthropic API
- LocalStorage cache (per-user, atomically versioned)

## Local development

Prereqs: Node 20+, an Anthropic API key.

```bash
cp .env.example .env       # then paste your key
npm install
npm run dev                # Vite + inline /api/complete proxy on http://localhost:5173
```

`npm run dev:netlify` runs the same app under `netlify dev` on port 8888 for full Netlify Functions parity. Day-to-day, plain `npm run dev` is faster and identical for everything except function-runtime quirks.

## Scripts

|                       |                                                          |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Vite + inline API proxy. Port 5173.                      |
| `npm run dev:netlify` | Local dev under `netlify dev`. Port 8888.                |
| `npm run build`       | Type-check + Vite build → `dist/`.                       |
| `npm run preview`     | Serve the built bundle.                                  |
| `npm run typecheck`   | `tsc --noEmit`.                                          |
| `npm run format`      | Prettier write across the repo.                          |

## Project layout

```
src/
  App.tsx                       # root: route → view selection
  main.tsx                      # ReactDOM mount
  types.ts                      # CellStatus, Breakdown, Path
  components/
    EmptyState/                 # landing input + examples
    Topbar/                     # breadcrumb + path controls
    FractalView/                # 9×9 grid + zoom-from-cell animation
    Cell/                       # cell rendering + multi-line fit hookup
    SkillSidebar/               # dormant: future export-as-Claude-skill flow
  hooks/
    useBreakdown.ts             # cache lookup → API call → stale-request guard
    usePath.ts                  # window.location.hash ↔ string[]
    useContainerDepth.ts        # depth context for nested fractal levels
    useFitText.ts               # imperative hook around fitText.ts
  lib/
    api.ts                      # POST /api/complete; returns Breakdown
    prompt.ts                   # buildPrompt({ topic, path }) → string
    cache.ts                    # localStorage cacheGet/cacheSet w/ v1 prefix
    fitText.ts                  # multi-line cell fit + hyphenation scoring
    fontConfig.ts               # active typeface + variable-axis presets
    gridTracks.ts               # shared track templates (Level, FractalView)
    anthropicPricing.ts         # list pricing for usage-log cost estimates
    exportSkill.ts              # dormant: skill-markdown emitter
  styles/
    globals.css                 # reset, palette CSS vars, font import

netlify/
  functions/
    complete.ts                 # /api/complete handler — dev + prod

vite-plugins/
  api-complete.ts               # mirrors complete.ts inside the Vite dev server
  tailwind-config-hmr.ts        # hot-reload tailwind.config.cjs edits
```

`SkillSidebar` and `lib/exportSkill.ts` are intentionally dormant — scaffolding for a future "export this branch as a Claude skill" flow, signposted but not wired into the UI.

## Caching

Per-user localStorage, keyed by the path JSON string with prefix
`skill-prism:cache:v1:`. To inspect: DevTools → Application → Local Storage. To
clear: `import { cacheClear } from './lib/cache'` then call it (or remove keys
manually in DevTools).

Bump the prefix in `src/lib/cache.ts` when the breakdown shape changes — old
data is then orphaned and ignored automatically.

## Usage logging

The Netlify function logs every Anthropic call:

- **Always** to stdout (visible in Netlify function logs in production)
- **Only when running locally via `netlify dev`** also to `usage.jsonl` in the project root

Each line is JSON with `ts`, `model`, `topic`, `input_tokens`, `output_tokens`, and a rough `estimated_cost_usd`.

```bash
# Total local spend so far:
cat usage.jsonl | jq -s 'map(.estimated_cost_usd) | add'
```

The estimate uses list pricing in [src/lib/anthropicPricing.ts](src/lib/anthropicPricing.ts), shared between the Netlify function and the Vite dev plugin. The canonical billing is in the Anthropic console.

## Deploy (Netlify)

1. Connect the repo in the Netlify dashboard.
2. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in **Site settings → Environment variables**.
3. Default model is `claude-haiku-4-5-20251001` (cheapest).
4. Build command and publish dir come from `netlify.toml`.

## License

[MIT](LICENSE).
