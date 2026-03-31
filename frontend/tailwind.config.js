/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",        // main background
        card: "#111111",      // cards / panels
        border: "#222222",    // borders

        primary: "#e5e5e5",   // main text (almost white)
        secondary: "#9ca3af", // muted text

        success: "#10b981",   // green
        warning: "#f59e0b",   // yellow
        danger: "#ef4444"     // red
      }
    },
  },
  plugins: [],
};