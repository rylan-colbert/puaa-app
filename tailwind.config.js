/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        pigmatch: {
          earth: '#5C4033',
          forest: '#2D5016',
          bark: '#8B5E3C',
          sage: '#9CAF88',
          cream: '#F5F0E8',
        },
      },
    },
  },
  plugins: [],
}
