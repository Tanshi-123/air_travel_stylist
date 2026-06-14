import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182025",
        paper: "#fbf7ef",
        reef: "#0e8f8a",
        saffron: "#f4a835",
        coral: "#e86f5c",
        plum: "#623d5f"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(24, 32, 37, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
