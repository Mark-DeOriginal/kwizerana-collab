import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182026",
        muted: "#68737d",
        panel: "#f7f8f5",
        line: "#dfe4dc",
        moss: "#506b43",
        mint: "#d8efe0",
        solar: "#e9b44c",
        coral: "#d76b55",
        ocean: "#2f6f91",
        aubergine: "#5a4b7f"
      },
      boxShadow: {
        tight: "0 1px 2px rgba(24, 32, 38, 0.06), 0 10px 22px rgba(24, 32, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
