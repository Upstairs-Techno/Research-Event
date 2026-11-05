/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#fff4e8', 100: '#ffe4c7', 200: '#f4d2ad', 600: '#e85d04', 700: '#c94d00', 800: '#38271c', 900: '#29211c', 950: '#211912' },
        gold: { 100: '#fff4dc', 300: '#edc982', 500: '#b98220', 600: '#946414' },
      },
      fontFamily: { serif: ['Manrope', 'sans-serif'] },
    },
  },
  plugins: [],
}
