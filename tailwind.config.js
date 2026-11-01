/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#f5f0ff', 100: '#e9dcff', 600: '#5b21b6', 700: '#4c1d95', 800: '#3b0f7a', 900: '#2a0a57' },
        gold: { 100: '#f8efc7', 300: '#e6c65a', 500: '#c9a227', 600: '#a8861c' },
      },
      fontFamily: { serif: ['"Playfair Display"', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
}
