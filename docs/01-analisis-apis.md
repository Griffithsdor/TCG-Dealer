# Análisis de APIs y Esquema de Integración

> Cómo consumimos datos de precios, qué API usar para qué, y por dónde empezar.
> Complementa `00-diseno-plataforma.md`. Estado: Fase 0 → entrada a Fase 1.

---

## 1. La conclusión clave (léela primero)

**El histórico de precios de terceros es escaso y de baja resolución.** Ninguna
fuente accesible da un histórico profundo, diario y completo:

- La mayoría solo expone el **precio actual** (snapshot).
- Las que dan histórico lo dan **semanal**, casi todo **desde 2025**, y a menudo
  **solo cartas con precio ≥ $1**.
- El dato de **ventas reales cerradas** (eBay) está cerrado a no-partners.

**Implicación estratégica:** el histórico de terceros sirve para *arrancar*
(backfill inicial), pero **el activo real de la plataforma es nuestra propia
serie temporal**, construida haciendo *snapshot diario* desde el día 1 y
guardándola en TimescaleDB. Ese es el foso competitivo: dentro de 12 meses
tendremos un histórico diario propio que nadie regala hoy.

> Regla de oro: **empezar a capturar precios YA, aunque el producto aún no
> muestre nada.** Cada día que no capturamos es histórico que perdemos para siempre.

---

## 2. APIs evaluadas

### 2.1 Scrydex — *recomendada como fuente primaria*
Sucesora de la conocida `pokemontcg.io`. API unificada de catálogo + precios.

- **Cobertura:** Pokémon, One Piece, Magic, Lorcana, Yu-Gi-Oh! → **cubre nuestros dos juegos con una sola integración.**
- **Datos:** metadatos de carta, imágenes, precios de mercado, **histórico de precios** con variantes y condiciones (NM/LP/MP/DM), en USD.
- **Modelo de coste:** por créditos. La mayoría de requests = 1 crédito (un lookup de precios cubre **hasta 100 cartas**); **Price History = 3 créditos**; Vision (OCR) = 5. **NO hay tier gratuito.** Planes: Starter **$29/mes** (5.000 créditos ≈ 160 req/día), Growth $99 (50k), Professional $399 (250k), Enterprise a medida.
- **Por qué:** una sola API da catálogo + imágenes + precios raw **y graded + population reports (PSA/BGS/CGC)** + histórico para OP y Pokémon. Lo graded/pop es lo más valioso para análisis de inversión.
- **Cuándo:** su valor diferencial (graded + pop reports) justifica el pago en Fase 4. Para el MVP no es imprescindible (ver §8).

### 2.2 TCG API (tcgapi.dev) — *validación cruzada / respaldo*
- **Cobertura:** 89+ juegos (incluye OP y Pokémon).
- **Histórico:** endpoint `/cards/{id}/history`; datos **semanales desde marzo 2025**, solo cartas ≥ $1. Bulk hasta 50 cartas por request.
- **Coste:** Free 100/día · Hobby 1K · Starter 2.5K · Pro 10K · Business 50K req/día. **Licencia comercial solo en Pro/Business.** Sin overage: al llegar al límite → HTTP 429.
- **Por qué:** segunda fuente para contrastar precios (detectar outliers) y como plan B si Scrydex cambia condiciones.

### 2.3 JustTCG — *alternativa fuerte en condición/estadística*
- **Cobertura:** Pokémon, One Piece, YGO, MTG, Lorcana, Digimon, Union Arena.
- **Datos:** precios por **condición** (NM/LP/MP/HP/DMG, sealed, foil), basados en **SKU de TCGplayer**. `include_price_history` (7d/30d/90d/180d/1y) e `include_statistics`.
- **Por qué:** la granularidad por condición y SKU es la mejor para el análisis fino (nuestro modelo ya separa por condición). Buena candidata a fuente primaria alternativa a Scrydex.

### 2.4 eBay Browse API — *mercado secundario (Fase 4)*
- **Datos:** **listados activos** (asking price) → liquidez, nº de ofertas, dispersión de precios. **No** ventas cerradas.
- **Límite:** 5.000 llamadas/día gratis; ampliable gratis con el *Application Growth Check*.
- **Ventas cerradas** (Marketplace Insights): **restringido a partners aprobados** → solicitar en paralelo; alternativa Terapeak.

### 2.5 PriceCharting — *graded vs raw (Fase 4)*
- **Datos:** precio actual **raw y graduado** (PSA 9, PSA 10…) para OP y Pokémon.
- **Coste:** suscripción $4.99/mes o $39.99/año; token de 40 caracteres.
- **Límite importante:** la API **solo da valores actuales, NO histórico**. Útil para el *grading premium* (¿merece la pena graduar?), no para tendencias.

---

## 3. Matriz comparativa

| API | OP | Pokémon | Histórico | Resolución | Por condición | Graded | Coste arranque | Rol |
|---|:--:|:--:|:--:|---|:--:|:--:|---|---|
| **TCG API** | ✅ | ✅ | ✅ (≥$1) | semanal, desde 2025 | parcial | — | **Free 100/día** | **Primaria (MVP)** |
| **Scrydex** | ✅ | ✅ | ✅ | por punto/fecha | ✅ | ✅ **pop reports** | **$29/mes** (sin free) | Graded/pop (Fase 4) |
| **JustTCG** | ✅ | ✅ | ✅ | 7d–1y | ✅ (SKU) | — | Free (tier) | Alt. primaria (condición) |
| **eBay Browse** | ✅ | ✅ | — (activos) | tiempo real | — | — | Free 5k/día | Liquidez (Fase 4) |
| **eBay Insights** | ✅ | ✅ | ✅ (sold) | real | — | — | ❌ restringido | Ventas reales (solicitar) |
| **PriceCharting** | ✅ | ✅ | ❌ | snapshot | ✅ | ✅ | $4.99/mes | Grading premium (Fase 4) |
| ~~TCGplayer oficial~~ | — | — | — | — | — | — | ❌ cerrada | No usar directamente |

---

## 4. Esquema de integración (cómo encaja en el código)

Todo se apoya en la interfaz `PriceProvider` de `packages/core`. Distinguimos
**capacidades** (un proveedor puede cumplir una o varias):

```
                        ┌───────────────────────────┐
                        │      PriceProvider         │  (contrato de packages/core)
                        └───────────────────────────┘
                                    ▲
        ┌───────────────┬───────────┴────────┬────────────────┐
        │               │                    │                │
  CatalogProvider  HistoryProvider     ListingProvider   GradedProvider
  (cartas/sets)    (serie temporal)    (mercado 2º)      (raw vs PSA)
        │               │                    │                │
     Scrydex         Scrydex              eBay Browse     PriceCharting
     TCG API         JustTCG
                     TCG API
```

**Capacidades por proveedor:**

| Proveedor | Catálogo | Histórico | Listados | Graded |
|---|:--:|:--:|:--:|:--:|
| Scrydex | ✅ | ✅ | — | — |
| JustTCG | ✅ | ✅ | — | — |
| TCG API | ✅ | ✅ | — | — |
| eBay | — | — | ✅ | — |
| PriceCharting | — | (snapshot) | — | ✅ |

En código, esto se traduce en mixins/protocolos opcionales sobre `PriceProvider`
(`get_prices` ya existe; `get_listings` ya está previsto como opcional; se añade
`get_graded_prices` en Fase 4). El resto de la plataforma solo conoce las
capacidades, nunca la fuente concreta.

---

## 5. Consolidación de precios (fuente de verdad)

Con varias fuentes por carta, definimos precedencia por tipo de dato:

- **Precio de mercado de referencia:** fuente primaria (Scrydex). Si difiere de la
  secundaria (TCG API) más de un umbral (p.ej. ±15%), se marca como *sospechoso*
  y no se usa para señales hasta reconciliar.
- **Por condición:** JustTCG cuando exista (SKU de TCGplayer más preciso).
- **Graded:** PriceCharting (única fuente).
- **Liquidez / mercado secundario:** eBay Browse.

Cada `price_point` guarda su `source`, así que siempre sabemos de dónde viene y
podemos recomputar la consolidación cambiando reglas sin perder datos crudos.

---

## 6. Cadencia de ingesta

| Dato | Frecuencia | Fuente | Nota |
|---|---|---|---|
| Snapshot de precio de mercado | **Diario** | Scrydex | Construye NUESTRO histórico. Prioridad máxima. |
| Backfill histórico inicial | Una vez | Scrydex / TCG API | Bootstrap al añadir una carta. |
| Catálogo (sets/cartas nuevas) | Semanal | Scrydex | Detectar nuevos sets. |
| Listados eBay (liquidez) | Diario o 2×/día | eBay Browse | Fase 4. |
| Graded | Semanal | PriceCharting | Fase 4. |

La ingesta corre en Lambda/Fargate vía EventBridge + SQS (ya previsto en
`infra/`). Respetar rate limits: batch + backoff, y priorizar por valor/popularidad
de la carta cuando el cupo diario sea limitado.

---

## 7. Presupuesto de requests (realismo del cupo)

Ejemplo con TCG API free (100 req/día) y snapshot diario:

- Con lookups en bulk (varias cartas por request) alcanzas para **cientos de
  cartas/día** dentro del free tier, suficiente para un MVP enfocado en tu
  cartera + watchlist + top cartas de inversión.
- Si más adelante usas Scrydex Starter ($29/mes, 5.000 créditos): un lookup cubre
  **hasta 100 cartas = 1 crédito**, así que 300 cartas/día ≈ 90 créditos/mes.
  El límite no es el cupo, es el coste fijo mensual.
- Al escalar (miles de cartas o SaaS) → subir de tier o endpoints bulk.

**Estrategia de cupo:** no intentar cubrir todo el catálogo desde el día 1.
Priorizar (1) tu cartera, (2) tu watchlist, (3) top cartas por valor/popularidad
de cada set. Expandir cobertura conforme suba el tier.

---

## 8. Recomendación para empezar

**Stack de datos del MVP (Fase 1) — arranque a coste $0:**

1. **Fuente primaria: TCG API (tcgapi.dev)** — **tier gratuito (100 req/día)**,
   cubre OP + Pokémon con catálogo y precios actuales. Como construimos nuestro
   propio histórico con snapshots diarios, no necesitamos el histórico profundo
   de un proveedor de pago para empezar.
2. **Snapshot diario propio desde el día 1** — el job de ingesta escribe en
   `price_points` cada día. Esto es lo más importante de la Fase 1.
3. **Aplazar a Fase 4 (cuando aporte valor real):**
   - **Scrydex ($29/mes)** — por sus **datos graded + population reports (PSA/BGS)**,
     clave para valorar cartas de inversión. Se activa cuando el MVP lo justifique.
   - **eBay Browse** (liquidez) y **PriceCharting** (graded snapshot, $4.99/mes).
   - **Solicitar ya** acceso a eBay Marketplace Insights (proceso lento).

> Coste del MVP: **$0**. Primer coste opcional (Scrydex $29/mes) solo cuando
> quieras análisis de graded/población, no antes.

**Primeros pasos concretos:**

1. Crear cuenta y API key en **Scrydex** (y en tcgapi.dev, gratis).
2. Implementar `ScrydexProvider(PriceProvider)` en `services/ingestion/`
   (usar `tcgapi_provider.py` como plantilla): `search`, `get_variants`, `get_prices`.
3. Poblar catálogo de un set de cada juego (p.ej. OP-01 y un set Pokémon) como prueba.
4. Job diario de snapshot → `price_points`.
5. Endpoint `/v1/cards/{id}` que devuelva ficha + serie temporal.

Con eso tienes el bucle completo end-to-end sobre un subconjunto, listo para
añadir el motor de análisis (Fase 2) encima de datos reales.

---

## 9. Riesgos y mitigaciones

- **Dependencia de una API:** la capa `PriceProvider` permite cambiar de fuente sin
  reescribir. Mantener siempre ≥2 proveedores de histórico integrados.
- **Cambios de términos/precio:** ya pasó con TCGplayer oficial. Por eso no
  dependemos de ella y guardamos datos crudos propios.
- **Límites de cupo:** priorización por valor + endpoints bulk + caché.
- **Términos comerciales:** el free tier suele ser *no comercial*. Al pasar a SaaS
  (Fase 6) subir a planes con licencia comercial (TCG API Business, tier Scrydex).
- **Ventas cerradas eBay:** asumir que puede no llegar; el histórico propio de
  precios de mercado cubre la mayor parte del análisis igualmente.
