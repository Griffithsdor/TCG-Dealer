"""API pública (Fase 1).

Sirve el catálogo y las series de precios desde Postgres. Read-only por ahora;
el motor de análisis (Fase 2) añadirá las señales sobre estos mismos datos.

Arranque local: `make api-dev`  (requiere DATABASE_URL)
"""

from __future__ import annotations

import os

import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException
from psycopg.rows import dict_row

app = FastAPI(title="TCG Price Intelligence API", version="0.1.0")

_API_KEY = os.getenv("API_KEY")


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Auth interina por header X-API-Key. Si API_KEY no está definida (dev local),
    no bloquea. En AWS se inyecta desde SSM."""
    if _API_KEY and x_api_key != _API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida o ausente")


def _conn() -> psycopg.Connection:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise HTTPException(status_code=503, detail="DATABASE_URL no configurada")
    return psycopg.connect(dsn, row_factory=dict_row)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/games", dependencies=[Depends(require_api_key)])
def list_games() -> list[dict]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT code, name FROM games ORDER BY name")
        return cur.fetchall()


@app.get("/v1/cards/{card_id}", dependencies=[Depends(require_api_key)])
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

        # Variantes + último precio de mercado consolidado.
        cur.execute(
            """
            SELECT cv.id::text AS variant_id, cv.variant, cv.finish,
                   snap.price_current, snap.currency, snap.change_7d, snap.signal
            FROM card_variants cv
            LEFT JOIN analytics_snapshots snap ON snap.variant_id = cv.id
            WHERE cv.card_id = %s
            ORDER BY cv.variant
            """,
            (card_id,),
        )
        card["variants"] = cur.fetchall()
        return card


@app.get("/v1/variants/{variant_id}/history", dependencies=[Depends(require_api_key)])
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
        points = cur.fetchall()
        return {"variant_id": variant_id, "days": days, "points": points}
