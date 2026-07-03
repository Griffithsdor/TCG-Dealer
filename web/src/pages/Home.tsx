import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MOCK_CARDS } from "../mock";
import { Change, compact, money, Sparkline, SignalBadge } from "../ui";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export default function Home() {
  const cap = MOCK_CARDS.reduce((a, c) => a + c.market_cap, 0);
  const avg24 = mean(MOCK_CARDS.map((c) => c.change_24h));
  const avg7 = mean(MOCK_CARDS.map((c) => c.change_7d));
  const vol = MOCK_CARDS.reduce((a, c) => a + c.sales_volume_30d, 0);

  const byChange = [...MOCK_CARDS].sort((a, b) => b.change_7d - a.change_7d);
  const gainers = byChange.slice(0, 5);
  const losers = byChange.slice(-5).reverse();
  const valuable = [...MOCK_CARDS].sort((a, b) => b.price_current - a.price_current).slice(0, 5);

  const records = MOCK_CARDS.flatMap((c) =>
    c.recent_sales.map((s) => ({ card: c, sale: s })),
  )
    .sort((a, b) => b.sale.price - a.sale.price)
    .slice(0, 5);

  // "Índice" One Piece: serie agregada (suma de precios) normalizada.
  const idx = MOCK_CARDS[0].series.map((_, i) => ({
    v: MOCK_CARDS.reduce((a, c) => a + c.series[i].price, 0),
  }));

  return (
    <div className="space-y-6">
      {/* Stats de mercado */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Market cap total" value={`$${compact(cap)}`} />
        <KPI label="Cambio medio 24h" value={<Change v={avg24} />} />
        <KPI label="Cambio medio 7d" value={<Change v={avg7} />} />
        <KPI label="Volumen 30d" value={compact(vol)} />
      </section>

      {/* Índices por juego */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-edge bg-panel p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">Índice One Piece</span>
            <Change v={avg7} />
          </div>
          <div className="text-xs text-slate-500">
            {MOCK_CARDS.length} cartas · cap ${compact(cap)}
          </div>
          <div className="mt-3">
            <Sparkline data={idx.map((p) => p.v).slice(-90)} w={520} h={64} />
          </div>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-edge bg-panel/50 p-4 text-sm text-slate-500">
          Índice Pokémon — próximamente
        </div>
      </section>

      {/* Movers */}
      <section className="grid gap-4 md:grid-cols-2">
        <MoverList title="Top subidas · 7d" cards={gainers} />
        <MoverList title="Top bajadas · 7d" cards={losers} />
      </section>

      {/* Ventas récord + más valiosas */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-edge bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Ventas récord
          </h2>
          <div className="space-y-2">
            {records.map((r, i) => (
              <Link key={i} to={`/cards/${r.card.id}`} className="flex items-center justify-between text-sm hover:text-white">
                <span className="truncate">
                  <span className="text-slate-500">{r.sale.grade ?? "Raw"}</span> {r.card.name}
                </span>
                <span className="font-mono font-semibold">{money(r.sale.price)}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-edge bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Más valiosas
          </h2>
          <div className="space-y-2">
            {valuable.map((c) => (
              <Link key={c.id} to={`/cards/${c.id}`} className="flex items-center justify-between text-sm hover:text-white">
                <span className="truncate">{c.name}</span>
                <span className="flex items-center gap-2">
                  <SignalBadge signal={c.signal} />
                  <span className="font-mono font-semibold">{money(c.price_current)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}

function MoverList({ title, cards }: { title: string; cards: typeof MOCK_CARDS }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      <div className="space-y-2">
        {cards.map((c) => (
          <Link key={c.id} to={`/cards/${c.id}`} className="flex items-center gap-3 hover:text-white">
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
