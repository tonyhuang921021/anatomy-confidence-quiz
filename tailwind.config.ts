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
          50: "#eef6f3",
          100: "#d9ebe4",
          200: "#b6d6ca",
          300: "#88b9a8",
          400: "#579680",
          500: "#327861",
          600: "#1f6652",
          700: "#174d3e",
          800: "#173e34",
          900: "#14332b"
        },
        ink: "#182421",
        cream: "#f7f8f6"
      },
      boxShadow: {
        card: "0 10px 30px rgba(36, 61, 54, 0.07)",
        float: "0 24px 70px rgba(36, 61, 54, 0.16)"
      },
      fontFamily: {
        sans: ["'PingFang TC'", "'Microsoft JhengHei'", "'Noto Sans TC'", "sans-serif"],
        serif: ["'PingFang TC'", "'Microsoft JhengHei'", "'Noto Sans TC'", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
