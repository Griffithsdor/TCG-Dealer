#!/bin/sh
# Job: sincronización de catálogo (cartas nuevas en alcance).
set -e
cd /app/services/ingestion
export PYTHONPATH="/app/services/ingestion:${PYTHONPATH:-}"
exec python catalog_sync.py
