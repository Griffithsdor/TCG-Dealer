"""Test del job de ingesta diaria con provider y sink falsos (sin BD ni red)."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from price_ingest import IngestResult, TrackedVariant, run_daily

from tcg_core.domain import CardVariant, PriceKind, PricePoint, PriceQuote
from tcg_core.providers.base import PriceProvider, ProviderError


class FakeProvider(PriceProvider):
    source = "tcgapi"

    def __init__(self, *, fail_ids: set[str] | None = None) -> None:
        self.fail_ids = fail_ids or set()

    def supports(self, game_code: str) -> bool:
        return True

    def search(self, game_code, query):
        return []

    def get_variants(self, card):
        return [CardVariant(card=card)]

    def get_prices(self, variant: CardVariant, *, since=None) -> PriceQuote:
        cid = variant.card.external_ids["tcgapi"]
        if cid in self.fail_ids:
            raise ProviderError("simulado: límite alcanzado")
        return PriceQuote(
            source=self.source,
            external_id=cid,
            points=[
                PricePoint(
                    source=self.source, condition="NM", price=Decimal("10.00"),
                    currency="USD", kind=PriceKind.MARKET,
                    ts=datetime(2026, 7, 2, tzinfo=timezone.utc),
                )
            ],
        )


class FakeSink:
    def __init__(self, tracked: list[TrackedVariant]) -> None:
        self._tracked = tracked
        self.written: dict[str, int] = {}

    def list_tracked_variants(self) -> list[TrackedVariant]:
        return self._tracked

    def write_price_points(self, variant_id: str, quote: PriceQuote) -> int:
        n = len(quote.points)
        self.written[variant_id] = self.written.get(variant_id, 0) + n
        return n


def _tracked(n: int) -> list[TrackedVariant]:
    return [
        TrackedVariant(variant_id=f"v{i}", tcgapi_card_id=str(i), finish=None,
                       game_code="one_piece")
        for i in range(n)
    ]


def test_run_daily_writes_points():
    sink = FakeSink(_tracked(3))
    result = run_daily(FakeProvider(), sink)
    assert isinstance(result, IngestResult)
    assert result.variants == 3
    assert result.points_written == 3
    assert result.errors == 0
    assert sink.written == {"v0": 1, "v1": 1, "v2": 1}


def test_run_daily_counts_errors_and_continues():
    sink = FakeSink(_tracked(3))
    # la carta id '1' falla; las otras dos deben ingerirse igual
    result = run_daily(FakeProvider(fail_ids={"1"}), sink)
    assert result.variants == 3
    assert result.errors == 1
    assert result.points_written == 2
    assert "v1" not in sink.written
