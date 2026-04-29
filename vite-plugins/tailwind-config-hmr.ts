// Vite caches the PostCSS-transformed output of CSS modules and only invalidates
// when the CSS file itself changes — not when tailwind.config.cjs does. So edits
// to the design tokens trigger a browser reload, but the browser re-fetches the
// same stale CSS bytes.
//
// This plugin watches tailwind.config.cjs and invalidates all CSS modules in the
// graph on change. Result: the next request runs PostCSS fresh, Tailwind reads
// the new config (its own mtime cache catches the change), and new CSS lands in
// the browser within ~100ms — no process restart, no netlify wrapper, no 7s wait.

import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function tailwindConfigHmr(): Plugin {
  const configFile = resolve(process.cwd(), 'tailwind.config.cjs');

  return {
    name: 'tailwind-config-hmr',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(configFile);
      server.watcher.on('change', (file) => {
        if (file !== configFile) return;
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          if (mod.id && /\.css(\?|$)/.test(mod.id)) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
        server.ws.send({ type: 'full-reload', path: '*' });
      });
    },
  };
}
