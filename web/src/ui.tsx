export const money = (v: number | null, ccy: string | null = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: ccy ?? "USD",
        maximumFractionDigits: 2,
      }).format(v);

export function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-500">—</span>;
  const up = v >= 0;
  return (
    <span className={up ? "text-up" : "text-down"}>
      {up ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

const SIGNAL: Record<string, string> = {
  buy: "bg-up/15 text-up border-up/30",
  sell: "bg-down/15 text-down border-down/30",
  hold: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return null;
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        SIGNAL[signal] ?? SIGNAL.hold
      }`}
    >
      {signal}
    </span>
  );
}
