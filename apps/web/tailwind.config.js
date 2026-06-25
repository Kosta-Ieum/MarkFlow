/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#F6F5F1",
        canvas: "#F1EFEA",
        surface: "#FBFAF7",
        ink: "#171614",
        secondary: "#5C5950",
        muted: "#A6A299",
        line: { DEFAULT: "#E4E1D9", sub: "#EFEDE6" },
        brand: { DEFAULT: "#10A36B" },
        error: { DEFAULT: "#C4456A", bg: "#F9E8ED", border: "#E9B9C6" },
        edge: "#B9B4A7",
        code: { inline: "#EFEDE6", bg: "#1B1A17", fg: "#E9E6DD" },
        node: {
          idea: { bg: "#FBF3DC", border: "#E7CC86", text: "#8A6A1F", dot: "#E0A93B" },
          doc: { bg: "#E6EFF9", border: "#AEC9E9", text: "#2C5C8A", dot: "#5B8FC4" },
          task: { bg: "#E4F2E9", border: "#A8D6BA", text: "#1F6F4B", dot: "#3DA372" },
          decision: { bg: "#ECE6F9", border: "#C6B8E9", text: "#5A4A8A", dot: "#8E78C8" },
          data: { bg: "#F9E8ED", border: "#E9B9C6", text: "#8A2C4A", dot: "#C4708A" },
        },
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      keyframes: {
        mfup: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        mffade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        mfpop: {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        mfdash: {
          to: { strokeDashoffset: "-16" },
        },
      },
      animation: {
        mfup: "mfup .3s ease-out",
        mffade: "mffade .2s ease-out",
        mfpop: "mfpop .18s ease-out",
        mfdash: "mfdash 1s linear infinite",
      },
    },
  },
  plugins: [],
};
