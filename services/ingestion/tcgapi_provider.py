"""Adaptador de tcgapi.dev — fuente primaria del MVP (free tier).

Implementa `PriceProvider` contra la API REST de https://api.tcgapi.dev/v1.
Autenticación por cabecera `X-API-Key`. En el free tier (100 req/día) están
disponibles catálogo y precios ACTUALES; el histórico (`/cards/:id/history`)
requiere Pro, por eso construimos nuestro propio histórico con snapshots diarios
de `get_prices`.

Endpoints usados:
    GET /v1/sets?game=<slug>          -> list_sets
    GET /v1/sets/:id/cards            -> list_cards
    GET /v1/cards/:id                 -> (metadatos)
    GET /v1/cards/:id/prices          -> get_variants / get_prices (snapshot)
    GET /v1/search?q=&game=           -> search
    GET /v1/cards/:id/history         -> get_history (requiere Pro)

Testeable: acepta un `httpx.Client` inyectado (los tests usan MockTransport).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from tcg_core.domain import Card, CardVariant, PriceKind, PricePoint, PriceQuote, Set
from tcg_core.providers.base import PriceProvider, ProviderError

# Código interno de juego -> slug de tcgapi.dev
_GAME_SLUGS = {
    "one_piece": "one-piece-card-game",
    "pokemon": "pokemon",
}
_MAX_PER_PAGE = 100


class TcgApiProvider(PriceProvider):
    source = "tcgapi"

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = "https://api.tcgapi.dev/v1",
        client: httpx.Client | None = None,
        timeout: float = 20.0,
    ) -> None:
        self.api_key = api_key or os.getenv("TCGAPI_KEY")
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(timeout=timeout)

    # -- capacidades -----------------------------------------------------------
    def supports(self, game_code: str) -> bool:
        return game_code in _GAME_SLUGS

    # -- HTTP -----------------------------------------------------------------
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {"X-API-Key": self.api_key or ""}
        try:
            resp = self._client.get(
                f"{self.base_url}{path}", params=params, headers=headers
            )
        except httpx.HTTPError as exc:  # red caída, timeout, DNS...
            raise ProviderError(f"tcgapi: fallo de red en {path}: {exc}") from exc

        if resp.status_code == 429:
            raise ProviderError("tcgapi: límite diario alcanzado (HTTP 429)")
        if resp.status_code == 401:
            raise ProviderError("tcgapi: API key inválida o ausente (HTTP 401)")
        if resp.status_code >= 400:
            raise ProviderError(f"tcgapi: HTTP {resp.status_code} en {path}")
        return resp.json()

    def _paginate(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Recorre todas las páginas de un endpoint de listado."""
        out: list[dict[str, Any]] = []
        page = 1
        while True:
            body = self._get(path, {**params, "page": page, "per_page": _MAX_PER_PAGE})
            rows = body.get("data") or body.get("results") or []
            out.extend(rows)
            if len(rows) < _MAX_PER_PAGE:
                break
            page += 1
        return out

    # -- catálogo --------------------------------------------------------------
    def list_sets(self, game_code: str) -> list[Set]:
        if not self.supports(game_code):
            return []
        rows = self._paginate("/sets", {"game": _GAME_SLUGS[game_code]})
        return [self._parse_set(game_code, r) for r in rows]

    def list_cards(self, set_: Set) -> list[Card]:
        set_id = set_.external_ids.get(self.source)
        if not set_id:
            return []
        rows = self._paginate(f"/sets/{set_id}/cards", {})
        return [self._parse_card(set_.game_code, r, default_set_code=set_.code) for r in rows]

    def search(self, game_code: str, query: str) -> list[Card]:
        if not self.supports(game_code):
            raise ProviderError(f"tcgapi no soporta el juego: {game_code}")
        body = self._get(
            "/search", {"q": query, "game": _GAME_SLUGS[game_code], "limit": 25}
        )
        rows = body.get("results") or body.get("data") or []
        return [self._parse_card(game_code, r) for r in rows]

    # -- variantes y precios ---------------------------------------------------
    def get_variants(self, card: Card) -> list[CardVariant]:
        card_id = card.external_ids.get(self.source)
        if not card_id:
            return [CardVariant(card=card)]
        rows = _as_list(self._get(f"/cards/{card_id}/prices").get("data"))
        printings = {r.get("printing", "Normal") for r in rows} or {"Normal"}
        return [
            CardVariant(card=card, variant=_norm_variant(p), finish=p)
            for p in sorted(printings)
        ]

    def get_prices(
        self, variant: CardVariant, *, since: datetime | None = None
    ) -> PriceQuote:
        card = variant.card
        card_id = card.external_ids.get(self.source)
        if not card_id:
            raise ProviderError("tcgapi: la carta no tiene external_id 'tcgapi'")

        params = {"printing": variant.finish} if variant.finish else None
        rows = _as_list(self._get(f"/cards/{card_id}/prices", params).get("data"))

        # Filtrado defensivo por impresión. En el MVP, si no se especifica
        # impresión, usamos la PRIMARIA (Normal si existe) → una serie por carta.
        if variant.finish:
            rows = [r for r in rows if str(r.get("printing")) == variant.finish]
        elif rows:
            primary = _primary_printing(rows)
            rows = [r for r in rows if str(r.get("printing")) == primary]

        points: list[PricePoint] = []
        for r in rows:
            ts = _parse_ts(r.get("last_updated_at"))
            for field, kind in (("market_price", PriceKind.MARKET), ("low_price", PriceKind.LOW)):
                price = _to_decimal(r.get(field))
                if price is not None:
                    points.append(
                        PricePoint(
                            source=self.source,
                            condition="NM",
                            price=price,
                            currency="USD",
                            kind=kind,
                            ts=ts,
                        )
                    )
        return PriceQuote(
            source=self.source,
            external_id=str(card_id),
            external_url=card.external_ids.get(f"{self.source}_url"),
            points=points,
        )

    def get_history(
        self, variant: CardVariant, *, range_: str = "month"
    ) -> PriceQuote:
        """Histórico de la API (requiere plan Pro). En free tier devuelve 429/403."""
        card_id = variant.card.external_ids.get(self.source)
        if not card_id:
            raise ProviderError("tcgapi: la carta no tiene external_id 'tcgapi'")
        params: dict[str, Any] = {"range": range_}
        if variant.finish:
            params["printing"] = variant.finish
        rows = _as_list(self._get(f"/cards/{card_id}/history", params).get("data"))
        points = [
            PricePoint(
                source=self.source,
                condition="NM",
                price=p,
                currency="USD",
                kind=PriceKind.MARKET,
                ts=_parse_ts(r.get("date")),
            )
            for r in rows
            if (p := _to_decimal(r.get("market_price"))) is not None
        ]
        return PriceQuote(source=self.source, external_id=str(card_id), points=points)

    # -- parseo ----------------------------------------------------------------
    def _parse_set(self, game_code: str, r: dict[str, Any]) -> Set:
        return Set(
            game_code=game_code,
            code=str(r.get("abbreviation") or r.get("slug") or r.get("id") or ""),
            name=r.get("name", ""),
            release_date=_parse_ts(r.get("release_date"), allow_none=True),
            external_ids={self.source: str(r["id"])} if r.get("id") is not None else {},
        )

    def _parse_card(
        self, game_code: str, r: dict[str, Any], *, default_set_code: str | None = None
    ) -> Card:
        ext = {}
        if r.get("id") is not None:
            ext[self.source] = str(r["id"])
        if r.get("tcgplayer_url"):
            ext[f"{self.source}_url"] = str(r["tcgplayer_url"])
        if r.get("tcgplayer_id") is not None:
            ext["tcgplayer"] = str(r["tcgplayer_id"])
        return Card(
            game_code=game_code,
            set_code=str(r.get("set_abbreviation") or default_set_code or r.get("set_id") or ""),
            number=str(r.get("number", "")),
            name=r.get("name", ""),
            rarity=r.get("rarity"),
            image_url=r.get("image_url"),
            external_ids=ext,
        )


# --- helpers de módulo --------------------------------------------------------

def _as_list(data: Any) -> list[dict[str, Any]]:
    """La API devuelve lista o un único objeto (cartas con una sola impresión)."""
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _parse_ts(value: Any, *, allow_none: bool = False) -> datetime:
    if not value:
        if allow_none:
            return None  # type: ignore[return-value]
        return datetime.now(timezone.utc)
    text = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        # fecha simple 'YYYY-MM-DD'
        dt = datetime.fromisoformat(text[:10])
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _primary_printing(rows: list[dict[str, Any]]) -> str:
    """Impresión primaria: 'Normal' si está; si no, la primera disponible."""
    printings = [str(r.get("printing")) for r in rows]
    return "Normal" if "Normal" in printings else printings[0]


def _norm_variant(printing: str) -> str:
    p = printing.lower()
    if "reverse" in p:
        return "reverse_holo"
    if "holo" in p or "foil" in p:
        return "holo"
    return "normal"
