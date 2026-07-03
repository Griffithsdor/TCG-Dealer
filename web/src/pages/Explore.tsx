import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, listCards } from "../api";
import { Change, money, SignalBadge } from "../ui";

const GAMES = [
  { code: "all", label: "Todos" },
  { code: "one_piece", label: "One Piece" },
  { code: "pokemon", label: "Pokémon" },
];

export default function Explore() {
  const [game, setGame] = useState("all");
  const [cards, setCards] = useState<Card[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setState("loading");
    listCards(game)
      .then((c) => {
        setCards(c);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [game]);

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Explorar</h1>
        <div className="flex gap-1 rounded-lg border border-edge bg-panel p-1">
          {GAMES.map((g) => (
            <button
              key={g.code}
              onClick={() => setGame(g.code)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                game === g.code
                  ? "bg-accent/20 text-accent"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {state === "loading" && <p className="text-slate-500">Cargando…</p>}
      {state === "error" && (
        <p className="text-down">No se pudo cargar. ¿VITE_API_URL configurado?</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.id}
            to={`/cards/${c.id}`}
            className="group overflow-hidden rounded-xl border border-edge bg-panel transition hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
          >
            <div className="relative aspect-[5/7] overflow-hidden bg-ink">
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-600">
                  sin imagen
                </div>
              )}
              <div className="absolute right-1.5 top-1.5">
                <SignalBadge signal={c.signal} />
              </div>
            </div>
            <div className="p-2.5">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="uppercase">{c.set_code}</span>
                {c.rarity && <span>· {c.rarity}</span>}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-base font-semibold">
                  {money(c.price_current, c.currency)}
                </span>
                <span className="text-xs">
                  <Change v={c.change_7d} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {state === "ok" && cards.length === 0 && (
        <p className="text-slate-500">
          Aún no hay cartas para este filtro. Los jobs las irán llenando.
        </p>
      )}
    </>
  );
}
