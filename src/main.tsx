import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Display typefaces — load all variants up front so the typeface dropdown
// can switch instantly. Keep in sync with src/lib/fontConfig.ts.
// roboto-flex/full.css carries wdth+wght+opsz; the other two only ship
// wdth+wght via standard.css (no opsz axis on disk).
import '@fontsource-variable/roboto-flex/full.css';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/anybody/standard.css';
import App from './App';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
