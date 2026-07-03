import { useEffect, useState } from "react";

// Toggle de tema oscuro/claro. La clase `.light` en <html> la fija el script de pre-pintado
// en index.html (evita parpadeo); aquí solo la alternamos y persistimos la elección.
function isLightNow() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("light");
}

export function ThemeToggle() {
  const [light, setLight] = useState(isLightNow);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", light);
    try {
      localStorage.setItem("theme", light ? "light" : "dark");
    } catch {
      /* almacenamiento no disponible: el tema no persiste, sin romper nada */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#ffffff" : "#0e0f13");
  }, [light]);

  return (
    <button
      type="button"
      onClick={() => setLight((v) => !v)}
      role="switch"
      aria-checked={light}
      aria-label={light ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={light ? "Modo oscuro" : "Modo claro"}
      className="grid h-8 w-8 place-items-center rounded-md border border-edge bg-panel text-secondary transition-colors duration-150 ease-brand hover:border-cheddar-500/50 hover:text-strong"
    >
      {light ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...stroke}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
