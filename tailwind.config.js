/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#edf7ff', 100: '#d9edff', 600: '#087fc4', 700: '#075da8', 800: '#061331', 900: '#02091d' },
        gold: { 100: '#e4faff', 300: '#83eaff', 500: '#00c8ef', 600: '#009ecb' },
      },
      fontFamily: { serif: ['"Playfair Display"', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
}
