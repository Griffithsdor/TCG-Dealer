"""Test end-to-end de catalog_sync con provider y repo falsos.

Verifica que solo se dan de alta las cartas que cumplen la política de alcance.
"""

from __future__ import annotations

from catalog_sync import CatalogRepository, sync_game
from scope import CardScope

from tcg_core.domain import Card, CardVariant, PriceQuote, Set
from tcg_core.providers.base import PriceProvider


class FakeProvider(PriceProvider):
    source = "tcgapi"

    def supports(self, game_code: str) -> bool:
        return game_code == "one_piece"

    def list_sets(self, game_code: str) -> list[Set]:
        return [Set(game_code="one_piece", code="OP-01", name="Romance Dawn",
                    external_ids={"tcgapi": "1"})]

    def list_cards(self, set_: Set) -> list[Card]:
        return [
            # En alcance: SR Alternate Art
            Card(game_code="one_piece", set_code="OP-01", number="001",
                 name="Monkey D. Luffy (Alternate Art)", rarity="Super Rare",
                 external_ids={"tcgapi": "10"}),
            # Fuera de alcance: Super Rare normal (sin alt art)
            Card(game_code="one_piece", set_code="OP-01", number="050",
                 name="Roronoa Zoro", rarity="Super Rare",
                 external_ids={"tcgapi": "11"}),
        ]

    def search(self, game_code, query):  # no usado aquí
        return []

    def get_variants(self, card: Card) -> list[CardVariant]:
        return [CardVariant(card=card)]

    def get_prices(self, variant, *, since=None) -> PriceQuote:
        return PriceQuote(source=self.source, external_id="", points=[])


class FakeRepo(CatalogRepository):
    def __init__(self) -> None:
        self.added: list[str] = []
        self.sets: list[str] = []

    def known_set_codes(self, game_code: str) -> set[str]:
        return set()

    def ensure_set(self, set_) -> None:
        self.sets.append(set_.code)

    def variant_exists(self, source: str, external_id: str) -> bool:
        return False

    def upsert_card_with_mapping(self, card, *, source, external_id, external_url):
        self.added.append(external_id)


def test_sync_only_adds_in_scope_cards():
    repo = FakeRepo()
    scope = CardScope.load()  # usa scope.yaml real
    result = sync_game(
        game_code="one_piece",
        provider=FakeProvider(),
        repo=repo,
        scope=scope,
    )

    assert result.scanned_cards == 2
    assert result.added_cards == 1          # solo el Leader
    assert result.skipped_out_of_scope == 1  # el Common queda fuera
    assert result.new_sets == 1
    assert repo.added == ["10"]             # external_id del Leader
