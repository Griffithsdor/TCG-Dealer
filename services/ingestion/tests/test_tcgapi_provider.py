"""Tests del TcgApiProvider con respuestas mock (sin red).

Usa httpx.MockTransport para simular la API de tcgapi.dev y verificar el parseo
y mapeo a los modelos de dominio.
"""

from __future__ import annotations

from decimal import Decimal

import httpx
import pytest

from tcgapi_provider import TcgApiProvider

from tcg_core.domain import Card, CardVariant, PriceKind, Set

# --- fixtures de respuesta (recortes reales de la doc de tcgapi.dev) ----------

SETS_RESPONSE = {
    "data": [
        {
            "id": 1234,
            "name": "Obsidian Flames",
            "slug": "obsidian-flames",
            "abbreviation": "OBF",
            "release_date": "2023-08-11",
            "card_count": 230,
        }
    ]
}

SET_CARDS_RESPONSE = {
    "data": [
        {
            "id": 12345,
            "name": "Charizard ex",
            "number": "006",
            "rarity": "Double Rare",
            "image_url": "https://img/charizard.png",
            "tcgplayer_id": 534280,
            "tcgplayer_url": "https://www.tcgplayer.com/product/534280",
            "set_id": 1234,
            "set_name": "Obsidian Flames",
        }
    ]
}

PRICES_RESPONSE = {
    "data": [
        {
            "card_id": 12345,
            "printing": "Normal",
            "market_price": 24.99,
            "low_price": 19.50,
            "price_change_24h": 2.15,
            "last_updated_at": "2026-02-19T07:00:00.000Z",
        },
        {
            "card_id": 12345,
            "printing": "Holofoil",
            "market_price": 42.50,
            "low_price": 35.00,
            "last_updated_at": "2026-02-19T07:00:00.000Z",
        },
    ]
}

SEARCH_RESPONSE = {
    "results": [
        {
            "id": 999,
            "name": "Monkey D. Luffy",
            "number": "OP01-001",
            "rarity": "Leader",
            "set_id": 77,
            "set_name": "Romance Dawn",
            "tcgplayer_id": 111,
        }
    ]
}


def _handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    # cabecera de auth siempre presente
    assert request.headers.get("X-API-Key") == "test_key"

    if path == "/v1/sets":
        return httpx.Response(200, json=SETS_RESPONSE)
    if path == "/v1/sets/1234/cards":
        return httpx.Response(200, json=SET_CARDS_RESPONSE)
    if path == "/v1/cards/12345/prices":
        return httpx.Response(200, json=PRICES_RESPONSE)
    if path == "/v1/search":
        return httpx.Response(200, json=SEARCH_RESPONSE)
    return httpx.Response(404, json={"error": "not found"})


def make_provider() -> TcgApiProvider:
    client = httpx.Client(transport=httpx.MockTransport(_handler))
    return TcgApiProvider(api_key="test_key", client=client)


# --- tests --------------------------------------------------------------------

def test_supports():
    p = make_provider()
    assert p.supports("one_piece")
    assert p.supports("pokemon")
    assert not p.supports("magic")


def test_list_sets_maps_external_id():
    p = make_provider()
    sets = p.list_sets("pokemon")
    assert len(sets) == 1
    s = sets[0]
    assert isinstance(s, Set)
    assert s.code == "OBF"
    assert s.external_ids["tcgapi"] == "1234"


def test_list_cards_carries_ids_and_set_code():
    p = make_provider()
    s = p.list_sets("pokemon")[0]
    cards = p.list_cards(s)
    assert len(cards) == 1
    c = cards[0]
    assert c.name == "Charizard ex"
    assert c.set_code == "OBF"
    assert c.external_ids["tcgapi"] == "12345"
    assert c.external_ids["tcgplayer"] == "534280"


def test_get_variants_from_printings():
    p = make_provider()
    card = Card(
        game_code="pokemon", set_code="OBF", number="006",
        name="Charizard ex", external_ids={"tcgapi": "12345"},
    )
    variants = p.get_variants(card)
    finishes = {v.finish for v in variants}
    assert finishes == {"Normal", "Holofoil"}
    norm = {v.variant for v in variants}
    assert "normal" in norm and "holo" in norm


def test_get_prices_primary_printing():
    """Sin finish, get_prices usa la impresión primaria (Normal)."""
    p = make_provider()
    card = Card(
        game_code="pokemon", set_code="OBF", number="006",
        name="Charizard ex", external_ids={"tcgapi": "12345"},
    )
    variant = CardVariant(card=card)  # finish=None -> primaria
    quote = p.get_prices(variant)
    assert quote.external_id == "12345"
    markets = [pt for pt in quote.points if pt.kind == PriceKind.MARKET]
    # Solo la impresión Normal (24.99); NO la Holofoil (42.50).
    assert any(pt.price == Decimal("24.99") for pt in markets)
    assert all(pt.price != Decimal("42.50") for pt in quote.points)
    assert all(pt.currency == "USD" and pt.ts is not None for pt in quote.points)


def test_get_prices_filtered_by_finish():
    """Con finish='Holofoil', solo devuelve esa impresión."""
    p = make_provider()
    card = Card(
        game_code="pokemon", set_code="OBF", number="006",
        name="Charizard ex", external_ids={"tcgapi": "12345"},
    )
    variant = CardVariant(card=card, variant="holo", finish="Holofoil")
    quote = p.get_prices(variant)
    markets = [pt for pt in quote.points if pt.kind == PriceKind.MARKET]
    assert any(pt.price == Decimal("42.50") for pt in markets)
    assert all(pt.price != Decimal("24.99") for pt in quote.points)


def test_search_one_piece():
    p = make_provider()
    cards = p.search("one_piece", "luffy")
    assert len(cards) == 1
    assert cards[0].rarity == "Leader"
    assert cards[0].external_ids["tcgapi"] == "999"


def test_rate_limit_raises():
    def limited(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "rate limited"})

    from tcgapi_provider import ProviderError

    p = TcgApiProvider(api_key="test_key", client=httpx.Client(transport=httpx.MockTransport(limited)))
    with pytest.raises(ProviderError):
        p.list_sets("pokemon")
