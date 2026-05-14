/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a0f1e",
          900: "#0d1526",
          800: "#111d35",
        },
        amber: {
          400: "#f59e0b",
          500: "#d97706",
        },
        gold: "#c9a227",
      },
      fontFamily: {
        mono: ["JetBrainsMono"],
        sans: ["SpaceGrotesk"],
      },
    },
  },
};
