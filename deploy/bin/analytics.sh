#!/bin/sh
# Job: recálculo de métricas (analytics_snapshots).
set -e
cd /app/services/analytics
export PYTHONPATH="/app/services/analytics:${PYTHONPATH:-}"
exec python run.py
