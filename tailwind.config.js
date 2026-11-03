/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#e7eae5', 100: '#c7d0d6', 600: '#2557ff', 700: '#5c7dff', 800: '#0e1524', 900: '#161f33' },
        gold: { 100: '#f7eadb', 300: '#e4b77e', 500: '#c98a3e', 600: '#a96d27' },
      },
      fontFamily: { serif: ['Nunito', 'sans-serif'] },
    },
  },
  plugins: [],
}
