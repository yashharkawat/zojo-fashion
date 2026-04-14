import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          overlay: 'rgb(var(--bg-overlay) / <alpha-value>)',
          border: 'rgb(var(--bg-border) / <alpha-value>)',
        },
        fg: {
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
        },
        pink: 'rgb(var(--pink) / <alpha-value>)',
        cyan: 'rgb(var(--cyan) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 32px rgb(255 69 0 / 0.35)',
        'glow-sm': '0 0 16px rgb(255 69 0 / 0.25)',
        'glow-lg': '0 0 64px rgb(255 69 0 / 0.4)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 16px rgb(255 69 0 / 0.25)' },
          '50%':      { boxShadow: '0 0 32px rgb(255 69 0 / 0.55)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
