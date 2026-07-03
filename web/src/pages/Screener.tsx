import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FullCard, MOCK_CARDS } from "../mock";
import { Change, compact, money } from "../ui";

// Screener financiero (solo cartas RAW). Filtros por rango (select), precio manual.
type Bracket = { label: string; min?: number; max?: number };

const ANY = { label: "Cualquiera" };
const BR: Record<string, { field: keyof FullCard; label: string; opts: Bracket[] }> = {
  change_24h: {
    field: "change_24h",
    label: "Cambio 24h",
    opts: [ANY, { label: "> +5%", min: 5 }, { label: "0 a +5%", min: 0, max: 5 }, { label: "-5% a 0", min: -5, max: 0 }, { label: "< -5%", max: -5 }],
  },
  change_30d: {
    field: "change_30d",
    label: "Cambio 30d",
    opts: [
      ANY,
      { label: "> +50%", min: 50 },
      { label: "+20% a +50%", min: 20, max: 50 },
      { label: "+10% a +20%", min: 10, max: 20 },
      { label: "+5% a +10%", min: 5, max: 10 },
      { label: "-5% a +5%", min: -5, max: 5 },
      { label: "-10% a -5%", min: -10, max: -5 },
      { label: "-20% a -10%", min: -20, max: -10 },
      { label: "< -20%", max: -20 },
      { label: "Positivo", min: 0 },
      { label: "Negativo", max: 0 },
    ],
  },
  change_90d: {
    field: "change_90d",
    label: "Cambio 90d",
    opts: [ANY, { label: "> +50%", min: 50 }, { label: "+20% a +50%", min: 20, max: 50 }, { label: "0 a +20%", min: 0, max: 20 }, { label: "Negativo", max: 0 }],
  },
  rsi_14: {
    field: "rsi_14",
    label: "RSI",
    opts: [
      ANY,
      { label: "Sobreventa (<30)", max: 30 },
      { label: "30 – 40", min: 30, max: 40 },
      { label: "40 – 50", min: 40, max: 50 },
      { label: "50 – 60", min: 50, max: 60 },
      { label: "60 – 70", min: 60, max: 70 },
      { label: "Sobrecompra (>70)", min: 70 },
      { label: "Neutral (40–60)", min: 40, max: 60 },
    ],
  },
  volatility_30d: {
    field: "volatility_30d",
    label: "Volatilidad",
    opts: [ANY, { label: "Muy baja (<3%)", max: 3 }, { label: "Baja (3–5%)", min: 3, max: 5 }, { label: "Media (5–8%)", min: 5, max: 8 }, { label: "Alta (8–12%)", min: 8, max: 12 }, { label: "Muy alta (>12%)", min: 12 }],
  },
  pct_from_high: {
    field: "pct_from_high",
    label: "% desde máx 52s",
    opts: [ANY, { label: "A ≤5% del máx", min: -5 }, { label: "5–15% abajo", min: -15, max: -5 }, { label: "15–30% abajo", min: -30, max: -15 }, { label: ">30% abajo", max: -30 }],
  },
  pct_from_low: {
    field: "pct_from_low",
    label: "% sobre mín 52s",
    opts: [ANY, { label: "A ≤10% del mín", max: 10 }, { label: "10–50% arriba", min: 10, max: 50 }, { label: "50–100% arriba", min: 50, max: 100 }, { label: ">100% arriba", min: 100 }],
  },
  premium_psa10: {
    field: "premium_psa10",
    label: "Premium PSA10",
    opts: [ANY, { label: "> 5×", min: 5 }, { label: "4 – 5×", min: 4, max: 5 }, { label: "3 – 4×", min: 3, max: 4 }, { label: "2 – 3×", min: 2, max: 3 }, { label: "< 2×", max: 2 }],
  },
  sales_volume_30d: {
    field: "sales_volume_30d",
    label: "Volumen 30d",
    opts: [ANY, { label: "> 100", min: 100 }, { label: "75 – 100", min: 75, max: 100 }, { label: "50 – 75", min: 50, max: 75 }, { label: "25 – 50", min: 25, max: 50 }, { label: "< 25", max: 25 }],
  },
  market_cap: {
    field: "market_cap",
    label: "Market cap",
    opts: [
      ANY,
      { label: "> 5M", min: 5_000_000 },
      { label: "1M – 5M", min: 1_000_000, max: 5_000_000 },
      { label: "500k – 1M", min: 500_000, max: 1_000_000 },
      { label: "100k – 500k", min: 100_000, max: 500_000 },
      { label: "< 100k", max: 100_000 },
    ],
  },
};

const GAMES = [
  { code: "", label: "Todos" },
  { code: "one_piece", label: "One Piece" },
  { code: "pokemon", label: "Pokémon" },
];

const idxOf = (key: string, label: string) => Math.max(0, BR[key].opts.findIndex((o) => o.label === label));
// Presets = screens listos, un clic.
const PRESETS: { label: string; br: Record<string, string> }[] = [
  { label: "Momentum fuerte", br: { change_30d: "> +50%", rsi_14: "60 – 70" } },
  { label: "Cerca de mínimos 52s", br: { pct_from_high: ">30% abajo" } },
  { label: "Alta liquidez", br: { sales_volume_30d: "> 100" } },
  { label: "Premium graded alto", br: { premium_psa10: "> 5×" } },
  { label: "Blue chips", br: { market_cap: "> 5M" } },
  { label: "Sobreventa", br: { rsi_14: "Sobreventa (<30)" } },
];

const COLS: { key: keyof FullCard; label: string; kind: "money" | "pct" | "num" | "cap" | "mult" | "text" }[] = [
  { key: "name", label: "Carta", kind: "text" },
  { key: "rarity", label: "Rar", kind: "text" },
  { key: "variant", label: "Var", kind: "text" },
  { key: "price_current", label: "Precio", kind: "money" },
  { key: "change_24h", label: "24h", kind: "pct" },
  { key: "change_30d", label: "30d", kind: "pct" },
  { key: "rsi_14", label: "RSI", kind: "num" },
  { key: "volatility_30d", label: "Vol%", kind: "num" },
  { key: "pct_from_high", label: "%52wH", kind: "pct" },
  { key: "pct_from_low", label: "%52wL", kind: "pct" },
  { key: "premium_psa10", label: "PSA10×", kind: "mult" },
  { key: "sales_volume_30d", label: "Vol30d", kind: "num" },
  { key: "market_cap", label: "Mkt cap", kind: "cap" },
];

export default function Screener() {
  const nav = useNavigate();
  const rarityOpts = useMemo(() => Array.from(new Set(MOCK_CARDS.map((c) => c.rarity))), []);
  const variantOpts = useMemo(() => Array.from(new Set(MOCK_CARDS.map((c) => c.variant))), []);

  const [game, setGame] = useState("");
  const [rarity, setRarity] = useState("");
  const [variant, setVariant] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [br, setBr] = useState<Record<string, number>>({}); // key -> índice de opción

  const [sort, setSort] = useState<{ key: keyof FullCard; dir: 1 | -1 }>({ key: "market_cap", dir: -1 });
  const clickSort = (key: keyof FullCard) =>
    setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }));

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const next: Record<string, number> = {};
    for (const k in p.br) next[k] = idxOf(k, p.br[k]);
    setBr(next);
  };
  const clearAll = () => {
    setGame("");
    setRarity("");
    setVariant("");
    setPriceMin("");
    setPriceMax("");
    setBr({});
  };

  const rows = useMemo(() => {
    const lo = priceMin ? +priceMin : -Infinity;
    const hi = priceMax ? +priceMax : Infinity;
    const out = MOCK_CARDS.filter((c) => {
      if (game && c.game !== game) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (variant && c.variant !== variant) return false;
      if (c.price_current < lo || c.price_current > hi) return false;
      for (const k in BR) {
        const opt = BR[k].opts[br[k] ?? 0];
        const v = c[BR[k].field] as number;
        if (opt.min != null && v < opt.min) return false;
        if (opt.max != null && v > opt.max) return false;
      }
      return true;
    });
    return out.sort((a, b) => {
      const av = a[sort.key] as any;
      const bv = b[sort.key] as any;
      return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * sort.dir;
    });
  }, [game, rarity, variant, priceMin, priceMax, br, sort]);

  const cell = (c: FullCard, kind: string, key: keyof FullCard) => {
    const v = c[key] as any;
    if (kind === "money") return money(v);
    if (kind === "cap") return compact(v);
    if (kind === "mult") return `${v}×`;
    if (kind === "pct") return <Change v={v} />;
    return v;
  };

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">
        Screener <span className="text-sm font-normal text-muted">· {rows.length} de {MOCK_CARDS.length} · solo raw</span>
      </h1>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="rounded-full border border-edge bg-panel px-3 py-1 text-xs text-secondary transition hover:border-accent/50 hover:text-strong"
          >
            {p.label}
          </button>
        ))}
        <button onClick={clearAll} className="ml-auto rounded-full px-3 py-1 text-xs text-muted hover:text-secondary">
          Limpiar filtros
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-edge bg-panel p-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <Sel label="TCG" value={game} onChange={(e) => setGame(e.target.value)} opts={GAMES} />
        <Sel label="Rareza" value={rarity} onChange={(e) => setRarity(e.target.value)} opts={[{ code: "", label: "Todas" }, ...rarityOpts.map((o) => ({ code: o, label: o }))]} />
        <Sel label="Variante" value={variant} onChange={(e) => setVariant(e.target.value)} opts={[{ code: "", label: "Todas" }, ...variantOpts.map((o) => ({ code: o, label: o }))]} />
        <Field label="Precio $">
          <div className="flex items-center gap-1">
            <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} inputMode="numeric" placeholder="min" className={inputCls} />
            <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} inputMode="numeric" placeholder="max" className={inputCls} />
          </div>
        </Field>
        {Object.entries(BR).map(([k, cfg]) => (
          <Field key={k} label={cfg.label}>
            <select
              value={br[k] ?? 0}
              onChange={(e) => setBr({ ...br, [k]: +e.target.value })}
              className={inputCls}
            >
              {cfg.opts.map((o, i) => (
                <option key={i} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-panel text-[11px] uppercase text-muted">
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => clickSort(col.key)}
                  className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-secondary ${col.kind === "text" ? "text-left" : "text-right"}`}
                >
                  {col.label}
                  {sort.key === col.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => nav(`/cards/${c.id}`)} className="cursor-pointer border-t border-edge/60 hover:bg-panel">
                {COLS.map((col) => (
                  <td key={col.key} className={`px-3 py-2 ${col.kind === "text" ? "text-left" : "text-right font-mono"} ${col.key === "name" ? "font-medium" : ""}`}>
                    {cell(c, col.kind, col.key)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-12 text-center">
                  <span className="font-display text-strong">Ningún activo pasó el filtro.</span>
                  <span className="mt-1 block text-sm text-muted">Afloja un rango o prueba otro preset. Preferimos callar a inventar señales.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded border border-edge bg-ink px-2 py-1 outline-none";

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; opts: { code: string; label: string }[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={onChange} className={inputCls}>
        {opts.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
