"""Persistencia del motor de análisis (psycopg).

Lee las series de `price_points` y escribe los resultados en
`analytics_snapshots`. Todo el SQL vive aquí.
"""

from __future__ import annotations

import logging

import psycopg

from engine import Snapshot, compute_snapshot

logger = logging.getLogger("analytics")


class AnalyticsRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self.conn = conn

    def variant_ids(self) -> list[str]:
        """Variantes que tienen al menos un precio de mercado."""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT variant_id::text FROM price_points WHERE kind = 'market'"
            )
            return [r[0] for r in cur.fetchall()]

    def load_series(self, variant_id: str) -> list[tuple]:
        """Serie temporal (ts, price) de una variante, orden cronológico."""
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts, price FROM price_points
                WHERE variant_id = %s AND kind = 'market'
                ORDER BY ts
                """,
                (variant_id,),
            )
            return [(ts, float(price)) for ts, price in cur.fetchall()]

    def upsert_snapshot(self, s: Snapshot) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO analytics_snapshots (
                    variant_id, price_current, currency,
                    change_24h, change_7d, change_30d, change_90d,
                    sma_7, sma_30, sma_90, volatility_30d, rsi_14,
                    ath, atl, signal, updated_at
                ) VALUES (
                    %(variant_id)s, %(price_current)s, %(currency)s,
                    %(change_24h)s, %(change_7d)s, %(change_30d)s, %(change_90d)s,
                    %(sma_7)s, %(sma_30)s, %(sma_90)s, %(volatility_30d)s, %(rsi_14)s,
                    %(ath)s, %(atl)s, %(signal)s, now()
                )
                ON CONFLICT (variant_id) DO UPDATE SET
                    price_current = EXCLUDED.price_current,
                    currency      = EXCLUDED.currency,
                    change_24h    = EXCLUDED.change_24h,
                    change_7d     = EXCLUDED.change_7d,
                    change_30d    = EXCLUDED.change_30d,
                    change_90d    = EXCLUDED.change_90d,
                    sma_7         = EXCLUDED.sma_7,
                    sma_30        = EXCLUDED.sma_30,
                    sma_90        = EXCLUDED.sma_90,
                    volatility_30d = EXCLUDED.volatility_30d,
                    rsi_14        = EXCLUDED.rsi_14,
                    ath           = EXCLUDED.ath,
                    atl           = EXCLUDED.atl,
                    signal        = EXCLUDED.signal,
                    updated_at    = now()
                """,
                s.as_dict(),
            )
        self.conn.commit()


def run_all(repo: AnalyticsRepository) -> int:
    """Recalcula el snapshot de todas las variantes con precio. Devuelve el nº."""
    n = 0
    for vid in repo.variant_ids():
        series = repo.load_series(vid)
        repo.upsert_snapshot(compute_snapshot(vid, series))
        n += 1
    logger.info("analytics: %d snapshots recalculados", n)
    return n
