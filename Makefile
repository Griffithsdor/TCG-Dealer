.PHONY: db-up db-down db-create db-init setup list-rarities demo core-install api-dev test fmt lint

# --- Base de datos ---------------------------------------------------------
# Opción A (SIN Docker, recomendada): Postgres normal (Homebrew).
#   brew install postgresql@16 && brew services start postgresql@16
#   export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
#   make db-create db-init
#
# Opción B (Docker + TimescaleDB): make db-up db-init

# Crea el rol y la base de datos en un Postgres local (Homebrew).
db-create:
	psql postgres -c "CREATE ROLE tcg LOGIN PASSWORD 'tcg';" || true
	psql postgres -c "CREATE DATABASE tcg OWNER tcg;" || true

# Aplica esquema + seeds (portable: cualquier Postgres vía DATABASE_URL).
db-init:
	psql "$${DATABASE_URL:-postgresql://tcg:tcg@localhost:5432/tcg}" -f db/schema.sql
	psql "$${DATABASE_URL:-postgresql://tcg:tcg@localhost:5432/tcg}" -f db/seed_games.sql

# Opción B: Postgres + TimescaleDB en Docker.
db-up:
	docker run -d --name tcg-db \
		-e POSTGRES_USER=tcg -e POSTGRES_PASSWORD=tcg -e POSTGRES_DB=tcg \
		-p 5432:5432 timescale/timescaledb:latest-pg16

db-down:
	docker rm -f tcg-db

# --- Instalación de dependencias ---
setup:
	pip install -e packages/core
	pip install -r services/ingestion/requirements.txt

core-install:
	pip install -e packages/core

# --- Diagnóstico: lista las rarezas reales de la API (solo TCGAPI_KEY, no BD) ---
list-rarities:
	cd services/ingestion && python demo.py --list-rarities --max-sets 4

# --- Demo end-to-end (requiere DATABASE_URL y TCGAPI_KEY) ---
# Limitado a 1 set por juego y 25 precios para no agotar el cupo gratis.
demo:
	cd services/ingestion && python demo.py --max-sets 1 --limit 25

# --- Motor de análisis: recalcula analytics_snapshots (requiere DATABASE_URL) ---
analyze:
	cd services/analytics && python run.py

# --- API ---
api-dev:
	uvicorn services.api.main:app --reload --port 8000

# --- Calidad ---
test:
	PYTHONPATH=services/ingestion pytest services/ingestion/tests -q
	PYTHONPATH=services/analytics pytest services/analytics/tests -q

fmt:
	ruff format packages services

lint:
	ruff check packages services
