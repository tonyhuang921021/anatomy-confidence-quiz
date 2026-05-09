import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4faf7",
          100: "#dff2e8",
          200: "#bfe5d2",
          300: "#93d0b4",
          400: "#62b78f",
          500: "#3f9b73",
          600: "#2d7d5b",
          700: "#25644a",
          800: "#21503d",
          900: "#1d4334"
        },
        ink: "#102a22",
        cream: "#f7f6f1"
      },
      boxShadow: {
        card: "0 18px 40px rgba(15, 42, 34, 0.08)"
      },
      fontFamily: {
        sans: ["'Noto Sans TC'", "'Segoe UI'", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
