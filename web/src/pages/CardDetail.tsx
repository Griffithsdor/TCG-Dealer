import { createChart, ColorType, UTCTimestamp, type IChartApi } from "lightweight-charts";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Grade, mockById, peerStats, SeriesPoint } from "../mock";
import { Change, compact, money, ProGate } from "../ui";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-panel px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}

function PriceChart({ points }: { points: SeriesPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart: IChartApi = createChart(ref.current, {
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b92a8",
        fontFamily: '"Spline Sans Mono", ui-monospace, monospace',
      },
      grid: { vertLines: { color: "#1a1b22" }, horzLines: { color: "#1a1b22" } },
      rightPriceScale: { borderColor: "#23252d" },
      timeScale: { borderColor: "#23252d" },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: "#e29a24",
      topColor: "rgba(226,154,36,0.25)",
      bottomColor: "rgba(226,154,36,0.01)",
      lineWidth: 2,
    });
    series.setData(points.map((p) => ({ time: (Date.parse(p.t) / 1000) as UTCTimestamp, value: p.price })));
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points]);
  return <div ref={ref} className="w-full" />;
}

const RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1A", days: 365 },
];

export default function CardDetail() {
  const { id } = useParams();
  const card = id ? mockById(id) : null;
  const [tab, setTab] = useState<"raw" | "graded">("raw");
  const [range, setRange] = useState(90);
  const series = useMemo(() => card?.series.slice(-range) ?? [], [card, range]);

  if (!card) return <p className="text-down">Esta carta no está en el mostrador.</p>;

  const peer = peerStats(card);
  const raw = card.price_current;
  const topGrades = ["PSA 10", "BGS 9.5", "CGC 10"]
    .map((g) => card.graded.find((x) => x.grade === g))
    .filter(Boolean) as Grade[];
  const rawSales = card.recent_sales.filter((s) => !s.grade);
  const gradedSales = card.recent_sales.filter((s) => s.grade);

  return (
    <>
      <Link to="/" className="text-sm text-muted hover:text-body">
        ← Explorar
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Izquierda */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-edge bg-panel">
            <img src={card.image_url} alt={card.name} className="w-full" />
          </div>
          <div className="rounded-xl border border-edge bg-panel p-3 text-sm">
            <Row k="Set" v={card.set_name} />
            <Row k="Número" v={card.number} />
            <Row k="Rareza" v={`${card.rarity} · ${card.variant}`} />
            <Row k="Artista" v={card.artist} />
            <Row k="Idioma" v={card.language} />
            <Row k="Lanzamiento" v={card.release_date} />
            <Row k="Holders" v={compact(card.holders)} />
          </div>
        </div>

        {/* Derecha */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold">{card.name}</h1>
            <div className="mt-1 text-sm text-muted">
              {card.set_name} · #{card.number}
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-mono text-4xl font-bold">{money(card.price_current)}</span>
            <span className="text-sm text-muted">
              24h <Change v={card.change_24h} /> · 7d <Change v={card.change_7d} /> · 30d{" "}
              <Change v={card.change_30d} /> · 1a <Change v={card.change_1y} />
            </span>
          </div>

          {/* Análisis vs misma rareza (Pro) */}
          <ProGate label="Pro · Análisis peer">
            <div className="rounded-xl border border-edge bg-panel p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted">
                Rendimiento vs {card.rarity}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <div>
                  <div className="font-mono text-lg">#{peer.rankPrice}<span className="text-muted">/{peer.count}</span></div>
                  <div className="text-[11px] text-muted">por precio</div>
                </div>
                <div>
                  <div className="font-mono text-lg">Top {peer.pctPrice}%</div>
                  <div className="text-[11px] text-muted">percentil</div>
                </div>
                <div>
                  <div className="font-mono text-lg">#{peer.rank30}<span className="text-muted">/{peer.count}</span></div>
                  <div className="text-[11px] text-muted">momentum 30d</div>
                </div>
                <div>
                  <div className="font-mono text-lg">
                    <Change v={card.change_30d - peer.avgChange30} suffix="pp" />
                  </div>
                  <div className="text-[11px] text-muted">vs media {card.rarity}</div>
                </div>
              </div>
            </div>
          </ProGate>

          {/* Tabs RAW / Graded */}
          <div className="flex gap-1 rounded-lg border border-edge bg-panel p-1 w-fit">
            {(["raw", "graded"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm capitalize transition ${
                  tab === t ? "bg-accent/20 text-brand" : "text-muted hover:text-body"
                }`}
              >
                {t === "raw" ? "Raw" : "Graded"}
              </button>
            ))}
          </div>

          {tab === "raw" ? (
            <>
              <div className="flex flex-wrap gap-2">
                {card.sources.map((s) => (
                  <div key={s.name} className="rounded-lg border border-edge bg-panel px-3 py-1.5">
                    <span className="text-[11px] text-muted">{s.name}</span>{" "}
                    <span className="font-mono text-sm">{money(s.price)}</span>
                  </div>
                ))}
                <div className="rounded-lg border border-edge bg-panel px-3 py-1.5">
                  <span className="text-[11px] text-muted">Spread</span>{" "}
                  <span className="font-mono text-sm">{card.spread_pct}%</span>
                </div>
              </div>

              <div className="rounded-xl border border-edge bg-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted">Precio raw</span>
                  <div className="flex gap-1">
                    {RANGES.map((r) => (
                      <button
                        key={r.days}
                        onClick={() => setRange(r.days)}
                        className={`rounded px-2 py-0.5 text-xs ${
                          range === r.days ? "bg-accent/20 text-brand" : "text-muted"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart points={series} />
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                <Stat label="RSI 14" value={card.rsi_14} />
                <Stat label="Vol 30d" value={`${card.volatility_30d}%`} />
                <Stat label="SMA 30" value={money(card.sma_30)} />
                <Stat label="ATH" value={money(card.ath)} />
                <Stat label="ATL" value={money(card.atl)} />
                <Stat label="Market cap" value={compact(card.market_cap)} />
                <Stat label="Vol. 30d" value={card.sales_volume_30d} />
                <Stat label="Listados" value={card.active_listings} />
                <Stat label="Liquidez" value={card.liquidity} />
              </div>

              <SalesTable title="Ventas raw recientes" sales={rawSales} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {card.graded.map((g) => (
                  <div key={g.grade} className="rounded-xl border border-edge bg-panel p-3">
                    <div className="text-[11px] text-muted">{g.grade}</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold">{money(g.price)}</div>
                    <div className="text-[11px] text-muted">pop {compact(g.pop)}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-edge bg-panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <h3 className="text-sm font-semibold">¿Conviene graduar? ROI por grado</h3>
                  <span className="text-[11px] text-muted">
                    vs raw {money(raw)} · no incluye costo de grading (~{money(card.grading_cost)})
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {topGrades.map((g) => {
                    const roi = ((g.price - raw) / raw) * 100;
                    const verdict = roi >= 100 ? "Vale la pena" : roi >= 40 ? "Interesante" : "Marginal";
                    return (
                      <div key={g.grade} className="rounded-lg border border-edge bg-ink/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{g.grade}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              roi >= 100 ? "bg-up/15 text-up" : roi >= 40 ? "bg-accent/15 text-brand" : "bg-slate-500/15 text-secondary"
                            }`}
                          >
                            {verdict}
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-xl font-semibold">{money(g.price)}</div>
                        <div className="mt-1 flex items-baseline gap-3 text-sm">
                          <span className="font-mono text-up">+{roi.toFixed(0)}%</span>
                          <span className="font-mono text-muted">+{money(g.price - raw)}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted">pop {compact(g.pop)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tendencia graded = Pro */}
              <ProGate label="Pro · Tendencia graded">
                <div className="rounded-xl border border-edge bg-panel p-3">
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted">
                    Historial PSA 10
                  </div>
                  <PriceChart points={series.map((p) => ({ t: p.t, price: p.price * 3.4 }))} />
                </div>
              </ProGate>

              <SalesTable title="Ventas graded recientes" sales={gradedSales} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SalesTable({ title, sales }: { title: string; sales: { date: string; grade: string | null; condition: string; marketplace: string; price: number }[] }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted">{title}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase text-muted">
            <th className="py-1 text-left font-medium">Fecha</th>
            <th className="py-1 text-left font-medium">Cond./Grado</th>
            <th className="py-1 text-left font-medium">Mercado</th>
            <th className="py-1 text-right font-medium">Precio</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={i} className="border-t border-edge/60">
              <td className="py-1.5 text-muted">{s.date}</td>
              <td className="py-1.5">{s.grade ?? s.condition}</td>
              <td className="py-1.5 text-muted">{s.marketplace}</td>
              <td className="py-1.5 text-right font-mono">{money(s.price)}</td>
            </tr>
          ))}
          {!sales.length && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-muted">
                Sin ventas en el periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-edge/50 py-1.5 first:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-secondary">{v}</span>
    </div>
  );
}
