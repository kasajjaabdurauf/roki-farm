import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#1b4332",
          50: "#f0f7f2",
          100: "#dcefe3",
          200: "#b9dfc9",
          300: "#8cc7aa",
          400: "#5aa986",
          500: "#3b8a67",
          600: "#2a6f53",
          700: "#225945",
          800: "#1b4332",
          900: "#143527",
          950: "#081c15",
        },
        ochre: {
          DEFAULT: "#d97706",
          50: "#fdf8ef",
          100: "#faedd3",
          200: "#f4d8a6",
          300: "#eebf6e",
          400: "#e7a13c",
          500: "#d97706",
          600: "#b45309",
          700: "#92400e",
          800: "#78350f",
          900: "#5f300d",
        },
        success: { DEFAULT: "#10b981", dark: "#059669", bg: "#d1fae5" },
        warning: { DEFAULT: "#f59e0b", dark: "#d97706", bg: "#fef3c7" },
        danger: { DEFAULT: "#f87171", dark: "#ef4444", bg: "#fee2e2" },
        cream: { DEFAULT: "#fafaf9", alt: "#f8fafc" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        pop: "0 12px 32px -8px rgb(8 28 21 / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
