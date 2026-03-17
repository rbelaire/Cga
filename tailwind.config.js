/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'forest':       '#1B3B6F',   // Navy blue (primary)
        'forest-light': '#2B4F8C',   // Lighter navy
        'forest-dark':  '#0F2347',   // Darker navy
        'gold':         '#C9A84C',   // Amber gold (eagle accent)
        'gold-light':   '#D4B44A',   // Lighter gold
        'gold-dark':    '#A88935',   // Darker gold
        'cream':        '#F2F2F2',   // Light grey background
        'charcoal':     '#1C1C1C',   // Near-black
        'offwhite':     '#FFFFFF',   // White
        'darktext':     '#1A1A1A',   // Black text
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
