import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#f7f8f0',
        header: '#355872',
        aside: '#d7e5ee',
        panel: '#fcfdff',
        ink: '#102132',
        line: 'rgba(16, 33, 50, 0.14)',
        highlight: '#d96b2b',
        success: '#2b7d56',
        danger: '#b64242',
        muted: '#61788d',
      },
      borderRadius: {
        panel: '14px',
      },
      boxShadow: {
        panel: '0 24px 80px rgba(16, 33, 50, 0.12)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Noto Sans SC', 'sans-serif'],
        display: ['Space Grotesk', 'IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(16, 33, 50, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 33, 50, 0.05) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config