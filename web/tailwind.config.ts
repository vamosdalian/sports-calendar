import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shell: "#F7F8F0",
        header: "#355872",
        aside: "#7AAACE",
        panel: "#9CD5FF",
        ink: "#102132",
        line: "rgba(16, 33, 50, 0.16)",
      },
      boxShadow: {
        panel: "0 22px 70px rgba(16, 33, 50, 0.12)",
      },
      borderRadius: {
        panel: "28px",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
      },
    },
  },
  plugins: [],
};

export default config;