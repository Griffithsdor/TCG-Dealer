# Servicio de ingesta

Adaptadores de proveedores + jobs programados que traen precios y los normalizan
al modelo de `tcg_core`, escribiendo en `price_points`.

## Estado (Fase 0)

- `tcgapi_provider.py` — adaptador de ejemplo (stub) que implementa `PriceProvider`.
  Sirve de plantilla para el resto: `pokemontcg`, `ebay`, `pricecharting`.

## Diseño

- Un adaptador por fuente, todos implementan `tcg_core.providers.PriceProvider`.
- En AWS los jobs corren en Lambda/Fargate disparados por EventBridge, con SQS
  entre "qué actualizar" y "actualizar" para respetar rate limits y reintentar.
- Cadencia sugerida: precios de mercado diarios; listados de eBay más frecuentes.

## Próximo (Fase 1)

1. Implementar HTTP real en `TcgApiProvider`.
2. Añadir `PokemonTcgProvider` como segunda fuente / validación cruzada.
3. Job de ingesta + escritura idempotente en `price_points`.
