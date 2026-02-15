/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
        body: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
      colors: {
        puaa: {
          cream: '#F5F5F7',
          surface: '#FAFAFA',
          earth: '#374151',
          forest: '#2D4A27',
          bark: '#1F2937',
          sage: '#9CAF88',
        },
      },
    },
  },
  plugins: [],
}
