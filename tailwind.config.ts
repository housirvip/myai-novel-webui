import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(240 5.9% 90%)",
        input: "hsl(240 5.9% 90%)",
        ring: "hsl(251 91% 67%)",
        background: "hsl(220 33% 98%)",
        foreground: "hsl(224 39% 11%)",
        primary: {
          DEFAULT: "hsl(251 91% 67%)",
          foreground: "hsl(210 20% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(250 30% 95%)",
          foreground: "hsl(250 30% 24%)",
        },
        muted: {
          DEFAULT: "hsl(240 5% 96%)",
          foreground: "hsl(240 4% 46%)",
        },
        accent: {
          DEFAULT: "hsl(43 96% 56%)",
          foreground: "hsl(26 83% 14%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(224 39% 11%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84% 60%)",
          foreground: "hsl(210 20% 98%)",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.875rem",
        sm: "0.75rem",
      },
      boxShadow: {
        glow: "0 10px 40px rgba(109, 91, 255, 0.18)",
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif"
        ],
        serif: [
          '"Source Han Serif SC"',
          '"Songti SC"',
          '"STSong"',
          "serif"
        ],
      },
    },
  },
  plugins: [],
};

export default config;
