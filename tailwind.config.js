/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mapped to logo colors — same names, new values
        'forest':       '#1B3B6F',   // Navy blue (CGA letters)
        'forest-light': '#2B4F8C',   // Lighter navy
        'forest-dark':  '#0F2347',   // Darker navy
        'gold':         '#E8861A',   // Orange (eagle beak/talons)
        'gold-light':   '#F0A040',   // Lighter orange
        'gold-dark':    '#C4700F',   // Darker orange
        'cream':        '#F0F4FA',   // Cool off-white (light navy tint)
        'charcoal':     '#1A1E2E',   // Dark navy-charcoal
        'offwhite':     '#EEF2FA',   // Light background
        'darktext':     '#1B1B2E',   // Near-black with blue tint
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
