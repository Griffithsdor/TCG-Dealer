import { Link, NavLink, Outlet } from "react-router-dom";

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
          <Link to="/" className="text-lg font-bold tracking-tight">
            TCG<span className="text-accent">·</span>Intelligence
          </Link>
          <nav className="flex gap-1 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 transition ${
                    isActive ? "bg-panel text-white" : "text-slate-400 hover:text-slate-200"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            datos simulados
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
