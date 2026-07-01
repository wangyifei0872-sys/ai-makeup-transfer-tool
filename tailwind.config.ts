import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#F6F7FB",
          card: "#FFFFFF",
          primary: "#6D5DF6",
          blue: "#3B82F6",
          border: "#E5E7EB",
          text: "#111827",
          muted: "#6B7280"
        }
      },
      boxShadow: {
        card: "0 18px 44px rgba(17, 24, 39, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
