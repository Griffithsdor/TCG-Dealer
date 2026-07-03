import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { to: "/", label: "Mercado", end: true },
  { to: "/explore", label: "Explorar", end: false },
  { to: "/screener", label: "Screener", end: false },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-edge bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-3">
          <Link to="/" aria-label="TCCheese — inicio" className="rounded-md">
            <Logo />
          </Link>
          <span className="hidden font-mono text-[11px] text-muted md:inline" aria-hidden>
            Haz queso.
          </span>
          <nav className="flex gap-1 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-medium transition-colors duration-150 ease-brand ${
                    isActive ? "bg-accent/10 text-brand" : "text-muted hover:bg-panel hover:text-strong"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-md border border-edge bg-panel px-2 py-0.5 font-mono text-[10px] font-medium text-muted sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cheddar-400" aria-hidden />
              datos de muestra
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
