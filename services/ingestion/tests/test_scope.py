"""Tests del motor de reglas de alcance (scope.yaml real).

Enfoque: Pokémon = Special Illustration Rare; One Piece = SEC/SR Alternate Art
y Manga.
"""

from __future__ import annotations

import pytest

from scope import CardScope


@pytest.fixture(scope="module")
def scope() -> CardScope:
    return CardScope.load()


# --- Pokémon ------------------------------------------------------------------

@pytest.mark.parametrize(
    "rarity,expected",
    [
        ("Special Illustration Rare", True),
        ("Illustration Rare", False),   # NO (falta "special")
        ("Ultra Rare", False),
        ("Double Rare", False),
        ("Common", False),
    ],
)
def test_pokemon(scope, rarity, expected):
    assert scope.matches(game_code="pokemon", rarity=rarity, name="Charizard") is expected


# --- One Piece ----------------------------------------------------------------

@pytest.mark.parametrize(
    "rarity,name,expected",
    [
        # SEC/SR con marca de variante -> ENTRA
        ("SEC", "Portgas.D.Ace (118) (Alternate Art)", True),
        ("SR", "Edward.Newgate (Alternate Art)", True),
        ("SR", "Monkey.D.Luffy (Parallel)", True),
        ("Super Rare", "Luffy (Alternate Art)", True),      # forma con palabras
        # SEC/SR base (sin marca) -> NO
        ("SEC", "Portgas.D.Ace (118)", False),
        ("SR", "Monkey.D.Luffy", False),
        # Variantes de OTRAS rarezas -> NO (solo SEC/SR)
        ("C", "Inazuma (Full Art)", False),
        ("L", "Luffy & Ace (Parallel)", False),
        ("R", "Marco (Alternate Art)", False),
        ("TR", "Vista (TR)", False),
        # Base normales -> NO
        ("UC", "Izo", False),
    ],
)
def test_one_piece(scope, rarity, name, expected):
    assert scope.matches(game_code="one_piece", rarity=rarity, name=name) is expected


def test_unknown_game(scope):
    assert scope.matches(game_code="magic", rarity="Mythic", name="Black Lotus") is False


def test_match_label(scope):
    assert scope.match_label("one_piece", "SR", "X (Alternate Art)") == "SR variante"
    assert scope.match_label("pokemon", "Special Illustration Rare", "Y") == "Special Illustration Rare"
