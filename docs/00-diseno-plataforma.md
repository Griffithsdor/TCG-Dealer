# TCG Price Intelligence — Documento de Diseño y Funcionalidades

> Plataforma de análisis financiero y seguimiento de precios para cartas de TCG.
> Arranque simultáneo con **One Piece Card Game** y **Pokémon TCG**.
> Estado: v0.1 — Definición de lógica y funcionalidades.

---

## 1. Visión

Construir una plataforma que trate cada carta coleccionable como un **activo financiero**: precio de mercado, histórico, tendencia, volatilidad, señales de compra/venta, arbitraje entre mercados y seguimiento de una cartera personal con su ROI y P&L.

El objetivo no es "otro price checker", sino una capa de **inteligencia de inversión** sobre los datos de precios: el usuario busca una carta y obtiene un análisis del tipo "activo financiero" (igual que un dashboard de una acción), no solo el precio actual.

**Enfoque de producto:** empezar como herramienta personal (MVP monousuario), pero con una arquitectura ya preparada para abrirla como **SaaS multiusuario** más adelante sin reescribir el núcleo.

**Juegos en el arranque:** One Piece y Pokémon a la vez. El modelo de datos se diseña **agnóstico al juego** (game-agnostic) desde el día 1, de modo que añadir Magic, Lorcana o Yu-Gi-Oh! después sea configuración, no reingeniería.

---

## 2. Realidad de las fuentes de datos (crítico)

Esta sección condiciona toda la arquitectura, así que va primero. Conclusiones tras revisar el estado actual de las APIs:

| Fuente | ¿Precios? | ¿Acceso directo hoy? | Notas |
|---|---|---|---|
| **API oficial TCGplayer** | Sí (mercado US) | ❌ Prácticamente cerrada | Tras la compra por eBay, no aceptan nuevas solicitudes públicas de developer. **No contar con acceso directo.** |
| **Pokémon TCG API** (pokemontcg.io / Scrydex) | Sí — incluye precios TCGplayer (USD) y Cardmarket (EUR) | ✅ Con API key | Vía preferida para Pokémon. Reexpone precios de TCGplayer legalmente. |
| **APIs One Piece** (optcgapi.com, one-piece-api.com, tcgapi.dev) | Sí — precios TCGplayer, algunas con histórico y Cardmarket | ✅ Free / de pago | Cubren el catálogo completo de OP + precios de mercado. |
| **TCG API** (tcgapi.dev) | Sí — 85+ juegos, refresco diario | ✅ Free 100 req/día; Pro $49.99, Business $99.99 (licencia comercial) | Candidata a **fuente unificada** para OP + Pokémon con una sola integración. |
| **PriceCharting API** | Sí — incluye graded (PSA) y ungraded, OP y Pokémon | ✅ De pago | Muy fuerte en **precios de cartas graduadas** y guías de precio. |
| **eBay Browse API** (listados activos) | Sí (activos) | ✅ Accesible | Para "asking price" y liquidez del mercado secundario. |
| **eBay Marketplace Insights** (ventas cerradas) | Sí (sold/completed) | ❌ Restringida a partners aprobados | El dato de **ventas reales** es el más valioso y el más difícil. Requiere aprobación o alternativas (Terapeak). |
| **Cardmarket** (mercado EU) | Sí | Parcial | Precios EU vía las APIs agregadoras anteriores. |

**Implicaciones de diseño:**

1. **No dependemos de la API oficial de TCGplayer.** Consumimos sus precios de forma legal a través de agregadores que ya los reexponen (Pokémon TCG API, APIs de One Piece, TCG API).
2. **Capa de abstracción de fuentes (Data Provider Layer):** todo proveedor implementa la misma interfaz. Si mañana cae una API o cambia el pricing, se cambia el adaptador, no la plataforma.
3. **El dato de ventas cerradas de eBay es el "santo grial".** Plan por fases: MVP con listados activos (Browse API) + precios de agregadores; solicitar Marketplace Insights en paralelo; evaluar Terapeak / proveedores de datos como respaldo.
4. **Legalidad primero:** priorizar APIs con términos de uso claros sobre scraping. El scraping se contempla solo como último recurso, respetando `robots.txt` y ToS, y nunca como base de un producto comercial (riesgo legal alto, sobre todo con eBay/TCGplayer).

---

## 3. Módulos funcionales

La plataforma se organiza en módulos desacoplados:

### 3.1 Catálogo (Card Catalog)
- Base de datos maestra de cartas de OP y Pokémon: set, número, rareza, variante (normal/holo/alt-art/manga), idioma, imágenes.
- Identificador canónico interno por carta + variante, mapeado a los IDs de cada fuente externa (clave para cruzar precios entre proveedores).
- Búsqueda y filtrado: por nombre, set, rareza, precio, tendencia.

### 3.2 Ingesta de precios (Price Ingestion)
- Jobs programados que consultan cada proveedor y normalizan a un formato común.
- Almacenamiento de **series temporales** de precios por carta/variante/condición/fuente.
- Deduplicación y control de calidad (outliers, precios "basura", spikes falsos).

### 3.3 Motor de análisis financiero (Analytics Engine)
El corazón del producto. Ver sección 4.

### 3.4 Cartera / Portfolio
Seguimiento de la colección del usuario como una cartera de inversión. Ver sección 5.

### 3.5 Alertas y señales (Alerts)
- Alertas por umbral de precio, por cambio %, por cruce de señal técnica, por oportunidad de arbitraje.
- Canales: email / push / (futuro) webhook.

### 3.6 API pública / Frontend
- API interna que sirve al frontend web.
- Dashboard por carta (vista "activo financiero"), buscador, vista de cartera, panel de alertas.

### 3.7 (SaaS) Cuentas y facturación
- Auth, planes (free/pro), límites por plan, facturación. Se activa en la fase SaaS pero el modelo de datos ya reserva el `user_id` desde el MVP.

---

## 4. Motor de análisis financiero (el núcleo)

Para cada carta+variante+condición, a partir de su serie de precios, se calcula:

### 4.1 Métricas de precio y tendencia
- Precio actual (por fuente y "consolidado").
- Cambios %: 24h, 7d, 30d, 90d, 1a, all-time.
- Máximos/mínimos históricos y distancia al ATH/ATL.
- **Medias móviles** (SMA/EMA 7/30/90) y cruces (golden/death cross).
- **Volatilidad** (desviación estándar de retornos) → clasificación de riesgo del activo.

### 4.2 Indicadores técnicos (estilo trading)
- **RSI** (sobrecompra/sobreventa).
- **Momentum** y tasa de cambio.
- Bandas de volatilidad (tipo Bollinger) para detectar precios "caros"/"baratos" respecto a su rango.
- **Señal compuesta**: combinación de indicadores → semáforo Comprar / Mantener / Vender (con disclaimer: no es asesoramiento financiero).

### 4.3 Arbitraje y liquidez entre mercados
- Diferencial de precio entre TCGplayer (US), Cardmarket (EU) y eBay → oportunidades de arbitraje (teniendo en cuenta fees y envío estimados).
- **Liquidez**: nº de listados activos, dispersión de precios, velocidad estimada de venta. Una carta cara pero ilíquida es peor inversión que su precio sugiere.

### 4.4 Graded vs ungraded
- Comparativa de precio raw vs PSA 9/PSA 10 (vía PriceCharting) → **"grading premium"** y estimación de si merece la pena graduar una carta.

### 4.5 Forecast (fase avanzada)
- Predicción de tendencia a corto plazo (modelos de series temporales: media móvil ponderada / Prophet / modelos ligeros de ML). Siempre presentado como estimación con intervalo de confianza, nunca como certeza.

### 4.6 Señales de evento
- Correlación de picos de precio con eventos: nuevos sets, rotaciones de meta, torneos, reprints. (Fase avanzada — enriquecimiento con calendario de releases.)

---

## 5. Módulo de cartera (Portfolio)

Trata la colección del usuario como un portfolio financiero:

- **Registro de posiciones**: carta, cantidad, condición, precio y fecha de compra (coste base).
- **Valoración a mercado**: valor actual de la colección con el precio consolidado.
- **P&L y ROI**: ganancia/pérdida realizada y no realizada, % de retorno por posición y total.
- **Asignación**: distribución del valor por juego, set, rareza → detectar concentración de riesgo.
- **Rendimiento en el tiempo**: curva de valor de la cartera (como el gráfico de una cuenta de inversión).
- **Watchlist**: cartas seguidas pero no poseídas, con sus señales y alertas.
- **Sugerencias**: "tienes X cerca de su ATH", "esta posición ha caído un Y% bajo su SMA30", etc.

---

## 6. Modelo de datos (conceptual)

Diseño game-agnostic y multiusuario desde el inicio:

- **`games`** — one_piece, pokemon, … (metadata del juego).
- **`sets`** — sets/expansiones por juego.
- **`cards`** — carta canónica: game_id, set_id, número, nombre, rareza, imágenes.
- **`card_variants`** — variante concreta (normal/holo/alt-art), idioma, condición base. **Unidad mínima de precio.**
- **`source_mappings`** — mapea cada `card_variant` a su ID en cada fuente externa (tcgplayer_id, cardmarket_id, ebay_query, etc.).
- **`price_points`** — serie temporal: variant_id, source, condition, price, currency, timestamp. (Tabla de gran volumen → base de series temporales.)
- **`analytics_snapshots`** — métricas precomputadas por variante (SMA, RSI, volatilidad, señal) para servir el dashboard rápido.
- **`users`** — reservado desde el MVP (aunque solo seas tú al principio).
- **`portfolio_holdings`** — posiciones del usuario (coste base, cantidad, condición).
- **`watchlists`** / **`alerts`** — seguimiento y reglas de alerta.

**Elección de almacenamiento:**
- Catálogo y usuarios → **PostgreSQL** (relacional, integridad).
- Series temporales de precios → **TimescaleDB** (extensión de Postgres) o **Amazon Timestream**. Recomendado TimescaleDB: mantiene todo en el mundo Postgres y da funciones nativas de series temporales.

---

## 7. Arquitectura en AWS

Diseño serverless-first para minimizar coste y operación en la fase personal, escalable a SaaS.

### 7.1 Ingesta (batch / scheduled)
- **Amazon EventBridge (Scheduler)** dispara los jobs de ingesta por proveedor con la cadencia adecuada (ej. precios diarios; listados eBay más frecuentes).
- **AWS Lambda** (o **ECS Fargate** para jobs largos) ejecuta cada adaptador de proveedor, normaliza y escribe en la base de datos.
- **Amazon SQS** entre "descubrir qué actualizar" y "actualizar" para desacoplar y reintentar con back-off (respetando rate limits de las APIs).
- **Secrets Manager** para las API keys de los proveedores.

### 7.2 Almacenamiento
- **Amazon RDS PostgreSQL** (con TimescaleDB) para catálogo, series temporales, usuarios y cartera.
- **Amazon S3** para imágenes de cartas, backups y datos crudos históricos (data lake para reprocesar).
- **ElastiCache (Redis)** para caché de dashboards y respuestas calientes (fase de crecimiento).

### 7.3 Cómputo de analítica
- Lambda/Fargate programado que recalcula `analytics_snapshots` tras cada ingesta.
- Modelos de forecast (fase avanzada) en Fargate o **SageMaker** si crece la complejidad.

### 7.4 Backend / API
- **API**: FastAPI (Python) o NestJS (Node) sobre **Fargate** o **Lambda + API Gateway**.
- **Autenticación** (fase SaaS): **Amazon Cognito**.

### 7.5 Frontend
- **Next.js / React**, desplegado en **AWS Amplify** o **S3 + CloudFront**.
- Gráficos financieros (candlestick, líneas, indicadores) con TradingView Lightweight Charts o Recharts.

### 7.6 Observabilidad y CI/CD
- **CloudWatch** (logs, métricas, alarmas — sobre todo para detectar caídas de las APIs externas).
- **GitHub Actions** → despliegue con **AWS CDK** o **Terraform** (infra como código desde el día 1).
- Repos en GitHub con estructura monorepo o multi-repo (ver §9).

### 7.7 Diagrama de flujo (alto nivel)

```
EventBridge ──► SQS ──► Lambda/Fargate (Provider Adapters)
                              │
             ┌────────────────┼─────────────────┐
             ▼                ▼                 ▼
      Pokémon TCG API   OP APIs / TCG API   eBay Browse API
             └────────────────┼─────────────────┘
                              ▼
                    Normalización + QA
                              ▼
                  RDS Postgres + TimescaleDB ◄── S3 (raw / imágenes)
                              ▼
                 Analytics Engine (SMA/RSI/vol/señales)
                              ▼
                    analytics_snapshots
                              ▼
                 API (FastAPI/Nest) ──► CloudFront ──► Next.js
                              ▲
                          Cognito (SaaS)
```

---

## 8. Stack tecnológico recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Lenguaje backend | **Python** | Ecosistema de datos/finanzas (pandas, numpy, ta-lib, Prophet) ideal para el motor de análisis. |
| Framework API | FastAPI | Rápido, tipado, async, buena DX. |
| Base de datos | PostgreSQL + TimescaleDB | Relacional + series temporales en un solo motor. |
| Frontend | Next.js + React | SSR, buen ecosistema de gráficos financieros. |
| Infra como código | AWS CDK o Terraform | Reproducible, versionado en GitHub. |
| Contenedores/serverless | Lambda + Fargate | Coste bajo en fase personal, escala en SaaS. |
| Orquestación de jobs | EventBridge + SQS | Programación y desacople con reintentos. |

---

## 9. Estructura del repositorio (GitHub)

Propuesta monorepo para empezar (más simple de mantener siendo una persona):

```
tcg-price-intelligence/
├── docs/                  # este documento y diseño
├── infra/                 # AWS CDK / Terraform
├── services/
│   ├── ingestion/         # adaptadores de proveedores + jobs
│   ├── analytics/         # motor de indicadores y señales
│   └── api/               # FastAPI (backend público)
├── packages/
│   └── core/              # modelos de dominio, interfaces de provider
├── web/                   # frontend Next.js
└── .github/workflows/     # CI/CD
```

**Interfaz clave — `PriceProvider`** (contrato que todo adaptador implementa):
`getCard(id)`, `getPrices(variantId, range)`, `search(query)`, `getListings(variantId)`. Esto es lo que hace la plataforma resistente a cambios de fuente.

---

## 10. Roadmap por fases

### Fase 0 — Fundaciones (semanas 1–2)
- Repo, infra base (CDK), RDS Postgres + TimescaleDB, esquema de datos.
- Definir identificador canónico de carta y estrategia de mapeo entre fuentes.

### Fase 1 — MVP personal: catálogo + precios (semanas 3–6)
- Integrar **Pokémon TCG API** y una **API de One Piece** (o **TCG API** unificada).
- Ingesta diaria de precios TCGplayer/Cardmarket → series temporales.
- Dashboard por carta: precio actual, histórico, cambios %, gráfico.
- **Entregable usable para ti**: buscar una carta y ver su ficha financiera básica.

### Fase 2 — Motor de análisis (semanas 7–10)
- SMA/EMA, RSI, volatilidad, momentum, señal compuesta (semáforo).
- Snapshots precomputados + gráficos con indicadores.

### Fase 3 — Cartera personal (semanas 11–13)
- Registro de posiciones, valoración, P&L, ROI, asignación, curva de valor.
- Watchlist + alertas por email.

### Fase 4 — Enriquecimiento multi-mercado (semanas 14–18)
- **eBay Browse API** (listados activos + liquidez).
- Arbitraje US/EU/eBay con fees.
- **PriceCharting**: graded vs ungraded y grading premium.
- Solicitar en paralelo **eBay Marketplace Insights** (ventas cerradas).

### Fase 5 — Forecast y eventos (semanas 19+)
- Predicción de tendencia con intervalos.
- Correlación con releases/meta/torneos.

### Fase 6 — Conversión a SaaS
- Cognito (auth), planes y límites, facturación (Stripe), rate limiting por plan.
- Multi-tenancy (el `user_id` ya existe en el modelo → cambio incremental).
- Landing, onboarding, panel de suscripción.

---

## 11. Consideraciones legales y de riesgo

- **Términos de uso de cada API**: revisar si permiten uso comercial y redistribución de precios. Algunos planes free son *solo no comercial* — al pasar a SaaS habrá que subir a planes con licencia comercial (ej. TCG API Business).
- **eBay/TCGplayer**: no scrapear en contra de sus ToS; usar APIs oficiales/licenciadas. El dato de ventas cerradas requiere el canal aprobado.
- **Disclaimers**: las señales son informativas, **no asesoramiento financiero de inversión**. Dejarlo explícito en la UI.
- **Atribución de datos**: mostrar la fuente de cada precio ("datos de TCGplayer/Cardmarket vía …") según exijan los términos.
- **Dependencia de terceros**: la capa de abstracción de proveedores mitiga el riesgo de que una API cierre o cambie precios (como ya pasó con TCGplayer).

---

## 12. KPIs de la plataforma

- Cobertura de catálogo (% de cartas OP + Pokémon con precio fresco).
- Frescura del dato (antigüedad media del último precio).
- Precisión de la señal (backtesting: ¿las señales habrían sido rentables?).
- (SaaS) usuarios activos, conversión free→pro, retención.

---

## 13. Decisiones abiertas / próximos pasos

1. **Elegir fuente(s) de arranque**: ¿TCG API unificada (una integración para OP + Pokémon) o integrar Pokémon TCG API + una API específica de One Piece por separado? → recomendado empezar por **TCG API unificada** para acelerar el MVP y añadir Pokémon TCG API como segunda fuente/validación cruzada.
2. **Confirmar plan/licencia** de cada API según uso (personal ahora, comercial en SaaS).
3. **Definir el identificador canónico** de carta+variante (lo más importante del modelo de datos).
4. **Solicitar acceso a eBay Marketplace Insights** cuanto antes (proceso largo).
5. Montar Fase 0 (repo + infra + esquema).

---

*Documento vivo. Siguiente iteración sugerida: detallar el esquema SQL completo y las interfaces de los adaptadores de proveedores.*
