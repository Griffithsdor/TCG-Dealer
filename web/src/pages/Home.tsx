import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MOCK_CARDS } from "../mock";
import { Change, compact, CountUp, money, Sparkline } from "../ui";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const FEATURES = [
  { t: "Screener financiero", d: "Filtra por RSI, volatilidad, %52w, premium de graded y más — como un screener de acciones, no un catálogo." },
  { t: "Multi-mercado + graded", d: "Precios de TCGplayer, eBay y Cardmarket, con ladder PSA / BGS / CGC y población. Mostramos de dónde sale cada número." },
  { t: "Análisis relativo", d: "Cada carta leída contra las de su misma rareza: rank, percentil y momentum. Contexto, no ruido." },
  { t: "Grading ROI", d: "Cuánto ganarías graduando a PSA 10, BGS 9.5 o CGC 10 — con la población de cada grado. Tú decides." },
];

export default function Home() {
  const cap = MOCK_CARDS.reduce((a, c) => a + c.market_cap, 0);
  const avg24 = mean(MOCK_CARDS.map((c) => c.change_24h));
  const avg7 = mean(MOCK_CARDS.map((c) => c.change_7d));
  const vol = MOCK_CARDS.reduce((a, c) => a + c.sales_volume_30d, 0);
  const movers = [...MOCK_CARDS].sort((a, b) => b.change_7d - a.change_7d);
  const hero = [...MOCK_CARDS].sort((a, b) => b.price_current - a.price_current).slice(0, 4);
  const idx = MOCK_CARDS[0].series.map((_, i) => MOCK_CARDS.reduce((a, c) => a + c.series[i].price, 0));

  return (
    <div className="space-y-12">
      {/* HERO — banda terminal, oscura en ambos temas (brandbook: editorial claro + terminal oscuro) */}
      <section className="hero-dark fade-up relative overflow-hidden rounded-2xl border border-edge bg-ink p-8 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full opacity-70"
          style={{ background: "radial-gradient(closest-side, rgba(226,154,36,0.16), transparent 70%)" }}
        />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="mb-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tracking-wide text-cheddar-300">
              Terminal <span className="text-slate-600">·</span> One Piece + Pokémon{" "}
              <span className="text-slate-600">·</span>{" "}
              <span className="text-muted">datos de muestra</span>
            </p>
            <h1 className="text-[clamp(2.1rem,5vw,3.4rem)] font-extrabold leading-[0.98] text-balance">
              Tu colección ya es una <span className="text-brand">cartera</span>.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-secondary">
              Léela como una. Precios multi-mercado, histórico, graded y un screener financiero para
              leer el mercado antes de abrir el sobre.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/screener" className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-tinta-950 transition-[filter] duration-150 ease-brand hover:brightness-110">
                Haz queso →
              </Link>
              <Link to="/explore" className="rounded-lg border border-edge bg-panel px-5 py-2.5 font-semibold text-strong transition-colors duration-150 ease-brand hover:border-cheddar-500/50">
                Explorar el mercado
              </Link>
            </div>

            {/* Meta en mono, cifras con count-up al cargar */}
            <dl className="mt-9 flex flex-wrap gap-x-9 gap-y-4 border-t border-edge pt-6">
              <Meta label="Market cap">
                <CountUp value={cap} format={(n) => `$${compact(n)}`} />
              </Meta>
              <Meta label="Media 7d">
                <Change v={avg7} />
              </Meta>
              <Meta label="Volumen 30d">
                <CountUp value={vol} format={(n) => compact(n)} />
              </Meta>
              <Meta label="Cartas">
                <CountUp value={MOCK_CARDS.length} format={(n) => String(Math.round(n))} />
              </Meta>
            </dl>
          </div>
          <div className="hidden justify-center gap-3 lg:flex">
            {hero.map((c, i) => (
              <img
                key={c.id}
                src={c.image_url}
                alt={c.name}
                className="w-28 rounded-lg border border-edge shadow-2xl transition-transform duration-200 ease-brand hover:-translate-y-1"
                style={{ transform: `rotate(${(i - 1.5) * 5}deg)`, marginTop: `${Math.abs(i - 1.5) * 12}px` }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — lista diferenciada, no grid de tarjetas idénticas */}
      <section className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {FEATURES.map((f, i) => (
          <div key={f.t} className="fade-up flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
            <div>
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted">{f.d}</p>
            </div>
          </div>
        ))}
      </section>

      {/* MERCADO — pulso del día + movers (no hero-metric duplicado) */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">El mercado ahora</h2>
          <Link to="/explore" className="text-sm font-medium text-brand hover:underline">Ver todo →</Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-edge bg-panel px-5 py-3.5">
          <Tick label="24h" value={<Change v={avg24} />} />
          <Tick label="7d" value={<Change v={avg7} />} />
          <span className="font-mono text-xs text-muted">
            {avg7 >= 0 ? "El índice sube. Buen queso." : "El índice se enfría."}
          </span>
          <span className="ml-auto"><Sparkline data={idx.slice(-90)} w={168} h={32} /></span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MoverList title="Top subidas · 7d" cards={movers.slice(0, 5)} />
          <MoverList title="Top bajadas · 7d" cards={movers.slice(-5).reverse()} />
        </div>
      </section>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold text-strong">{children}</dd>
    </div>
  );
}

function Tick({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-base font-semibold">{value}</span>
    </div>
  );
}

function MoverList({ title, cards }: { title: string; cards: typeof MOCK_CARDS }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-secondary">{title}</h3>
      <div className="space-y-1">
        {cards.map((c) => (
          <Link key={c.id} to={`/cards/${c.id}`} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-ink/50">
            <img src={c.image_url} alt="" className="h-10 w-8 rounded object-cover" />
            <span className="truncate text-sm">{c.name}</span>
            <span className="ml-auto"><Sparkline data={c.series.slice(-14).map((p) => p.price)} w={60} h={22} /></span>
            <span className="w-20 text-right font-mono text-sm">{money(c.price_current)}</span>
            <span className="w-16 text-right text-sm"><Change v={c.change_7d} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
