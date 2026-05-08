/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      paper: 'var(--c-paper)',
      'fill-secondary': '#fcfcfc',
      'fill-tertiary': '#f7f7f7',
      'fill-page': 'var(--c-fill-page)',
      ink: 'var(--c-ink)',
      'ink-mut': 'var(--c-ink-mut)',
      'ink-faint': 'var(--c-ink-faint)',
      line: 'var(--c-paper)',
      'line-meta': 'var(--c-line-meta)',
    },
    fontFamily: {
      // Anybody is the only font in use across the app — same family for body
      // copy, UI labels, and grid display text. Static UI weights are set via
      // font-variation-settings (see globals.css body); display-mode grid text
      // sets its own variation settings inline.
      sans: ['"Anybody Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    fontSize: {
      meta: ['12px', { lineHeight: '1.4' }],
      tertiary: ['12px', { lineHeight: '1.25' }],
      secondary: ['16px', { lineHeight: '1.25' }],
      primary: ['20px', { lineHeight: '1.2' }],
      input: ['20px', { lineHeight: '1.2' }],
      // Plain mode (uppercase, body-copy-like) — only two sizes: the focal
      // primary cell is larger than every other cell. Sized so common
      // 9–11 char uppercase words fit at conventional weight/width.
      'plain-other': ['14px', { lineHeight: '0.9' }],
      'plain-other-md': ['18px', { lineHeight: '0.9' }],
      'plain-primary': ['24px', { lineHeight: '0.9' }],
      'plain-primary-md': ['44px', { lineHeight: '0.9' }],
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
