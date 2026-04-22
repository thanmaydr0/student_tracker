import type { Config } from 'tailwindcss'

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        risk: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#ef4444'
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          DEFAULT: '#ffffff'
        }
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 4px 16px -2px rgb(0 0 0 / 0.06)'
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
} satisfies Config
