#!/bin/sh
# Job: ingesta diaria de precios.
set -e
cd /app/services/ingestion
export PYTHONPATH="/app/services/ingestion:${PYTHONPATH:-}"
exec python price_ingest.py
