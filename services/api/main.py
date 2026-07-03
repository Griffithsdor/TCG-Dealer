"""API pública (Fase 1).

Sirve el catálogo y las series de precios desde Postgres. Reads abiertos (datos
públicos de precios) con CORS, para que consuma la web. Cognito/JWT se añade
cuando se quiera cerrar el acceso.

Arranque local: `make api-dev`  (requiere DATABASE_URL)
"""

from __future__ import annotations

import os

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row

app = FastAPI(title="TCG Price Intelligence API", version="0.1.0")

# ponytail: reads públicos → CORS abierto. Restringir origins al cerrar con Cognito.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _conn() -> psycopg.Connection:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise HTTPException(status_code=503, detail="DATABASE_URL no configurada")
    return psycopg.connect(dsn, row_factory=dict_row)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/games")
def list_games() -> list[dict]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT code, name FROM games ORDER BY name")
        return cur.fetchall()


@app.get("/v1/cards")
def list_cards(game: str | None = None, limit: int = 50, offset: int = 0) -> dict:
    """Lista cartas (con imagen + último precio/señal), ordenadas por valor."""
    limit = min(limit, 200)
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id::text, c.name, c.rarity, c.image_url,
                   s.code AS set_code, g.code AS game,
                   snap.price_current, snap.currency, snap.change_7d, snap.signal
            FROM cards c
            JOIN sets s ON s.id = c.set_id
            JOIN games g ON g.id = c.game_id
            LEFT JOIN card_variants cv ON cv.card_id = c.id
            LEFT JOIN analytics_snapshots snap ON snap.variant_id = cv.id
            WHERE (%s IS NULL OR g.code = %s)
            ORDER BY snap.price_current DESC NULLS LAST
            LIMIT %s OFFSET %s
            """,
            (game, game, limit, offset),
        )
        return {"cards": cur.fetchall()}


@app.get("/v1/cards/{card_id}")
def get_card(card_id: str) -> dict:
    """Ficha de carta: metadatos + variantes con su último precio."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id::text, c.number, c.name, c.rarity, c.image_url,
                   s.code AS set_code, s.name AS set_name,
                   g.code AS game_code
            FROM cards c
            JOIN sets s ON s.id = c.set_id
            JOIN games g ON g.id = c.game_id
            WHERE c.id = %s
            """,
            (card_id,),
        )
        card = cur.fetchone()
        if card is None:
            raise HTTPException(status_code=404, detail="Carta no encontrada")

        cur.execute(
            """
            SELECT cv.id::text AS variant_id, cv.variant, cv.finish,
                   snap.price_current, snap.currency, snap.change_7d, snap.signal,
                   snap.change_30d, snap.sma_30, snap.rsi_14,
                   snap.volatility_30d, snap.ath, snap.atl
            FROM card_variants cv
            LEFT JOIN analytics_snapshots snap ON snap.variant_id = cv.id
            WHERE cv.card_id = %s
            ORDER BY cv.variant
            """,
            (card_id,),
        )
        card["variants"] = cur.fetchall()
        return card


@app.get("/v1/variants/{variant_id}/history")
def get_variant_history(variant_id: str, days: int = 90) -> dict:
    """Serie temporal de precio de mercado de una variante."""
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT ts, price, currency
            FROM price_points
            WHERE variant_id = %s AND kind = 'market'
                  AND ts >= now() - (%s || ' days')::interval
            ORDER BY ts
            """,
            (variant_id, days),
        )
        return {"variant_id": variant_id, "days": days, "points": cur.fetchall()}
