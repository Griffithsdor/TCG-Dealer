"""Repositorio Postgres: implementa el catálogo y la escritura de precios.

Implementa el puerto `CatalogRepository` (para catalog_sync) y `PriceSink`
(para el job de ingesta de precios). Todo el SQL vive aquí; el resto del código
no conoce la base de datos.
"""

from __future__ import annotations

import logging

import psycopg

from catalog_sync import CatalogRepository
from price_ingest import PriceSink, TrackedVariant

from tcg_core.domain import Card, PriceQuote, Set

logger = logging.getLogger("repository")


class PgCatalogRepository(CatalogRepository, PriceSink):
    def __init__(self, conn: psycopg.Connection) -> None:
        self.conn = conn

    # -- catálogo (puerto CatalogRepository) -----------------------------------
    def known_set_codes(self, game_code: str) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.code
                FROM sets s JOIN games g ON g.id = s.game_id
                WHERE g.code = %s
                """,
                (game_code,),
            )
            return {row[0] for row in cur.fetchall()}

    def ensure_set(self, set_: Set) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sets (game_id, code, name, release_date)
                SELECT g.id, %s, %s, %s FROM games g WHERE g.code = %s
                ON CONFLICT (game_id, code) DO NOTHING
                """,
                (set_.code, set_.name, set_.release_date, set_.game_code),
            )
        self.conn.commit()

    def variant_exists(self, source: str, external_id: str) -> bool:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM source_mappings WHERE source = %s AND external_id = %s",
                (source, external_id),
            )
            return cur.fetchone() is not None

    def upsert_card_with_mapping(
        self, card: Card, *, source: str, external_id: str, external_url: str | None
    ) -> None:
        """Da de alta carta + variante por defecto + mapeo a la fuente (atómico)."""
        with self.conn.cursor() as cur:
            # 1) carta (idempotente por set + número)
            cur.execute(
                """
                INSERT INTO cards (game_id, set_id, number, name, rarity, image_url)
                SELECT g.id, s.id, %s, %s, %s, %s
                FROM games g
                JOIN sets s ON s.game_id = g.id AND s.code = %s
                WHERE g.code = %s
                ON CONFLICT (set_id, number) DO UPDATE
                    SET name = EXCLUDED.name,
                        rarity = EXCLUDED.rarity,
                        image_url = EXCLUDED.image_url
                RETURNING id
                """,
                (card.number, card.name, card.rarity, card.image_url,
                 card.set_code, card.game_code),
            )
            row = cur.fetchone()
            if row is None:
                logger.warning("Set no encontrado para carta %s; se omite", card.name)
                self.conn.rollback()
                return
            card_id = row[0]

            # 2) variante por defecto (impresión primaria en el MVP)
            cur.execute(
                """
                INSERT INTO card_variants (card_id, variant, language)
                VALUES (%s, 'normal', 'EN')
                ON CONFLICT (card_id, variant, language, finish) DO NOTHING
                RETURNING id
                """,
                (card_id,),
            )
            vrow = cur.fetchone()
            if vrow is None:  # ya existía
                cur.execute(
                    """
                    SELECT id FROM card_variants
                    WHERE card_id = %s AND variant = 'normal' AND language = 'EN'
                          AND finish IS NULL
                    """,
                    (card_id,),
                )
                vrow = cur.fetchone()
            variant_id = vrow[0]

            # 3) mapeo a la fuente
            cur.execute(
                """
                INSERT INTO source_mappings (variant_id, source, external_id, external_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (variant_id, source) DO NOTHING
                """,
                (variant_id, source, external_id, external_url),
            )
        self.conn.commit()

    # -- precios (puerto PriceSink) --------------------------------------------
    def list_tracked_variants(self) -> list[TrackedVariant]:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT cv.id::text, sm.external_id, cv.finish, g.code
                FROM card_variants cv
                JOIN source_mappings sm ON sm.variant_id = cv.id
                JOIN cards c ON c.id = cv.card_id
                JOIN games g ON g.id = c.game_id
                WHERE sm.source = 'tcgapi'
                """
            )
            return [
                TrackedVariant(
                    variant_id=r[0], tcgapi_card_id=r[1], finish=r[2], game_code=r[3]
                )
                for r in cur.fetchall()
            ]

    def write_price_points(self, variant_id: str, quote: PriceQuote) -> int:
        if not quote.points:
            return 0
        rows = [
            (variant_id, p.source, p.condition, float(p.price), p.currency,
             p.kind.value, p.ts)
            for p in quote.points
        ]
        with self.conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO price_points
                    (variant_id, source, condition, price, currency, kind, ts)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (variant_id, source, condition, kind, ts) DO NOTHING
                """,
                rows,
            )
        self.conn.commit()
        return len(rows)
