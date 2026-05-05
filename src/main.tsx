import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Display typeface — keep in sync with src/lib/fontConfig.ts FONT_CONFIG
// and tailwind.config.cjs `display` family stack.
import '@fontsource-variable/roboto-flex/full.css';
import App from './App';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
