/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Superficies y texto semánticos, resueltos por tema vía CSS vars (canales RGB → soportan /opacidad).
        // El tema oscuro (terminal) es el default; `.light` (editorial del brandbook) los reescribe. Ver index.css.
        ink: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface-2) / <alpha-value>)",
        edge: "rgb(var(--c-border) / <alpha-value>)",
        // Texto: fuerza (títulos), cuerpo, secundario, mudo.
        strong: "rgb(var(--c-strong) / <alpha-value>)",
        body: "rgb(var(--c-body) / <alpha-value>)",
        secondary: "rgb(var(--c-secondary) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        // Semántica de mercado — afinada por tema para pasar AA en claro y en oscuro.
        up: "rgb(var(--c-up) / <alpha-value>)",
        down: "rgb(var(--c-down) / <alpha-value>)",
        // Cheddar como TEXTO (link/acento): cheddar-500 en oscuro, cheddar-700 en claro (regla de contraste del brandbook).
        brand: "rgb(var(--c-brand-text) / <alpha-value>)",
        info: "#5b8cff",

        // Marca fija (no cambia con el tema). `accent` = cheddar-500 para fondos/botones; texto sobre él va en tinta-950.
        accent: "#e29a24",
        cheddar: {
          50: "#fdf4e3",
          100: "#f9e6c2",
          200: "#f3d193",
          300: "#eebc63",
          400: "#e9a83f",
          500: "#e29a24",
          600: "#c9820f",
          700: "#a2660a",
          DEFAULT: "#e29a24",
        },
        tinta: {
          950: "#0e0f13",
          900: "#16171d",
          800: "#23252d",
          700: "#2f313b",
          600: "#494c58",
          500: "#6a6d7a",
          400: "#9a9daa",
        },
        rind: "#7a4d08",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Spline Sans Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      transitionTimingFunction: {
        // ease-out-quint del brandbook — entradas y hovers sin rebote.
        brand: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};
