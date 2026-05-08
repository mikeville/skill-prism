# Skill Prism

A fractal topic browser. Type a topic → Claude returns a Harada-style 9×9
decomposition. Click any cell to drill in.

## Stack

- Vite + React 18 + TypeScript
- CSS Modules
- Hash-routed paths (`#/segment-1/segment-2`) for shareable URLs and browser back/forward
- Netlify Function for the `/api/complete` proxy
- LocalStorage cache (per-user)

## Local development

Prereqs: Node 20+, an Anthropic API key.

```bash
cp .env.example .env       # then paste your key
npm install
npm run dev                # netlify dev → Vite + the function on http://localhost:8888
```

Press `?` anywhere outside an input to toggle the Tweaks panel.

`npm run dev:vite` runs Vite alone (no `/api/complete` — the empty state will work but searches will 404).

## Scripts

|                     |                                                           |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Local dev via `netlify dev` (Vite + function). Port 8888. |
| `npm run build`     | Type-check + Vite build → `dist/`.                        |
| `npm run preview`   | Serve the built bundle.                                   |
| `npm run typecheck` | `tsc --noEmit`.                                           |
| `npm run format`    | Prettier write across the repo.                           |

## Project layout

```
src/
  App.tsx                       # root: navigation + tweaks UI
  main.tsx                      # ReactDOM mount
  types.ts                      # CellStatus, Breakdown, Path, TweakValues
  components/
    EmptyState.tsx              # landing input + examples
    Breadcrumb.tsx              # path with PATH/regenerating
    HaradaGrid.tsx              # 9×9 grid + GridCell + GridLines (one family)
    tweaks/
      TweaksPanel.tsx           # floating panel shell, draggable + dismissable
      controls.tsx              # TweakSection/Slider/Radio/Select/Toggle/Color
  hooks/
    useBreakdown.ts             # cache lookup → API call → stale-request guard
    usePath.ts                  # window.location.hash ↔ string[]
    useTweaks.ts                # localStorage-backed tweak values + FONT_STACKS
    useTweaksPanelOpen.ts       # `?` keystroke gate, persisted
  lib/
    api.ts                      # POST /api/complete; returns Breakdown
    cache.ts                    # localStorage cacheGet/cacheSet w/ v1 prefix
    gridMapping.ts              # blockCellToRC, MAIN_TO_BLOCK, classifyCell
    prompt.ts                   # buildPrompt({ topic, path }) → string
  styles/
    globals.css                 # reset, font import, @keyframes

netlify/
  functions/
    complete.ts                 # /api/complete handler — dev + prod

_prototype/                     # original Babel-in-browser sketch (reference only)
```

## Deploy (Netlify)

1. Connect the repo in the Netlify dashboard
2. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in **Site settings → Environment variables**
3. Default model is `claude-haiku-4-5-20251001` (cheapest)
4. Build command and publish dir come from `netlify.toml`

## Caching

Per-user localStorage, keyed by the path JSON string with prefix
`skill-prism:cache:v1:`. To inspect: DevTools → Application → Local Storage. To
clear: `import { cacheClear } from './lib/cache'` then call it (or remove keys
manually in DevTools).

Bump the prefix in `src/lib/cache.ts` when the breakdown shape changes.

## Usage logging

The Netlify function logs every Anthropic call:

- **Always** to stdout (visible in Netlify function logs in production)
- **Only when running locally via `netlify dev`** also to `usage.jsonl` in the
  project root

Each line is JSON with `ts`, `model`, `topic`, `input_tokens`,
`output_tokens`, and a rough `estimated_cost_usd`.

```bash
# Total local spend so far:
cat usage.jsonl | jq -s 'map(.estimated_cost_usd) | add'
```

The estimate uses list pricing in `netlify/functions/complete.ts`; the
canonical billing is in the Anthropic console.

## Reference: the original prototype

The pre-migration prototype lives in `_prototype/`. It's a single-page sketch
made in Claude Design — Babel-standalone, UMD React, JSX files loaded via
`<script type="text/babel">`, and a Node proxy server. Kept for reference and
visual comparison; not run directly.
