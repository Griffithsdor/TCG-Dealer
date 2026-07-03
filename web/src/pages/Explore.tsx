import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FullCard, MOCK_CARDS } from "../mock";
import { money } from "../ui";

const GAMES = [
  { code: "all", label: "Todos" },
  { code: "one_piece", label: "One Piece" },
  { code: "pokemon", label: "Pokémon" },
];
const SORTS = [
  { key: "price", label: "Precio" },
  { key: "name", label: "Nombre A-Z" },
  { key: "release", label: "Más nuevas" },
] as const;

const uniq = (xs: string[]) => Array.from(new Set(xs));

function CheckGroup({ title, options, sel, toggle }: { title: string; options: string[]; sel: string[]; toggle: (v: string) => void }) {
  return (
    <div className="border-t border-edge py-4 first:border-0">
      <div className="mb-2 text-xs font-semibold text-secondary">{title}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={sel.includes(o)} onChange={() => toggle(o)} className="accent-accent" />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Explore() {
  const nav = useNavigate();
  const [game, setGame] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("price");
  const [rarities, setRarities] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const rarityOpts = useMemo(() => uniq(MOCK_CARDS.map((c) => c.rarity)), []);
  const variantOpts = useMemo(() => uniq(MOCK_CARDS.map((c) => c.variant)), []);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const activeCount = rarities.length + variants.length + (game !== "all" ? 1 : 0) + (min || max ? 1 : 0);
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
    return cs.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "release") return b.release_date.localeCompare(a.release_date);
      return b.price_current - a.price_current;
    });
  }, [game, q, sort, rarities, variants, min, max]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">
          Explorar <span className="text-sm font-normal text-muted">· {cards.length}</span>
        </h1>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm hover:border-accent/50">
          Filtros
          {activeCount > 0 && <span className="rounded-full bg-accent/20 px-1.5 text-xs text-brand">{activeCount}</span>}
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca Luffy, Charizard, OP05…" className="w-52 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent/50" />
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm outline-none">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-edge">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-2.5 py-1.5 text-sm ${view === v ? "bg-accent/20 text-brand" : "bg-panel text-muted"}`} title={v === "grid" ? "Cuadrícula" : "Lista"}>
              {v === "grid" ? "▦" : "≣"}
            </button>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge bg-panel/40 px-6 py-16 text-center">
          <p className="font-display text-lg text-strong">Nada que oler por aquí.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Ningún activo pasa esos filtros. Afloja un poco la búsqueda y vuelve a intentarlo.
          </p>
          <button onClick={clear} className="mt-4 rounded-lg border border-edge px-4 py-2 text-sm font-medium text-body transition-colors duration-150 ease-brand hover:border-cheddar-500/50">
            Limpiar filtros
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((c) => (
            <Link key={c.id} to={`/cards/${c.id}`} className="group overflow-hidden rounded-xl border border-edge bg-panel transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5">
              <div className="relative aspect-[5/7] overflow-hidden bg-ink">
                <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <div className="absolute bottom-1.5 left-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-body backdrop-blur">{c.rarity} · {c.variant}</div>
              </div>
              <div className="p-2.5">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">{c.set_code} · #{c.number} · {c.language}</div>
                <div className="text-[11px] text-muted">Ilust. {c.artist}</div>
                <div className="mt-2 font-mono text-base font-semibold">{money(c.price_current)}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-panel text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Carta</th>
                <th className="px-3 py-2 text-left font-medium">Set / N°</th>
                <th className="px-3 py-2 text-left font-medium">Rareza</th>
                <th className="px-3 py-2 text-left font-medium">Variante</th>
                <th className="px-3 py-2 text-left font-medium">Ilustrador</th>
                <th className="px-3 py-2 text-left font-medium">Idioma</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c: FullCard) => (
                <tr key={c.id} className="cursor-pointer border-t border-edge/60 hover:bg-panel" onClick={() => nav(`/cards/${c.id}`)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img src={c.image_url} alt="" className="h-10 w-7 rounded object-cover" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted">{c.set_code} · #{c.number}</td>
                  <td className="px-3 py-2">{c.rarity}</td>
                  <td className="px-3 py-2">{c.variant}</td>
                  <td className="px-3 py-2 text-muted">{c.artist}</td>
                  <td className="px-3 py-2 text-muted">{c.language}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{money(c.price_current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-sm flex-col border-l border-edge bg-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <span className="font-semibold">Filtros</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-muted hover:text-body">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4">
              <CheckGroup title="Juego" options={GAMES.map((g) => g.label)} sel={[GAMES.find((g) => g.code === game)!.label]} toggle={(label) => setGame(GAMES.find((g) => g.label === label)!.code)} />
              <CheckGroup title="Rareza" options={rarityOpts} sel={rarities} toggle={(v) => toggle(rarities, setRarities, v)} />
              <CheckGroup title="Variante" options={variantOpts} sel={variants} toggle={(v) => toggle(variants, setVariants, v)} />
              <div className="border-t border-edge py-4">
                <div className="mb-2 text-xs font-semibold text-secondary">Precio</div>
                <div className="flex items-center gap-2">
                  <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" inputMode="numeric" className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-sm outline-none" />
                  <span className="text-muted">–</span>
                  <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="max" inputMode="numeric" className="w-full rounded border border-edge bg-ink px-2 py-1.5 text-sm outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-edge p-4">
              <button onClick={clear} className="rounded-lg border border-edge px-4 py-2 text-sm text-secondary hover:text-strong">Limpiar</button>
              <button onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-accent/20 px-4 py-2 text-sm font-semibold text-brand hover:bg-accent/30">Ver {cards.length} resultados</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
