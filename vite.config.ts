import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `netlify dev` wraps Vite and forwards /api/* to functions via netlify.toml redirects.
// For pure-Vite (`npm run dev:vite`) without the function, calls to /api/* will 404 —
// run `npm run dev` (which uses `netlify dev`) for the full local stack.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
