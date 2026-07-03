import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FullCard, MOCK_CARDS } from "../mock";
import { Change, compact, money, SignalBadge } from "../ui";

// Screener financiero estilo Finviz: filtras por métricas, ves una tabla densa.
type Num = string;
const n = (v: Num) => (v === "" ? null : +v);

const COLS: { key: keyof FullCard; label: string; kind: "money" | "pct" | "num" | "cap" | "sig" | "text" }[] = [
  { key: "name", label: "Carta", kind: "text" },
  { key: "rarity", label: "Rar", kind: "text" },
  { key: "variant", label: "Var", kind: "text" },
  { key: "price_current", label: "Precio", kind: "money" },
  { key: "change_24h", label: "24h", kind: "pct" },
  { key: "change_7d", label: "7d", kind: "pct" },
  { key: "change_30d", label: "30d", kind: "pct" },
  { key: "rsi_14", label: "RSI", kind: "num" },
  { key: "volatility_30d", label: "Vol%", kind: "num" },
  { key: "market_cap", label: "Mkt cap", kind: "cap" },
  { key: "signal", label: "Señal", kind: "sig" },
];

export default function Screener() {
  const nav = useNavigate();
  const rarityOpts = useMemo(() => Array.from(new Set(MOCK_CARDS.map((c) => c.rarity))), []);
  const variantOpts = useMemo(() => Array.from(new Set(MOCK_CARDS.map((c) => c.variant))), []);

  const [f, setF] = useState({
    rarity: "",
    variant: "",
    signal: "",
    priceMin: "",
    priceMax: "",
    chg7Min: "",
    chg7Max: "",
    rsiMin: "",
    rsiMax: "",
    volMax: "",
    capMin: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const [sort, setSort] = useState<{ key: keyof FullCard; dir: 1 | -1 }>({ key: "market_cap", dir: -1 });
  const clickSort = (key: keyof FullCard) =>
    setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }));

  const rows = useMemo(() => {
    const between = (v: number, lo: number | null, hi: number | null) =>
      (lo == null || v >= lo) && (hi == null || v <= hi);
    const out = MOCK_CARDS.filter(
      (c) =>
        (!f.rarity || c.rarity === f.rarity) &&
        (!f.variant || c.variant === f.variant) &&
        (!f.signal || c.signal === f.signal) &&
        between(c.price_current, n(f.priceMin), n(f.priceMax)) &&
        between(c.change_7d, n(f.chg7Min), n(f.chg7Max)) &&
        between(c.rsi_14, n(f.rsiMin), n(f.rsiMax)) &&
        (n(f.volMax) == null || c.volatility_30d <= n(f.volMax)!) &&
        (n(f.capMin) == null || c.market_cap >= n(f.capMin)!),
    );
    return out.sort((a, b) => {
      const av = a[sort.key] as any;
      const bv = b[sort.key] as any;
      return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * sort.dir;
    });
  }, [f, sort]);

  const cell = (c: FullCard, kind: string, key: keyof FullCard) => {
    const v = c[key] as any;
    if (kind === "money") return money(v);
    if (kind === "cap") return compact(v);
    if (kind === "pct") return <Change v={v} />;
    if (kind === "sig") return <SignalBadge signal={v} />;
    return v;
  };

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">
        Screener <span className="text-sm font-normal text-slate-500">· {rows.length} de {MOCK_CARDS.length}</span>
      </h1>

      {/* Filtros financieros */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-edge bg-panel p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Sel label="Rareza" value={f.rarity} onChange={set("rarity")} opts={rarityOpts} />
        <Sel label="Variante" value={f.variant} onChange={set("variant")} opts={variantOpts} />
        <Sel label="Señal" value={f.signal} onChange={set("signal")} opts={["buy", "hold", "sell"]} />
        <Range label="Precio $" a={f.priceMin} b={f.priceMax} oa={set("priceMin")} ob={set("priceMax")} />
        <Range label="Cambio 7d %" a={f.chg7Min} b={f.chg7Max} oa={set("chg7Min")} ob={set("chg7Max")} />
        <Range label="RSI" a={f.rsiMin} b={f.rsiMax} oa={set("rsiMin")} ob={set("rsiMax")} />
        <One label="Vol máx %" value={f.volMax} onChange={set("volMax")} />
        <One label="Mkt cap mín" value={f.capMin} onChange={set("capMin")} />
      </div>

      {/* Tabla densa */}
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel text-[11px] uppercase text-slate-500">
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => clickSort(col.key)}
                  className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-300 ${
                    col.kind === "text" || col.kind === "sig" ? "text-left" : "text-right"
                  }`}
                >
                  {col.label}
                  {sort.key === col.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => nav(`/cards/${c.id}`)}
                className="cursor-pointer border-t border-edge/60 hover:bg-panel"
              >
                {COLS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      col.kind === "text" || col.kind === "sig" ? "text-left" : "text-right font-mono"
                    } ${col.key === "name" ? "font-medium" : ""}`}
                  >
                    {cell(c, col.kind, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded border border-edge bg-ink px-2 py-1 outline-none";

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: any; opts: string[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={onChange} className={inputCls}>
        <option value="">Todas</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}
function One({ label, value, onChange }: { label: string; value: string; onChange: any }) {
  return (
    <Field label={label}>
      <input value={value} onChange={onChange} inputMode="numeric" placeholder="—" className={inputCls} />
    </Field>
  );
}
function Range({ label, a, b, oa, ob }: { label: string; a: string; b: string; oa: any; ob: any }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <input value={a} onChange={oa} inputMode="numeric" placeholder="min" className={inputCls} />
        <input value={b} onChange={ob} inputMode="numeric" placeholder="max" className={inputCls} />
      </div>
    </Field>
  );
}
