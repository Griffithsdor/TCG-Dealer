-- =============================================================================
-- TCG Price Intelligence — Esquema de datos (PostgreSQL)
-- Fase 0. Diseño game-agnostic y multiusuario.
--
-- Convenciones:
--   * UUIDs como PK internas vía gen_random_uuid() (nativo en Postgres 13+,
--     sin extensiones). Funciona en Postgres normal, Homebrew, RDS, Neon, etc.
--   * IDs de fuentes externas NUNCA se usan como PK: se mapean en source_mappings.
--   * price_points es la tabla de series temporales. TimescaleDB es OPCIONAL:
--     para convertirla en hypertable (optimización), ver db/optional_timescaledb.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CATÁLOGO
-- -----------------------------------------------------------------------------

-- Juego soportado (one_piece, pokemon, ...)
CREATE TABLE games (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,          -- 'one_piece', 'pokemon'
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set / expansión
CREATE TABLE sets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    code          TEXT NOT NULL,               -- 'OP-01', 'sv1', ...
    name          TEXT NOT NULL,
    release_date  DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (game_id, code)
);

-- Carta canónica (sin variante). Ej.: "Monkey D. Luffy OP01-001"
CREATE TABLE cards (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id      UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    set_id       UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    number       TEXT NOT NULL,                -- número dentro del set
    name         TEXT NOT NULL,
    rarity       TEXT,
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (set_id, number)
);
CREATE INDEX idx_cards_game ON cards(game_id);
CREATE INDEX idx_cards_name ON cards USING gin (to_tsvector('simple', name));

-- Variante concreta = UNIDAD MÍNIMA DE PRECIO.
-- Distingue holo/alt-art/manga, idioma y condición base.
CREATE TABLE card_variants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    variant      TEXT NOT NULL DEFAULT 'normal',   -- normal|holo|alt_art|manga|...
    language     TEXT NOT NULL DEFAULT 'EN',       -- EN|JP|ES|...
    finish       TEXT,                             -- foil, reverse_holo, ...
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, variant, language, finish)
);
CREATE INDEX idx_variants_card ON card_variants(card_id);

-- -----------------------------------------------------------------------------
-- MAPEO A FUENTES EXTERNAS
-- Cruza cada variante con su identificador en cada proveedor.
-- Esto es lo que permite consolidar precios de fuentes distintas.
-- -----------------------------------------------------------------------------
CREATE TABLE source_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id      UUID NOT NULL REFERENCES card_variants(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,              -- 'tcgplayer','cardmarket','ebay','pricecharting'
    external_id     TEXT NOT NULL,              -- id/product_id/query en la fuente
    external_url    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, external_id),
    UNIQUE (variant_id, source)
);
CREATE INDEX idx_mappings_variant ON source_mappings(variant_id);

-- -----------------------------------------------------------------------------
-- SERIES TEMPORALES DE PRECIOS (hypertable)
-- -----------------------------------------------------------------------------
CREATE TABLE price_points (
    variant_id   UUID NOT NULL REFERENCES card_variants(id) ON DELETE CASCADE,
    source       TEXT NOT NULL,                 -- de dónde viene el precio
    condition    TEXT NOT NULL DEFAULT 'NM',    -- NM|LP|MP|HP|DMG|graded_psa10...
    price        NUMERIC(12,2) NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'USD',
    kind         TEXT NOT NULL DEFAULT 'market',-- market|low|mid|high|listing|sold
    ts           TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (variant_id, source, condition, kind, ts)
);
CREATE INDEX idx_price_points_variant_ts ON price_points (variant_id, ts DESC);
-- Opcional (optimización): convertir en hypertable de TimescaleDB con
-- db/optional_timescaledb.sql. No es necesario para el MVP.

-- -----------------------------------------------------------------------------
-- SNAPSHOTS DE ANALÍTICA (precomputados para servir el dashboard rápido)
-- -----------------------------------------------------------------------------
CREATE TABLE analytics_snapshots (
    variant_id      UUID PRIMARY KEY REFERENCES card_variants(id) ON DELETE CASCADE,
    price_current   NUMERIC(12,2),
    currency        TEXT DEFAULT 'USD',
    change_24h      NUMERIC(8,4),
    change_7d       NUMERIC(8,4),
    change_30d      NUMERIC(8,4),
    change_90d      NUMERIC(8,4),
    sma_7           NUMERIC(12,2),
    sma_30          NUMERIC(12,2),
    sma_90          NUMERIC(12,2),
    volatility_30d  NUMERIC(8,4),
    rsi_14          NUMERIC(6,2),
    ath             NUMERIC(12,2),
    atl             NUMERIC(12,2),
    signal          TEXT,                        -- buy|hold|sell
    liquidity_score NUMERIC(6,2),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- USUARIOS Y CARTERA (reservado desde el MVP; SaaS en Fase 6)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT NOT NULL UNIQUE,
    display_name TEXT,
    plan         TEXT NOT NULL DEFAULT 'personal', -- personal|free|pro
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posiciones de la cartera (colección como portfolio)
CREATE TABLE portfolio_holdings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id    UUID NOT NULL REFERENCES card_variants(id) ON DELETE RESTRICT,
    condition     TEXT NOT NULL DEFAULT 'NM',
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    cost_basis    NUMERIC(12,2) NOT NULL,        -- precio de compra por unidad
    currency      TEXT NOT NULL DEFAULT 'USD',
    acquired_at   DATE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holdings_user ON portfolio_holdings(user_id);

-- Watchlist (seguimiento sin poseer)
CREATE TABLE watchlist_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id  UUID NOT NULL REFERENCES card_variants(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, variant_id)
);

-- Reglas de alerta
CREATE TABLE alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id  UUID NOT NULL REFERENCES card_variants(id) ON DELETE CASCADE,
    rule_type   TEXT NOT NULL,                   -- price_above|price_below|pct_change|signal_cross|arbitrage
    threshold   NUMERIC(12,4),
    channel     TEXT NOT NULL DEFAULT 'email',   -- email|push|webhook
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_fired  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active;
