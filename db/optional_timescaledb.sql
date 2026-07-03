-- OPCIONAL — Optimización con TimescaleDB.
-- Solo si el servidor tiene la extensión disponible (imagen timescaledb, RDS con
-- timescaledb, etc.). NO es necesario para el MVP: price_points funciona como
-- tabla Postgres normal. Ejecutar DESPUÉS de db/schema.sql.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convierte price_points en hypertable (particionado por tiempo).
SELECT create_hypertable('price_points', 'ts', if_not_exists => TRUE, migrate_data => TRUE);

-- Compresión de datos antiguos (>90 días) para ahorrar espacio.
ALTER TABLE price_points SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'variant_id'
);
SELECT add_compression_policy('price_points', INTERVAL '90 days');
