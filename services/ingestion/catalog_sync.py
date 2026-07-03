"""Recolector de cartas nuevas (catalog sync).

Sincroniza el catálogo desde la(s) fuente(s), detecta sets y cartas nuevas, y
da de alta en `cards`/`card_variants` solo las que cumplen la política de
alcance (`scope.yaml`). Pensado para correr periódicamente (semanal + al salir
un set nuevo) vía EventBridge → Lambda/Fargate.

Fase 1: lógica de orquestación real (stub de proveedor todavía). El flujo y los
puntos de extensión ya están definidos para conectar `ScrydexProvider`.

Flujo:
    1. Listar sets del juego en la fuente.
    2. Detectar sets nuevos vs los ya presentes en BD.
    3. Para cada set (nuevo o marcado para re-escaneo), listar cartas.
    4. Filtrar por la política de alcance (rareza/promo/precio).
    5. Upsert de cartas/variantes seleccionadas + mapeo a la fuente.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal

from scope import CardScope

from tcg_core.domain import Card, Set
from tcg_core.providers.base import PriceProvider

logger = logging.getLogger("catalog_sync")

GAMES = ("one_piece", "pokemon")


@dataclass
class SyncResult:
    game_code: str
    new_sets: int = 0
    scanned_cards: int = 0
    added_cards: int = 0
    skipped_out_of_scope: int = 0


class CatalogRepository:
    """Puerto de persistencia. Implementación real (psycopg) en Fase 1.

    Se define como interfaz para poder testear el sync sin base de datos.
    """

    def known_set_codes(self, game_code: str) -> set[str]:
        raise NotImplementedError

    def ensure_set(self, set_: Set) -> None:
        """Da de alta el set si no existe (idempotente)."""
        raise NotImplementedError

    def variant_exists(self, source: str, external_id: str) -> bool:
        raise NotImplementedError

    def upsert_card_with_mapping(
        self, card: Card, *, source: str, external_id: str, external_url: str | None
    ) -> None:
        raise NotImplementedError


def sync_game(
    *,
    game_code: str,
    provider: PriceProvider,
    repo: CatalogRepository,
    scope: CardScope,
    max_sets: int | None = None,
) -> SyncResult:
    """Sincroniza un juego: detecta sets/cartas nuevas y da de alta las que aplican.

    `max_sets` limita cuántos sets se recorren (útil para demos y para no agotar
    el cupo de la API); None = todos.
    """
    result = SyncResult(game_code=game_code)
    if not provider.supports(game_code):
        logger.warning("Proveedor %s no soporta %s", provider.source, game_code)
        return result

    known = repo.known_set_codes(game_code)

    for card in _iter_catalog(provider, game_code, result, known, repo, max_sets):
        result.scanned_cards += 1

        # ¿Ya la tenemos mapeada para esta fuente?
        external_id = _external_id_for(card, provider.source)
        if repo.variant_exists(provider.source, external_id):
            continue

        # Precio actual (si el provider lo trae barato aquí; si no, None y se
        # decide solo por rareza/nombre, dejando el filtro de precio a la ingesta).
        market_price: Decimal | None = _quick_price(provider, card)

        if scope.matches(
            game_code=game_code,
            rarity=card.rarity,
            name=card.name,
            market_price=market_price,
            external_id=external_id,
        ):
            repo.upsert_card_with_mapping(
                card,
                source=provider.source,
                external_id=external_id,
                external_url=None,
            )
            result.added_cards += 1
        else:
            result.skipped_out_of_scope += 1

    logger.info(
        "sync %s: +%d cartas (%d fuera de alcance, %d sets nuevos)",
        game_code,
        result.added_cards,
        result.skipped_out_of_scope,
        result.new_sets,
    )
    return result


# --- helpers ------------------------------------------------------------------

def _iter_catalog(
    provider: PriceProvider,
    game_code: str,
    result: SyncResult,
    known: set[str],
    repo: CatalogRepository,
    max_sets: int | None = None,
):  # -> Iterable[Card]
    """Recorre sets → cartas usando el provider, contando sets nuevos."""
    for i, set_ in enumerate(provider.list_sets(game_code)):
        if max_sets is not None and i >= max_sets:
            break
        repo.ensure_set(set_)
        if set_.code not in known:
            result.new_sets += 1
            known.add(set_.code)
        yield from provider.list_cards(set_)


def _external_id_for(card: Card, source: str) -> str:
    # ID nativo de la fuente si existe; si no, convención SET-NUMBER.
    return card.external_ids.get(source) or f"{card.set_code}-{card.number}"


def _quick_price(provider: PriceProvider, card: Card) -> Decimal | None:
    # Opcional: algunos providers dan precio en el propio listado de cartas.
    return None


def run() -> list[SyncResult]:
    """Punto de entrada del job (lo invoca el handler Lambda/Fargate)."""
    # Import diferido para no exigir psycopg en entornos de test.
    from db import connect
    from repository import PgCatalogRepository
    from tcgapi_provider import TcgApiProvider

    scope = CardScope.load()
    provider = TcgApiProvider()  # lee TCGAPI_KEY del entorno
    results: list[SyncResult] = []
    with connect() as conn:
        repo = PgCatalogRepository(conn)
        for game in GAMES:
            results.append(
                sync_game(game_code=game, provider=provider, repo=repo, scope=scope)
            )
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
