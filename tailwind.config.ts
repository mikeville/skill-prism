import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      paper: '#ffffff',
      ink: '#111111',
      'ink-mut': 'rgba(17,17,17,0.55)',
      'ink-faint': 'rgba(17,17,17,0.25)',
      gold: {
        primary: '#ffd700',
        secondary: '#fff2ab',
      },
      tan: '#cbc6ae',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
    },
    fontSize: {
      meta: ['11px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
      tertiary: ['10px', { lineHeight: '1.25' }],
      'tertiary-d': ['12px', { lineHeight: '1.25' }],
      secondary: ['13px', { lineHeight: '1.25' }],
      'secondary-d': ['16px', { lineHeight: '1.25' }],
      primary: ['18px', { lineHeight: '1.2' }],
      'primary-d': ['22px', { lineHeight: '1.2' }],
      input: ['20px', { lineHeight: '1.2' }],
    },
    fontWeight: {
      tertiary: '500',
      secondary: '600',
      primary: '800',
      meta: '500',
      regular: '400',
    },
    screens: {
      md: '769px',
    },
    extend: {
      borderWidth: {
        cell: '2px',
        block: '8px',
      },
      divideWidth: {
        cell: '2px',
        block: '8px',
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
} satisfies Config;
