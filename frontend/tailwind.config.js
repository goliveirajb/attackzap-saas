/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0a6fbe",
        primaryLight: "#1b82d6",
        primaryDark: "#084d84",
        dark: {
          body: "#071525",
          card: "#0c1f35",
          cardSoft: "#112640",
          border: "#1e3a5f55",
          text: "#f3f4f6",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
