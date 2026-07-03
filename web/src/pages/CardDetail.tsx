import {
  createChart,
  ColorType,
  UTCTimestamp,
  type IChartApi,
} from "lightweight-charts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CardDetail as Detail, getCard, getHistory, Point, Variant } from "../api";
import { Change, money, SignalBadge } from "../ui";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-panel px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}

function PriceChart({ points }: { points: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart: IChartApi = createChart(ref.current, {
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b92a8",
        fontFamily: "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "#1c1f2e" },
        horzLines: { color: "#1c1f2e" },
      },
      rightPriceScale: { borderColor: "#232637" },
      timeScale: { borderColor: "#232637" },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: "#6c8cff",
      topColor: "rgba(108,140,255,0.25)",
      bottomColor: "rgba(108,140,255,0.01)",
      lineWidth: 2,
    });
    series.setData(
      points.map((p) => ({
        time: Math.floor(Date.parse(p.ts) / 1000) as UTCTimestamp,
        value: p.price,
      })),
    );
    chart.timeScale().fitContent();

    const onResize = () =>
      chart.applyOptions({ width: ref.current!.clientWidth });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points]);

  return <div ref={ref} className="w-full" />;
}

export default function CardDetail() {
  const { id } = useParams();
  const [card, setCard] = useState<Detail | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCard(id)
      .then((c) => {
        setCard(c);
        const v = c.variants[0];
        if (v) getHistory(v.variant_id).then(setPoints).catch(() => {});
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <p className="text-down">Carta no encontrada.</p>;
  if (!card) return <p className="text-slate-500">Cargando…</p>;

  const v: Variant | undefined = card.variants[0];

  return (
    <>
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← Explorar
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <div className="overflow-hidden rounded-xl border border-edge bg-panel">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} className="w-full" />
            ) : (
              <div className="flex aspect-[5/7] items-center justify-center text-slate-600">
                sin imagen
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{card.name}</h1>
              <div className="mt-1 text-sm text-slate-500">
                {card.set_name} · {card.set_code} · #{card.number}
                {card.rarity && ` · ${card.rarity}`}
              </div>
            </div>
            <SignalBadge signal={v?.signal ?? null} />
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold">
              {money(v?.price_current ?? null, v?.currency)}
            </span>
            <span className="text-sm">
              7d <Change v={v?.change_7d ?? null} /> · 30d{" "}
              <Change v={v?.change_30d ?? null} />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="RSI 14" value={v?.rsi_14?.toFixed(0) ?? "—"} />
            <Stat
              label="Vol 30d"
              value={v?.volatility_30d != null ? `${v.volatility_30d.toFixed(1)}%` : "—"}
            />
            <Stat label="SMA 30" value={money(v?.sma_30 ?? null, v?.currency)} />
            <Stat label="ATH" value={money(v?.ath ?? null, v?.currency)} />
            <Stat label="ATL" value={money(v?.atl ?? null, v?.currency)} />
            <Stat label="Señal" value={v?.signal ?? "—"} />
          </div>

          <div className="mt-6 rounded-xl border border-edge bg-panel p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              Precio de mercado
            </div>
            {points.length >= 2 ? (
              <PriceChart points={points} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                Acumulando histórico — el gráfico aparece con más días de datos.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
