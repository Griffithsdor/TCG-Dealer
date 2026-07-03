"""Modelos de dominio game-agnostic.

Estos modelos son la representación interna (independiente de cada proveedor).
Los adaptadores traducen la respuesta de cada API a estos tipos.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class PriceKind(str, Enum):
    """Tipo de precio reportado por una fuente."""

    MARKET = "market"   # precio de mercado consolidado por la fuente
    LOW = "low"
    MID = "mid"
    HIGH = "high"
    LISTING = "listing"  # asking price de un listado activo (ej. eBay)
    SOLD = "sold"        # venta cerrada real (ej. eBay Marketplace Insights)


class Game(BaseModel):
    code: str            # 'one_piece', 'pokemon'
    name: str


class Set(BaseModel):
    game_code: str
    code: str            # 'OP-01', 'sv1'
    name: str
    release_date: datetime | None = None
    # ID nativo de la carta/set en cada fuente (source -> external_id).
    external_ids: dict[str, str] = Field(default_factory=dict)


class Card(BaseModel):
    game_code: str
    set_code: str
    number: str
    name: str
    rarity: str | None = None
    image_url: str | None = None
    # ID nativo en cada fuente, p.ej. {"tcgapi": "12345"}. Necesario para
    # pedir precios sin depender todavía de la tabla source_mappings.
    external_ids: dict[str, str] = Field(default_factory=dict)


class CardVariant(BaseModel):
    """Unidad mínima de precio."""

    card: Card
    variant: str = "normal"      # normal|holo|alt_art|manga|...
    language: str = "EN"
    finish: str | None = None


class PricePoint(BaseModel):
    """Un punto de una serie temporal de precios."""

    source: str
    condition: str = "NM"
    price: Decimal
    currency: str = "USD"
    kind: PriceKind = PriceKind.MARKET
    ts: datetime


class PriceQuote(BaseModel):
    """Respuesta agregada de un proveedor para una variante concreta."""

    source: str
    external_id: str
    external_url: str | None = None
    points: list[PricePoint] = Field(default_factory=list)
