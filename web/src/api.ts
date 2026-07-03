const BASE = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export type Card = {
  id: string;
  name: string;
  rarity: string | null;
  image_url: string | null;
  set_code: string;
  game: string;
  price_current: number | null;
  currency: string | null;
  change_7d: number | null;
  signal: string | null;
};

export type Variant = {
  variant_id: string;
  variant: string;
  finish: string | null;
  price_current: number | null;
  currency: string | null;
  change_7d: number | null;
  change_30d: number | null;
  signal: string | null;
  sma_30: number | null;
  rsi_14: number | null;
  volatility_30d: number | null;
  ath: number | null;
  atl: number | null;
};

export type CardDetail = {
  id: string;
  number: string;
  name: string;
  rarity: string | null;
  image_url: string | null;
  set_code: string;
  set_name: string;
  game_code: string;
  variants: Variant[];
};

export type Point = { ts: string; price: number; currency: string };

export const listCards = (game: string, limit = 60) =>
  get<{ cards: Card[] }>(
    `/v1/cards?limit=${limit}${game === "all" ? "" : `&game=${game}`}`,
  ).then((r) => r.cards);

export const getCard = (id: string) => get<CardDetail>(`/v1/cards/${id}`);

export const getHistory = (variantId: string, days = 365) =>
  get<{ points: Point[] }>(`/v1/variants/${variantId}/history?days=${days}`).then(
    (r) => r.points,
  );
