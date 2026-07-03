#!/bin/sh
# Arranca la API (FastAPI/uvicorn).
set -e
cd /app/services/api
export PYTHONPATH="/app/services/api:${PYTHONPATH:-}"
exec uvicorn main:app --host 0.0.0.0 --port 8000
