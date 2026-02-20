import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        "surface-dark": "#1a2632",
        // Semantic neutral colors for button variants (outline, secondary, ghost)
        neutral: {
          border: 'rgb(var(--color-neutral-border) / <alpha-value>)',
          text: 'rgb(var(--color-neutral-text) / <alpha-value>)',
          'text-strong': 'rgb(var(--color-neutral-text-strong) / <alpha-value>)',
          bg: 'rgb(var(--color-neutral-bg) / <alpha-value>)',
          'bg-hover': 'rgb(var(--color-neutral-bg-hover) / <alpha-value>)',
        },
        link: 'rgb(var(--color-link-text) / <alpha-value>)',
        // Semantic colors via CSS variables - auto-switch for admin/customer & light/dark
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--color-error) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
          hover: 'rgb(var(--color-error-hover) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
          hover: 'rgb(var(--color-success-hover) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
          hover: 'rgb(var(--color-warning-hover) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--color-bg-surface-variant) / <alpha-value>)',
          foreground: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        ring: 'rgb(var(--color-primary) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-bg-surface) / <alpha-value>)',
          variant: 'rgb(var(--color-bg-surface-variant) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config