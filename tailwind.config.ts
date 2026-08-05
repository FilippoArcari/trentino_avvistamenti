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
