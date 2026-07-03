import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-edge bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              TCG<span className="text-accent">·</span>Intelligence
            </span>
          </Link>
          <span className="ml-2 rounded bg-panel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            beta
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
