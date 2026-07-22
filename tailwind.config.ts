import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Helpers here return class-name strings (see deltaClass in
    // lib/vm-analytics/format.ts). Without this glob those classes are never
    // generated and the colour silently fails to render.
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: rgb("--color-bg"),
        surface: rgb("--color-surface"),
        "surface-hover": rgb("--color-surface-hover"),
        border: rgb("--color-border"),
        "border-strong": rgb("--color-border-strong"),
        gold: {
          DEFAULT: rgb("--color-gold"),
          dim: rgb("--color-gold-dim"),
          50: rgb("--color-gold-50"),
          100: rgb("--color-gold-100"),
          200: rgb("--color-gold-200"),
          300: rgb("--color-gold-300"),
        },
        text: {
          primary: rgb("--color-text-primary"),
          muted: rgb("--color-text-muted"),
          subtle: rgb("--color-text-subtle"),
        },
        success: rgb("--color-success"),
        danger: rgb("--color-danger"),
        warning: rgb("--color-warning"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
