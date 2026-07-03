"""Demo local end-to-end del bucle de datos de la Fase 1.

Recorre: catálogo (1 set por juego) → filtro de alcance → alta en BD →
snapshot de precios → muestra las cartas con su último precio.

LIMITADO a propósito para no agotar el cupo gratuito de tcgapi.dev (100 req/día):
por defecto 1 set por juego y tope de 25 precios.

Requisitos (variables de entorno):
    DATABASE_URL   p.ej. postgresql://tcg:tcg@localhost:5432/tcg
    TCGAPI_KEY     tu API key gratis de https://tcgapi.dev/signup

Uso:
    cd services/ingestion
    python demo.py                 # ambos juegos, 1 set c/u, 25 precios
    python demo.py --game pokemon --max-sets 1 --limit 15
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

from catalog_sync import GAMES, sync_game
from db import connect
from price_ingest import run_daily
from repository import PgCatalogRepository
from scope import CardScope
from tcgapi_provider import TcgApiProvider


def _check_env(names: tuple[str, ...]) -> None:
    missing = [v for v in names if not os.getenv(v)]
    if missing:
        print(f"ERROR: faltan variables de entorno: {', '.join(missing)}")
        if "DATABASE_URL" in missing:
            print("  export DATABASE_URL=postgresql://tcg:tcg@localhost:5432/tcg")
        if "TCGAPI_KEY" in missing:
            print("  export TCGAPI_KEY=tcg_live_tu_key")
        sys.exit(1)


_KEYWORDS = ["alt", "parallel", "manga", "special", "full art", "sp-", " sp", "promo"]


def list_rarities(games: list[str], max_sets: int) -> None:
    """Diagnóstico: muestra rarezas reales, ejemplos de nombre/número y caza
    patrones de alt-art/manga. No escribe en BD. Calibra scope.yaml sin adivinar."""
    _check_env(("TCGAPI_KEY",))
    scope = CardScope.load()
    provider = TcgApiProvider()
    for game in games:
        print(f"\n== {game}: rarezas (primeros {max_sets} set/s) ==")
        rar: dict[str, dict] = {}
        hits: list[tuple[str, str]] = []
        for i, set_ in enumerate(provider.list_sets(game)):
            if i >= max_sets:
                break
            for card in provider.list_cards(set_):
                r = card.rarity or "(sin rareza)"
                d = rar.setdefault(r, {"count": 0, "samples": []})
                d["count"] += 1
                label = f"{card.name} (#{card.number})"
                if len(d["samples"]) < 4 and label not in d["samples"]:
                    d["samples"].append(label)
                low = (card.name or "").lower()
                if any(k in low for k in _KEYWORDS):
                    hits.append((r, label))
        if not rar:
            print("  (sin datos)")
            continue
        for rarity, d in sorted(rar.items()):
            in_scope = scope.matches(game_code=game, rarity=rarity, name=d["samples"][0])
            mark = "✓ EN ALCANCE" if in_scope else "·"
            print(f"  [{mark}] {rarity!r}  x{d['count']}")
            for s in d["samples"]:
                print(f"        {s}")
        if hits:
            print("  -- nombres con alt/parallel/manga/special/promo --")
            for r, n in hits[:25]:
                print(f"     [{r}] {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo local del bucle de datos")
    parser.add_argument("--game", choices=[*GAMES, "all"], default="all")
    parser.add_argument("--max-sets", type=int, default=1)
    parser.add_argument("--limit", type=int, default=25, help="tope de precios a pedir")
    parser.add_argument(
        "--list-rarities", action="store_true",
        help="solo lista las rarezas reales de la API (no escribe en BD)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    games = list(GAMES) if args.game == "all" else [args.game]

    if args.list_rarities:
        list_rarities(games, args.max_sets)
        return

    _check_env(("DATABASE_URL", "TCGAPI_KEY"))
    scope = CardScope.load()
    provider = TcgApiProvider()

    with connect() as conn:
        repo = PgCatalogRepository(conn)

        print("\n== 1) Catálogo + filtro de alcance ==")
        for game in games:
            r = sync_game(
                game_code=game, provider=provider, repo=repo,
                scope=scope, max_sets=args.max_sets,
            )
            print(
                f"  {game}: {r.added_cards} cartas en alcance "
                f"(+{r.new_sets} sets, {r.skipped_out_of_scope} fuera, "
                f"{r.scanned_cards} revisadas)"
            )

        print("\n== 2) Snapshot de precios ==")
        ingest = run_daily(provider, repo, limit=args.limit)
        print(
            f"  {ingest.points_written} puntos escritos de "
            f"{ingest.variants} variantes ({ingest.errors} errores)"
        )

        print("\n== 3) Muestra: cartas con su último precio de mercado ==")
        _print_sample(conn)


def _print_sample(conn, n: int = 10) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.name, c.rarity, s.code AS set_code, g.code AS game,
                   pp.price, pp.currency, pp.ts
            FROM price_points pp
            JOIN card_variants cv ON cv.id = pp.variant_id
            JOIN cards c ON c.id = cv.card_id
            JOIN sets s ON s.id = c.set_id
            JOIN games g ON g.id = c.game_id
            WHERE pp.kind = 'market'
              AND pp.ts = (
                  SELECT max(ts) FROM price_points p2
                  WHERE p2.variant_id = pp.variant_id AND p2.kind = 'market'
              )
            ORDER BY pp.price DESC
            LIMIT %s
            """,
            (n,),
        )
        rows = cur.fetchall()
    if not rows:
        print("  (sin precios todavía)")
        return
    for name, rarity, set_code, game, price, currency, ts in rows:
        print(f"  {price:>8.2f} {currency}  {name} [{rarity}] {game}/{set_code}")


if __name__ == "__main__":
    main()
