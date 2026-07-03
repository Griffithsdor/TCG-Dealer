# TCG Price Intelligence

Plataforma de análisis financiero y seguimiento de precios de cartas de TCG.
Arranque con **One Piece Card Game** y **Pokémon TCG**, con arquitectura game-agnostic.

> Estado: **Fase 0** — fundaciones (repo, esquema de datos, infraestructura base).
> Diseño completo en [`docs/00-diseno-plataforma.md`](docs/00-diseno-plataforma.md).

## Estructura del monorepo

```
tcg-price-intelligence/
├── docs/                  # Diseño y documentación
├── db/                    # Esquema SQL (Postgres) y seeds
├── terraform/             # Infraestructura como código (Terraform + OIDC)
├── deploy/                # Dockerfile + handlers Lambda (despliegue en contenedor)
├── packages/
│   └── core/              # Dominio + interfaz PriceProvider (paquete Python)
├── services/
│   ├── ingestion/         # Adaptadores, política de alcance y catalog sync
│   ├── analytics/         # Motor de indicadores y señales
│   └── api/               # Backend público (FastAPI)
├── web/                   # Frontend (Next.js) — se añade en Fase 1
└── .github/workflows/     # CI/CD
```

## Principios de arquitectura

1. **Capa de abstracción de proveedores** (`PriceProvider`): toda fuente de precios
   implementa el mismo contrato. Si una API cierra o cambia (como pasó con TCGplayer),
   se reemplaza el adaptador, no la plataforma.
2. **Modelo de datos game-agnostic**: añadir un juego nuevo es configuración, no reingeniería.
3. **Multiusuario desde el día 1**: el `user_id` existe en el modelo aunque el MVP sea personal.
4. **Serverless-first en AWS**: coste bajo en fase personal, escalable a SaaS.

## Puesta en marcha local (dev)

Requisitos: Docker, Python 3.11+, Node 20+ (para infra CDK), AWS CLI.

```bash
# 1. Levantar Postgres + TimescaleDB local
make db-up

# 2. Aplicar el esquema
make db-init

# 3. Instalar el paquete core en modo editable
pip install -e packages/core

# 4. Arrancar la API (stub)
make api-dev
```

Ver [`db/README.md`](db/README.md) y [`terraform/README.md`](terraform/README.md) para detalles.
Guía de arranque de Fase 1: [`docs/02-fase1-arranque.md`](docs/02-fase1-arranque.md).

## Roadmap

| Fase | Objetivo |
|---|---|
| **0** | Repo, esquema de datos, infra base ← *estás aquí* |
| 1 | MVP personal: catálogo + ingesta de precios + ficha de carta |
| 2 | Motor de análisis (SMA/RSI/volatilidad/señales) |
| 3 | Cartera personal (P&L, ROI, alertas) |
| 4 | Multi-mercado (eBay, arbitraje, graded vs ungraded) |
| 5 | Forecast y eventos |
| 6 | Conversión a SaaS (auth, planes, facturación) |

## Aviso legal

Las señales que produce la plataforma son informativas y **no constituyen asesoramiento
financiero**. Respetar los términos de uso de cada API de datos.
