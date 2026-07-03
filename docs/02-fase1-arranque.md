# Fase 1 — Guía de Arranque

> Cómo empezar, qué cartas rastreamos, y cómo se recopilan las cartas nuevas.
> Complementa `00-diseno-plataforma.md` y `01-analisis-apis.md`.

---

## 1. Qué cartas analizamos al empezar

**Enfoque actual (acotado):**

- **Pokémon:** solo `Special Illustration Rare`.
- **One Piece:** solo `SEC Alternate Art`, `SR Alternate Art` y `Manga`.

La selección se define como **motor de reglas** en
[`services/ingestion/scope.yaml`](../services/ingestion/scope.yaml) y se evalúa
en [`scope.py`](../services/ingestion/scope.py). Una carta entra si cumple
CUALQUIER regla de su juego; dentro de una regla, `rarity_any` y `name_any` van
con AND (las alt-art se distinguen por el nombre). Configurable sin tocar código.

> **Calibración:** los términos exactos de rareza/nombre que devuelve tcgapi.dev
> se confirman con `python demo.py --list-rarities`, que lista las rarezas reales
> y marca cuáles entran en alcance. Ajusta el YAML con lo que veas.

**Prioridad de cobertura** (por el cupo del free tier): (1) tu cartera, (2) tu
watchlist, (3) top cartas por valor/rareza de cada set. Se expande al subir de tier.

---

## 2. Cómo se recopilan las cartas nuevas

El recolector [`catalog_sync.py`](../services/ingestion/catalog_sync.py) se
ejecuta periódicamente (semanal + cuando sale un set) y:

1. Lista los sets del juego en la fuente (Scrydex).
2. Detecta **sets nuevos** comparando con los ya presentes en BD.
3. Recorre las cartas de cada set nuevo / marcado.
4. Filtra por la **política de alcance** (rareza/promo/precio).
5. Da de alta en `cards` + `card_variants` + `source_mappings` solo las que aplican.

Lo dispara la regla `weekly_catalog_sync` de EventBridge (lunes 05:00 UTC), ya
creada en Terraform. Así, cuando sale un set nuevo de One Piece o Pokémon, sus
cartas de inversión entran solas en el sistema.

---

## 3. El bucle de datos de la Fase 1

```
  EventBridge (semanal)                 EventBridge (diario 06:00 UTC)
        │                                        │
        ▼                                        ▼
   catalog_sync ──► alta de cartas         price ingestion ──► price_points
   (scope.yaml)     en alcance             (snapshot diario)   (serie temporal propia)
        │                                        │
        └───────────────► cards / variants ◄─────┘
                                 │
                                 ▼
                        API /v1/cards/{id}  → ficha + histórico
```

Lo más importante de la fase: **empezar el snapshot diario cuanto antes** para
construir histórico propio (ver `01-analisis-apis.md` §1).

---

## 4. Pasos concretos para arrancar

### 4.1 Cuentas y llaves (tú)
1. Crear cuenta y API key en **Scrydex** (fuente primaria) y en **tcgapi.dev**
   (validación cruzada, gratis).
2. Guardarlas: en local en `.env`; en AWS en el secreto `tcg-dev/provider-api-keys`.

### 4.2 Infraestructura (Terraform)
1. `cd terraform/bootstrap && terraform init && terraform apply` (state remoto).
2. Rellenar `backend.hcl` y `terraform.tfvars` (ver `terraform/README.md`).
3. `terraform init -backend-config=backend.hcl && terraform apply`.
4. Copiar el output `github_actions_role_arn` → secreto `AWS_ROLE_ARN` del repo.

### 4.3 Base de datos
1. Conectar a la RDS y `CREATE EXTENSION IF NOT EXISTS timescaledb;`.
2. Aplicar `db/schema.sql` y `db/seed_games.sql`.

### 4.4 Código (implementación)
1. ✅ `TcgApiProvider(PriceProvider)` en `services/ingestion/tcgapi_provider.py`
   — implementado y testeado: `search`, `list_sets`, `list_cards`,
   `get_variants`, `get_prices` (+ `get_history` para cuando haya plan Pro).
2. `CatalogRepository` real (psycopg) que implemente los métodos del puerto
   (`known_set_codes`, `variant_exists`, `upsert_card_with_mapping`).
3. Cablear `catalog_sync.run()` con el provider + repo reales.
4. Handler del job diario de precios → `get_prices` por variante → `price_points`.
5. Endpoint `GET /v1/cards/{id}` → ficha + serie temporal.

### 4.5 Prueba end-to-end
1. Correr `catalog_sync` sobre un set de cada juego (p.ej. OP-01 + un set SV).
2. Verificar que solo entran las cartas en alcance.
3. Correr la ingesta diaria 2-3 días y ver la serie crecer en `price_points`.

Con eso tienes el bucle completo sobre un subconjunto real, listo para montar el
motor de análisis (Fase 2) encima.

---

## 5. Definición de "hecho" de la Fase 1

- [ ] Terraform aplicado (VPC, RDS, S3, SQS, EventBridge, rol OIDC).
- [ ] Esquema y seeds cargados; TimescaleDB activa.
- [ ] `ScrydexProvider` implementado y probado.
- [ ] `catalog_sync` da de alta cartas en alcance de OP y Pokémon.
- [ ] Ingesta diaria escribiendo en `price_points`.
- [ ] Endpoint de ficha de carta con histórico.
