/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: '#0078D4',
        success: '#107C10',
        warning: '#FF8C00',
        danger:  '#D13438',
      }
    },
  },
  plugins: [],
}