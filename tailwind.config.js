/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'forest': '#0B3D2C',
        'gold': '#C8A951',
        'cream': '#FAF7F0',
        'charcoal': '#1A1A1A',
        'offwhite': '#F5F5F0',
        'darktext': '#2D2D2D',
        'forest-light': '#145238',
        'forest-dark': '#072318',
        'gold-light': '#D4BC72',
        'gold-dark': '#A88A3A',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
