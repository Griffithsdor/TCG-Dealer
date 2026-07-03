# Base de datos

PostgreSQL con la extensión **TimescaleDB** para las series temporales de precios.

## Ficheros

- `schema.sql` — esquema completo (catálogo, mapeos, series temporales, snapshots, usuarios, cartera).
- `seed_games.sql` — inserta los juegos iniciales (One Piece, Pokémon).

## Local (Docker)

```bash
make db-up      # levanta timescale/timescaledb en :5432
make db-init    # aplica schema.sql + seed_games.sql
```

## Puntos clave del diseño

- **`card_variants`** es la unidad mínima de precio (distingue holo/alt-art/idioma/finish).
- **`source_mappings`** cruza cada variante con su ID en TCGplayer, Cardmarket, eBay, etc.
  Esto permite consolidar precios de fuentes distintas sobre la misma carta.
- **`price_points`** es una *hypertable* de TimescaleDB: pensada para millones de filas.
  Tiene comentada una política de compresión/retención lista para activar.
- **`analytics_snapshots`** guarda las métricas ya calculadas (SMA/RSI/volatilidad/señal)
  para que el dashboard no tenga que recalcular en cada request.

## Migraciones

En Fase 1 se añadirá una herramienta de migraciones (Alembic o `sqitch`).
Por ahora `schema.sql` es la fuente de verdad idempotente para desarrollo.
