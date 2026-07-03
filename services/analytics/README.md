# Motor de análisis

Convierte las series de `price_points` en métricas por variante y las guarda en
`analytics_snapshots`, que la API sirve en la ficha de carta.

## Núcleo (Python puro, sin numpy/pandas)

- `indicators.py` — SMA, EMA, RSI, volatilidad, ATH/ATL. Funciones puras que
  **degradan con elegancia**: devuelven None si no hay puntos suficientes.
- `engine.py` — `compute_snapshot(series)` → `Snapshot` con cambios %
  (24h/7d/30d/90d), medias, volatilidad, RSI y una **señal buy/hold/sell**.
- `repository.py` / `run.py` — persistencia (psycopg) y runner del job.

## Métricas

- Precio actual, cambios % (24h/7d/30d/90d) desde nuestra serie.
- Medias móviles SMA 7/30/90.
- Volatilidad 30d (desviación de retornos, %).
- RSI(14) — sobrecompra/sobreventa.
- ATH/ATL.
- Señal compuesta (informativa, **no** asesoramiento financiero).

## Arranque en frío

Con poca historia, cada métrica que aún no tiene ventana suficiente vale None y
se ilumina conforme el snapshot diario acumula datos: cambio de 7d tras una
semana, SMA30 y RSI tras un mes, etc. El motor funciona desde el día 1.

## Uso

```bash
make analyze   # recalcula analytics_snapshots (requiere DATABASE_URL)
```

Se ejecuta tras cada ingesta (o por la regla de EventBridge). Después, la API
`GET /v1/cards/{id}` devuelve la señal y los cambios en cada variante.
