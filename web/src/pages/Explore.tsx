import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MOCK_CARDS } from "../mock";
import { Change, compact, money, Sparkline, SignalBadge } from "../ui";

const GAMES = [
  { code: "all", label: "Todos" },
  { code: "one_piece", label: "One Piece" },
  { code: "pokemon", label: "Pokémon" },
];
const SORTS = [
  { key: "price", label: "Precio" },
  { key: "change_7d", label: "Cambio 7d" },
  { key: "change_30d", label: "Cambio 30d" },
  { key: "market_cap", label: "Market cap" },
] as const;

const uniq = (xs: string[]) => Array.from(new Set(xs));

function CheckGroup({
  title,
  options,
  sel,
  toggle,
}: {
  title: string;
  options: string[];
  sel: string[];
  toggle: (v: string) => void;
}) {
  return (
    <div className="border-t border-edge py-4 first:border-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={sel.includes(o)} onChange={() => toggle(o)} className="accent-accent" />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Explore() {
  const [game, setGame] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("price");
  const [rarities, setRarities] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [open, setOpen] = useState(false);

  const rarityOpts = useMemo(() => uniq(MOCK_CARDS.map((c) => c.rarity)), []);
  const variantOpts = useMemo(() => uniq(MOCK_CARDS.map((c) => c.variant)), []);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const activeCount =
    rarities.length + variants.length + (game !== "all" ? 1 : 0) + (min || max ? 1 : 0);

  const clear = () => {
    setGame("all");
    setRarities([]);
    setVariants([]);
    setMin("");
    setMax("");
  };

  const cards = useMemo(() => {
    const lo = min ? +min : -Infinity;
    const hi = max ? +max : Infinity;
    const cs = MOCK_CARDS.filter(
      (c) =>
        (game === "all" || c.game === game) &&
        (!rarities.length || rarities.includes(c.rarity)) &&
        (!variants.length || variants.includes(c.variant)) &&
        c.price_current >= lo &&
        c.price_current <= hi &&
        c.name.toLowerCase().includes(q.toLowerCase()),
    );
    const key = sort === "price" ? "price_current" : sort;
    return cs.sort((a, b) => (b as any)[key] - (a as any)[key]);
  }, [game, q, sort, rarities, variants, min, max]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          Explorar <span className="text-sm font-normal text-slate-500">· {cards.length}</span>
        </h1>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm hover:border-accent/50"
        >
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-xs text-accent">{activeCount}</span>
          )}
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar carta…"
          className="w-48 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm outline-none placeholder:text-slate-600 focus:border-accent/50"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ↓
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.id}
            to={`/cards/${c.id}`}
            className="group overflow-hidden rounded-xl border border-edge bg-panel transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5"
          >
            <div className="relative aspect-[5/7] overflow-hidden bg-ink">
              <img
                src={c.image_url}
                alt={c.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute right-1.5 top-1.5">
                <SignalBadge signal={c.signal} />
              </div>
              <div className="absolute bottom-1.5 left-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-slate-300 backdrop-blur">
                {c.rarity} · {c.variant}
              </div>
            </div>
            <div className="p-2.5">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="mt-0.5 text-[11px] uppercase text-slate-500">cap {compact(c.market_cap)}</div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="font-mono text-base font-semibold">{money(c.price_current)}</div>
                  <div className="text-xs">
                    <Change v={c.change_7d} />
                  </div>
                </div>
                <Sparkline data={c.series.slice(-30).map((p) => p.price)} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Overlay de filtros (estilo TCGplayer) */}
      {open && (
        <div className="fixed inset-0 z-30 flex justify-end bg-ink/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-full max-w-sm flex-col border-l border-edge bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <span className="font-semibold">Filtros</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4">
              <CheckGroup
                title="Juego"
                options={GAMES.map((g) => g.label)}
                sel={[GAMES.find((g) => g.code === game)!.label]}
                toggle={(label) => setGame(GAMES.find((g) => g.label === label)!.code)}
              />
              <CheckGroup title="Rareza" options={rarityOpts} sel={rarities} toggle={(v) => toggle(rarities, setRarities, v)} />
              <CheckGroup title="Variante" options={variantOpts} sel={variants} toggle={(v) => toggle(variants, setVariants, v)} />
              <div className="border-t border-edge py-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Precio</div>
                <div className="flex items-center gap-2">
                  <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" inputMode="numeric" className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-sm outline-none" />
                  <span className="text-slate-600">–</span>
                  <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="max" inputMode="numeric" className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-sm outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-edge p-4">
              <button onClick={clear} className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:text-white">
                Limpiar
              </button>
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30">
                Ver {cards.length} resultados
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
