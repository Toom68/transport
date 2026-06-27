/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cabin: {
          dark: '#e8e0d0',
          panel: '#faf6ee',
          accent: '#0284c7',
          gold: '#d97706',
          dim: '#ddd4c0',
          border: '#c4b89e',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 8px rgba(14,165,233,0.06)',
        'panel': '0 2px 16px rgba(14,165,233,0.06)',
        'glow': '0 0 20px rgba(14,165,233,0.12)',
        'glow-gold': '0 0 20px rgba(251,146,60,0.12)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shine': 'shine 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shine: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
