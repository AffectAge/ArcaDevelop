/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arc: {
          bg: "var(--arc-color-bg)",
          panel: "var(--arc-color-panel)",
          soft: "var(--arc-color-panel-soft)",
          accent: "var(--arc-color-gold)",
          muted: "var(--arc-color-text-muted)",
        },
      },
      boxShadow: {
        neon: "0 0 0 1px color-mix(in srgb, var(--arc-color-gold) 45%, transparent), 0 0 30px color-mix(in srgb, var(--arc-color-gold) 22%, transparent)",
      },
      fontFamily: {
        display: ["var(--arc-font-display)"],
        body: ["var(--arc-font-body)"],
      },
    },
  },
  plugins: [],
};
