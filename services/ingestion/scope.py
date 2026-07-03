"""Política de alcance de cartas (motor de reglas).

Decide qué cartas rastrea la plataforma. Enfoque actual:
    Pokémon:   Special Illustration Rare.
    One Piece: SEC Alternate Art, SR Alternate Art, Manga.

Cargado desde `scope.yaml`. Una carta entra si cumple CUALQUIER regla de su
juego; dentro de una regla las condiciones (`rarity_any`, `name_any`) van con
AND, y cada una se cumple si el texto contiene alguno de sus términos.

Uso:
    from scope import CardScope
    scope = CardScope.load()
    if scope.matches(game_code="one_piece", rarity="Super Rare",
                     name="Luffy (Alternate Art)"):
        ...  # rastrear
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import yaml

_DEFAULT_PATH = Path(__file__).with_name("scope.yaml")


@dataclass
class Rule:
    label: str
    rarity_any: list[str] = field(default_factory=list)
    name_any: list[str] = field(default_factory=list)

    def matches(self, rarity: str | None, name: str | None) -> bool:
        # Una regla vacía no matchea nada (evita capturar todo por error).
        if not self.rarity_any and not self.name_any:
            return False
        r = (rarity or "").lower()
        n = (name or "").lower()
        if self.rarity_any and not any(t in r for t in self.rarity_any):
            return False
        if self.name_any and not any(t in n for t in self.name_any):
            return False
        return True


@dataclass
class GameScope:
    min_market_price: Decimal
    rules: list[Rule] = field(default_factory=list)
    manual_include: set[str] = field(default_factory=set)
    manual_exclude: set[str] = field(default_factory=set)

    def qualifying_rule(self, rarity: str | None, name: str | None) -> str | None:
        """Devuelve la etiqueta de la primera regla que matchea, o None."""
        for rule in self.rules:
            if rule.matches(rarity, name):
                return rule.label
        return None


@dataclass
class CardScope:
    games: dict[str, GameScope]

    # -- carga -----------------------------------------------------------------
    @classmethod
    def load(cls, path: str | os.PathLike[str] | None = None) -> CardScope:
        raw = yaml.safe_load(Path(path or _DEFAULT_PATH).read_text())
        defaults = raw.get("defaults", {})
        games: dict[str, GameScope] = {}
        for code, cfg in (raw.get("games") or {}).items():
            rules = [
                Rule(
                    label=str(r.get("label", "")),
                    rarity_any=[t.lower() for t in r.get("rarity_any", [])],
                    name_any=[t.lower() for t in r.get("name_any", [])],
                )
                for r in cfg.get("rules", [])
            ]
            games[code] = GameScope(
                min_market_price=Decimal(
                    str(cfg.get("min_market_price", defaults.get("min_market_price", 0)))
                ),
                rules=rules,
                manual_include=set(cfg.get("manual_include", []) or []),
                manual_exclude=set(cfg.get("manual_exclude", []) or []),
            )
        return cls(games=games)

    # -- evaluación ------------------------------------------------------------
    def matches(
        self,
        *,
        game_code: str,
        rarity: str | None = None,
        name: str | None = None,
        market_price: Decimal | None = None,
        external_id: str | None = None,
    ) -> bool:
        """True si la carta debe rastrearse según la política."""
        gs = self.games.get(game_code)
        if gs is None:
            return False
        if external_id and external_id in gs.manual_exclude:
            return False
        if external_id and external_id in gs.manual_include:
            return True
        if gs.qualifying_rule(rarity, name) is None:
            return False
        if market_price is not None and market_price < gs.min_market_price:
            return False
        return True

    def match_label(self, game_code: str, rarity: str | None, name: str | None) -> str | None:
        """Etiqueta de la regla que matchea (útil para diagnóstico)."""
        gs = self.games.get(game_code)
        return gs.qualifying_rule(rarity, name) if gs else None
