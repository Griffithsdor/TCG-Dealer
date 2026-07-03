// ============================================================================
// Base de datos FALSA (beta) — la "carta al 100%".
// Define TODO lo que queremos tener cuando la plataforma esté completa, y lo
// rellena con datos plausibles sobre cartas reales de One Piece que ya vemos.
// La UI se construye contra este modelo; luego se conecta a datos reales.
// ============================================================================

export type Grade = { grade: string; price: number; pop: number };
export type Sale = {
  date: string;
  price: number;
  condition: string;
  grade: string | null;
  marketplace: string;
};
export type SeriesPoint = { t: string; price: number };

export type FullCard = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  variant: string;
  game: string;
  set_code: string;
  set_name: string;
  release_date: string;
  artist: string;
  image_url: string;

  // Mercado consolidado + por fuente
  price_current: number;
  currency: string;
  sources: { name: string; price: number; region: string }[];
  spread_pct: number;

  // Variaciones
  change_24h: number;
  change_7d: number;
  change_30d: number;
  change_90d: number;
  change_1y: number;

  // Serie histórica (1 año, diaria)
  series: SeriesPoint[];

  // Graded ladder + population
  graded: Grade[];

  // Liquidez / volumen
  sales_volume_30d: number;
  active_listings: number;
  liquidity: "alta" | "media" | "baja";

  // Inversión
  market_cap: number;
  holders: number;
  ath: number;
  atl: number;

  // Señales
  signal: "buy" | "hold" | "sell";
  rsi_14: number;
  sma_30: number;
  volatility_30d: number;
  rationale: string;

  // Feed de ventas recientes
  recent_sales: Sale[];
};

// --- PRNG determinista (mulberry32) para series reproducibles ---------------
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random walk de 365 días que ATERRIZA en `end` (precio actual).
function genSeries(end: number, seed: number, drift = 0.0006): SeriesPoint[] {
  const rand = rng(seed);
  const n = 365;
  const rets: number[] = [];
  for (let i = 0; i < n; i++) rets.push((rand() - 0.5) * 0.06 + drift);
  // construimos hacia atrás desde `end`
  const prices = new Array(n);
  prices[n - 1] = end;
  for (let i = n - 2; i >= 0; i--) prices[i] = prices[i + 1] / (1 + rets[i + 1]);
  const today = new Date("2026-07-03");
  return prices.map((p: number, i: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (n - 1 - i));
    return { t: d.toISOString().slice(0, 10), price: Math.max(1, +p.toFixed(2)) };
  });
}

function pctChange(series: SeriesPoint[], days: number): number {
  const last = series[series.length - 1].price;
  const prev = series[Math.max(0, series.length - 1 - days)].price;
  return +(((last - prev) / prev) * 100).toFixed(1);
}
function sma(series: SeriesPoint[], w: number): number {
  const s = series.slice(-w);
  return +(s.reduce((a, b) => a + b.price, 0) / s.length).toFixed(2);
}
function volatility(series: SeriesPoint[], w = 30): number {
  const s = series.slice(-w - 1).map((p) => p.price);
  const rets = s.slice(1).map((v, i) => (v - s[i]) / s[i]);
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length;
  return +(Math.sqrt(varr) * 100).toFixed(1);
}
function rsi(series: SeriesPoint[], p = 14): number {
  const s = series.slice(-p - 1).map((x) => x.price);
  let g = 0;
  let l = 0;
  for (let i = 1; i < s.length; i++) {
    const ch = s[i] - s[i - 1];
    if (ch >= 0) g += ch;
    else l -= ch;
  }
  if (l === 0) return 100;
  const rs = g / p / (l / p);
  return +(100 - 100 / (1 + rs)).toFixed(0);
}

function signalOf(price: number, sma30: number, r: number): FullCard["signal"] {
  let sc = 0;
  if (r < 35) sc++;
  else if (r > 68) sc--;
  if (price < sma30) sc++;
  else if (price > sma30) sc--;
  return sc >= 1 ? "buy" : sc <= -1 ? "sell" : "hold";
}

// --- Fixtures: cartas reales que ya vemos, enriquecidas -----------------------
type Seed = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  variant: string;
  price: number;
  img: number;
  artist: string;
  holders: number;
  seed: number;
  drift: number;
};

const SET = { code: "the-time-of-battle", name: "The Time of Battle (EB-02)", release: "2025-09-12" };

const SEEDS: Seed[] = [
  { id: "sakazuki-manga", name: "Sakazuki (Manga)", number: "EB02-045", rarity: "SR", variant: "Manga", price: 1204.71, img: 695330, artist: "Eiichiro Oda", holders: 312, seed: 11, drift: 0.0012 },
  { id: "ms-all-sunday-sp", name: "Ms. All Sunday (SP)", number: "EB02-039", rarity: "SR", variant: "SP", price: 674.05, img: 695324, artist: "STUDIO ZIN", holders: 540, seed: 22, drift: 0.0009 },
  { id: "koby-manga", name: "Koby (Manga)", number: "EB04-044", rarity: "SR", variant: "Manga", price: 644.32, img: 695331, artist: "Eiichiro Oda", holders: 288, seed: 33, drift: 0.001 },
  { id: "portgas-ace-sp", name: "Portgas.D.Ace (SP)", number: "EB02-006", rarity: "SR", variant: "SP", price: 243.32, img: 695326, artist: "STUDIO ZIN", holders: 910, seed: 44, drift: 0.0007 },
  { id: "katakuri-sp", name: "Charlotte Katakuri (SP)", number: "EB02-041", rarity: "SR", variant: "SP", price: 148.95, img: 695325, artist: "STUDIO ZIN", holders: 1120, seed: 55, drift: 0.0005 },
  { id: "enel-sp", name: "Enel (SP)", number: "EB02-018", rarity: "SR", variant: "SP", price: 137.66, img: 695327, artist: "STUDIO ZIN", holders: 980, seed: 66, drift: 0.0004 },
  { id: "borsalino-alt", name: "Borsalino (Alternate Art)", number: "EB02-054", rarity: "SR", variant: "Alternate Art", price: 98.71, img: 695328, artist: "Ryu Moto", holders: 1340, seed: 77, drift: 0.0003 },
  { id: "teach-alt", name: "Marshall.D.Teach (Alternate Art)", number: "EB02-119", rarity: "SEC", variant: "Alternate Art", price: 75.54, img: 695329, artist: "Ryu Moto", holders: 760, seed: 88, drift: -0.0002 },
  { id: "boa-hancock-alt", name: "Boa Hancock (Alternate Art)", number: "EB02-032", rarity: "SR", variant: "Alternate Art", price: 69.59, img: 695309, artist: "Ryu Moto", holders: 2100, seed: 99, drift: 0.0008 },
];

function build(s: Seed): FullCard {
  const series = genSeries(s.price, s.seed, s.drift);
  const sma30 = sma(series, 30);
  const r = rsi(series);
  const prices = series.map((p) => p.price);
  const ath = +Math.max(...prices).toFixed(2);
  const atl = +Math.min(...prices).toFixed(2);
  const signal = signalOf(s.price, sma30, r);
  const rand = rng(s.seed + 7);

  const graded: Grade[] = [
    { grade: "Raw", price: s.price, pop: Math.round(s.holders * 6) },
    { grade: "PSA 9", price: +(s.price * 1.7).toFixed(2), pop: Math.round(s.holders * 0.9) },
    { grade: "PSA 10", price: +(s.price * 3.4).toFixed(2), pop: Math.round(s.holders * 0.35) },
    { grade: "BGS 9.5", price: +(s.price * 2.6).toFixed(2), pop: Math.round(s.holders * 0.18) },
  ];

  const tcg = s.price;
  const cm = +(s.price * (0.9 + rand() * 0.15)).toFixed(2); // Cardmarket EU
  const ebay = +(s.price * (0.95 + rand() * 0.2)).toFixed(2); // eBay última venta
  const sources = [
    { name: "TCGplayer", price: tcg, region: "US" },
    { name: "Cardmarket", price: cm, region: "EU" },
    { name: "eBay (last sold)", price: ebay, region: "US" },
  ];
  const spread = +(((Math.max(tcg, cm, ebay) - Math.min(tcg, cm, ebay)) / Math.min(tcg, cm, ebay)) * 100).toFixed(1);

  const conds = ["Near Mint", "Near Mint", "Lightly Played"];
  const recent_sales: Sale[] = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date("2026-07-03");
    d.setDate(d.getDate() - i * 2);
    const graded10 = rand() > 0.7;
    return {
      date: d.toISOString().slice(0, 10),
      price: +(s.price * (graded10 ? 3.4 : 1) * (0.92 + rand() * 0.16)).toFixed(2),
      condition: conds[Math.floor(rand() * conds.length)],
      grade: graded10 ? "PSA 10" : null,
      marketplace: rand() > 0.5 ? "eBay" : "TCGplayer",
    };
  });

  const liquidity = s.holders > 1000 ? "alta" : s.holders > 500 ? "media" : "baja";
  const rationale =
    signal === "buy"
      ? `RSI ${r} (zona baja) y precio bajo la media de 30d ($${sma30}). Volatilidad ${volatility(series)}%. Posible entrada.`
      : signal === "sell"
        ? `RSI ${r} (sobrecompra) y precio sobre la SMA30 ($${sma30}). Momentum extendido.`
        : `Precio en línea con la media de 30d ($${sma30}), RSI ${r}. Sin señal clara.`;

  return {
    id: s.id,
    name: s.name,
    number: s.number,
    rarity: s.rarity,
    variant: s.variant,
    game: "one_piece",
    set_code: SET.code,
    set_name: SET.name,
    release_date: SET.release,
    artist: s.artist,
    image_url: `https://product-images.tcgplayer.com/fit-in/400x400/${s.img}.jpg`,
    price_current: s.price,
    currency: "USD",
    sources,
    spread_pct: spread,
    change_24h: pctChange(series, 1),
    change_7d: pctChange(series, 7),
    change_30d: pctChange(series, 30),
    change_90d: pctChange(series, 90),
    change_1y: pctChange(series, 364),
    series,
    graded,
    sales_volume_30d: Math.round(20 + rand() * 120),
    active_listings: Math.round(15 + rand() * 90),
    liquidity,
    market_cap: Math.round(s.price * s.holders * 6),
    holders: s.holders,
    ath,
    atl,
    signal,
    rsi_14: r,
    sma_30: sma30,
    volatility_30d: volatility(series),
    rationale,
    recent_sales,
  };
}

export const MOCK_CARDS: FullCard[] = SEEDS.map(build);
export const mockById = (id: string) => MOCK_CARDS.find((c) => c.id === id) ?? null;

// Análisis relativo: cómo se comporta la carta frente a las de su misma rareza.
export function peerStats(card: FullCard) {
  const peers = MOCK_CARDS.filter((c) => c.rarity === card.rarity);
  const rank = (key: keyof FullCard) =>
    [...peers].sort((a, b) => (b[key] as number) - (a[key] as number)).findIndex((c) => c.id === card.id) + 1;
  const avg = (key: keyof FullCard) =>
    +(peers.reduce((a, b) => a + (b[key] as number), 0) / peers.length).toFixed(1);
  const pct = (r: number) => Math.round((1 - (r - 1) / peers.length) * 100);
  return {
    count: peers.length,
    rankPrice: rank("price_current"),
    rank30: rank("change_30d"),
    pctPrice: pct(rank("price_current")),
    avgChange30: avg("change_30d"),
    avgVol: avg("volatility_30d"),
  };
}
