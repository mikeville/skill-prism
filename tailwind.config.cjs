/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      paper: 'var(--c-paper)',
      'fill-page': 'var(--c-fill-page)',
      ink: 'var(--c-ink)',
      'ink-mut': 'var(--c-ink-mut)',
      'ink-faint': 'var(--c-ink-faint)',
      line: 'var(--c-paper)',
      'line-meta': 'var(--c-line-meta)',
      'line-cell': 'var(--c-line-cell)',
    },
    fontFamily: {
      // Inter is the default for UI chrome, body copy, and the insight pane.
      // Anybody is applied inline at its two homes — grid cell display text
      // (both poster and plain modes, via ANYBODY.family) and the SKILL PRISM
      // wordmark (Topbar + EmptyState). Static UI weights are set via
      // font-variation-settings (see globals.css body); display-mode grid
      // text sets its own variation settings inline.
      sans: ['"Inter Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    fontSize: {
      // Inter UI/prose ladder — three tokens cover the whole non-grid app.
      // `meta` = small UI labels (topbar, breadcrumb, kind labels, error
      // states); `body` = insight pane prose, move titles, move actions;
      // `display` = insight term heading + EmptyState input.
      meta: ['9px', { lineHeight: '1.3' }],
      body: ['13px', { lineHeight: '1.3', letterSpacing: '-.02rem' }],
      display: ['20px', { lineHeight: '1.2' }],
      // Grid system (Anybody, plain mode) — a separate ladder owned by
      // Cell.tsx. Poster-mode grid sizing is owned by the fit hook
      // (src/lib/fitText.ts SIZE_MAX_BY_TIER), not Tailwind. Do not merge
      // these with the Inter ladder above.
      'plain-other': ['14px', { lineHeight: '0.9' }],
      'plain-other-md': ['clamp(11px, 1.6vw, 18px)', { lineHeight: '0.9' }],
    },
    fontWeight: {
      regular: '400',
      tertiary: '400',
      meta: '400',
      secondary: '600',
      primary: '800',
    },
    screens: {
      md: '769px',
    },
    extend: {
      // Neutral palette + accents used by the /admin dashboard only.
      // Kept here (rather than in theme.colors) so the home page palette
      // (paper / ink / line-*) is untouched.
      colors: {
        white: '#ffffff',
        black: '#000000',
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          900: '#171717',
        },
        red: {
          50: '#fef2f2',
          200: '#fecaca',
          600: '#dc2626',
          700: '#b91c1c',
        },
        green: {
          100: '#dcfce7',
          700: '#15803d',
        },
        orange: {
          100: '#ffedd5',
          700: '#c2410c',
          800: '#9a3412',
        },
      },
      borderWidth: {
        cell: '1px',
        block: '2px',
      },
      transitionTimingFunction: {
        zoom: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        zoom: '380ms',
        hover: '120ms',
      },
      keyframes: {
        skeleton: {
          '0%, 100%': { backgroundColor: 'rgba(0,0,0,0.04)' },
          '50%': { backgroundColor: 'rgba(0,0,0,0.10)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        skeleton: 'skeleton 1.2s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
