import daisyui from "daisyui";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        fauna: {
          primary: "#4a7c59",
          "primary-content": "#f4f7f3",
          secondary: "#5e7a8f",
          "secondary-content": "#f4f7f3",
          accent: "#d97757",
          "accent-content": "#fff7ed",
          neutral: "#0d1117",
          "neutral-content": "#c9d5e0",
          "base-100": "#0d1117",
          "base-200": "#161b22",
          "base-300": "#1a2332",
          "base-content": "#c9d5e0",
          info: "#6ab07a",
          success: "#6ab07a",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
    ],
    darkTheme: "fauna",
    base: true,
    styled: true,
    utils: true,
    logs: false,
    themeRoot: ":root",
  },
} as any;

export default config;
