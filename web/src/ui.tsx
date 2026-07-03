import { type ReactNode, useEffect, useRef, useState } from "react";

export const money = (v: number | null, ccy: string | null = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: ccy ?? "USD",
        maximumFractionDigits: 2,
      }).format(Number(v));

export const compact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function Change({ v, suffix = "%" }: { v: number | null; suffix?: string }) {
  if (v == null) return <span className="text-muted">—</span>;
  const up = v >= 0;
  return (
    <span className={up ? "text-up" : "text-down"}>
      {up ? "▲" : "▼"} {Math.abs(Number(v)).toFixed(1)}
      {suffix}
    </span>
  );
}

const SIGNAL: Record<string, string> = {
  buy: "bg-up/15 text-up border-up/30",
  sell: "bg-down/15 text-down border-down/30",
  hold: "bg-slate-500/15 text-secondary border-slate-500/30",
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

// ponytail: freemium se define después. Por ahora TODO desbloqueado.
export const IS_PRO = true;

export function ProGate({ children, label = "Pro" }: { children: ReactNode; label?: string }) {
  if (IS_PRO) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-ink/40">
        <span className="text-lg">🔒</span>
        <span className="rounded border border-cheddar-700/40 bg-accent/15 px-2 py-0.5 text-xs font-semibold text-cheddar-300">
          {label}
        </span>
        <span className="text-[11px] text-muted">Desbloquea con Pro</span>
      </div>
    </div>
  );
}

// Sparkline SVG minimalista (sin librería).
export function Sparkline({ data, w = 96, h = 28 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  // Color vía currentColor + token up/down → sigue el tema (oscuro/claro) automáticamente.
  return (
    <svg width={w} height={h} className={`overflow-visible ${up ? "text-up" : "text-down"}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

// Count-up del brandbook: los números "suben contando" al cargar. Curva ease-out-quart.
// Bajo prefers-reduced-motion se salta la animación y muestra el valor final.
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}

export function CountUp({ value, format, ms }: { value: number; format: (n: number) => string; ms?: number }) {
  return <>{format(useCountUp(value, ms))}</>;
}
