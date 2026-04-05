/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fredoka', 'ui-sans-serif', 'system-ui'], // your local font
      },
    },
  },
  plugins: [],
}