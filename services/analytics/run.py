"""Runner del motor de análisis (handler Lambda / `make analyze`).

Recalcula analytics_snapshots para todas las variantes con precio.
Requiere DATABASE_URL.
"""

from __future__ import annotations

import logging
import os
import sys

import psycopg

from repository import AnalyticsRepository, run_all


def run() -> int:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: falta DATABASE_URL")
        sys.exit(1)
    with psycopg.connect(dsn) as conn:
        n = run_all(AnalyticsRepository(conn))
    print(f"OK: {n} snapshots recalculados")
    return n


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    run()
