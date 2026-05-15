import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiAdminProxy } from './vite-plugins/api-admin';
import { apiCompleteProxy } from './vite-plugins/api-complete';
import { apiLogEventProxy } from './vite-plugins/api-log-event';
import { tailwindConfigHmr } from './vite-plugins/tailwind-config-hmr';

// Dev: `npm run dev` (just `vite`).
//   - apiCompleteProxy handles /api/complete inline (no `netlify dev` wrapper).
//   - tailwindConfigHmr makes tailwind.config.js edits hot-reload in ~100ms.
// Prod: built dist/ is served by Netlify; /api/complete hits netlify/functions/complete.ts.
export default defineConfig({
  // Relative base so built asset URLs resolve correctly when the app is
  // proxied at a sub-path (e.g. mikemake.com/skillprism/) as well as at root.
  base: './',
  plugins: [react(), apiCompleteProxy(), apiLogEventProxy(), apiAdminProxy(), tailwindConfigHmr()],
  server: {
    port: 5173,
    watch: {
      // Ignore sibling git worktrees under .claude/worktrees/ — their own
      // tsconfig/source edits would otherwise trigger spurious reloads here.
      ignored: ['**/.claude/worktrees/**'],
    },
  },
});
