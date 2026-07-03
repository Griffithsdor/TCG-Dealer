"""Contrato que todo proveedor de precios debe implementar.

Esta es la pieza central de la resiliencia del sistema: si una API cierra o
cambia sus condiciones (como ya pasó con la API oficial de TCGplayer), solo se
reemplaza el adaptador que implementa esta interfaz, sin tocar el resto.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime

from tcg_core.domain import Card, CardVariant, PriceQuote, Set


class ProviderError(Exception):
    """Error genérico de un proveedor (rate limit, caída, respuesta inválida)."""


class PriceProvider(ABC):
    """Interfaz común de una fuente de datos de precios."""

    #: Identificador estable de la fuente ('tcgapi', 'pokemontcg', 'ebay', ...).
    source: str

    @abstractmethod
    def supports(self, game_code: str) -> bool:
        """Indica si el proveedor cubre este juego."""

    @abstractmethod
    def search(self, game_code: str, query: str) -> list[Card]:
        """Busca cartas por texto dentro de un juego."""

    @abstractmethod
    def get_variants(self, card: Card) -> list[CardVariant]:
        """Devuelve las variantes conocidas de una carta."""

    @abstractmethod
    def get_prices(
        self,
        variant: CardVariant,
        *,
        since: datetime | None = None,
    ) -> PriceQuote:
        """Devuelve los precios de una variante.

        Args:
            variant: la variante a consultar.
            since: si la fuente da histórico, límite inferior temporal.
        """

    def get_listings(self, variant: CardVariant) -> PriceQuote | None:
        """Listados activos del mercado secundario (opcional; ej. eBay Browse).

        Por defecto no soportado. Los proveedores que lo tengan lo sobrescriben.
        """
        return None

    # -- capacidad de catálogo (opcional) --------------------------------------
    # La usa catalog_sync para recorrer sets → cartas. Proveedores sin catálogo
    # (p.ej. eBay) la dejan por defecto vacía.

    def list_sets(self, game_code: str) -> list[Set]:
        """Lista los sets/expansiones de un juego."""
        return []

    def list_cards(self, set_: Set) -> list[Card]:
        """Lista las cartas de un set."""
        return []
