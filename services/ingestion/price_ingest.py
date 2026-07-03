"""Job de ingesta diaria de precios.

Recorre las variantes rastreadas, pide el precio actual a la fuente y lo escribe
en `price_points`. Ejecutado a diario (EventBridge → Lambda/Fargate) construye
NUESTRA propia serie temporal — el activo real de la plataforma.

Diseñado con puertos (Protocol) para poder testear sin base de datos ni red.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from tcg_core.domain import Card, CardVariant, PriceQuote
from tcg_core.providers.base import PriceProvider, ProviderError

logger = logging.getLogger("price_ingest")


@dataclass
class TrackedVariant:
    """Variante que la plataforma rastrea, con su ID nativo en la fuente."""

    variant_id: str          # PK interna (card_variants.id)
    tcgapi_card_id: str      # external_id en tcgapi (source_mappings)
    finish: str | None       # impresión concreta, o None para la primaria
    game_code: str


class PriceSink(Protocol):
    """Puerto de escritura de precios (lo implementa PgCatalogRepository)."""

    def list_tracked_variants(self) -> list[TrackedVariant]: ...
    def write_price_points(self, variant_id: str, quote: PriceQuote) -> int: ...


@dataclass
class IngestResult:
    variants: int = 0
    points_written: int = 0
    errors: int = 0


def run_daily(
    provider: PriceProvider, sink: PriceSink, *, limit: int | None = None
) -> IngestResult:
    """Snapshot diario: precio actual de cada variante rastreada → price_points.

    `limit` tapa cuántas variantes se consultan (protege el cupo de la API en
    demos); None = todas.
    """
    result = IngestResult()
    tracked = sink.list_tracked_variants()
    if limit is not None:
        tracked = tracked[:limit]
    for tv in tracked:
        result.variants += 1
        variant = _to_domain_variant(tv)
        try:
            quote = provider.get_prices(variant)
        except ProviderError as exc:
            result.errors += 1
            logger.warning("precio falló para variante %s: %s", tv.variant_id, exc)
            continue
        result.points_written += sink.write_price_points(tv.variant_id, quote)

    logger.info(
        "ingesta diaria: %d variantes, %d puntos, %d errores",
        result.variants,
        result.points_written,
        result.errors,
    )
    return result


def _to_domain_variant(tv: TrackedVariant) -> CardVariant:
    """Reconstruye una CardVariant mínima con el external_id necesario."""
    card = Card(
        game_code=tv.game_code,
        set_code="",
        number="",
        name="",
        external_ids={"tcgapi": tv.tcgapi_card_id},
    )
    return CardVariant(card=card, finish=tv.finish)


def run() -> IngestResult:
    """Punto de entrada del job (handler Lambda/Fargate)."""
    # Import diferido para no exigir psycopg en entornos de test.
    from db import connect
    from repository import PgCatalogRepository
    from tcgapi_provider import TcgApiProvider

    provider = TcgApiProvider()  # lee TCGAPI_KEY del entorno
    with connect() as conn:
        sink = PgCatalogRepository(conn)
        return run_daily(provider, sink)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
