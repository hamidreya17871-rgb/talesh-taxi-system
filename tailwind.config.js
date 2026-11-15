/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#e5f4ee',
          100: '#edf4f1',
          200: '#c2e3d6',
          300: '#8fcbb4',
          400: '#4fa88b',
          500: '#2a8a71',
          600: '#176b57',
          700: '#135648',
          800: '#123b35',
          900: '#0c2a25',
        },
        gold: {
          100: '#fff4dc',
          300: '#f0d08f',
          400: '#e8b75a',
          700: '#94650d',
        },
        ink: {
          50: '#f8faf9',
          100: '#f3f6f5',
          200: '#e0e8e5',
          300: '#d8e2de',
          600: '#5b6d68',
          900: '#182b28',
        },
        error: {
          50: '#fff0f0',
          100: '#ffeded',
          500: '#b94343',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pop-in': 'pop-in 0.25s ease-out',
        'toast-in': 'toast-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
