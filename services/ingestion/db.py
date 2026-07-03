"""Conexión a Postgres (psycopg 3).

DSN desde la variable de entorno DATABASE_URL. En AWS se inyecta desde el
secreto gestionado por RDS; en local, desde `.env`.
"""

from __future__ import annotations

import os

import psycopg


def get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL no está definida")
    return dsn


def connect(dsn: str | None = None) -> psycopg.Connection:
    """Abre una conexión. El llamador es responsable de cerrarla (o usar `with`)."""
    return psycopg.connect(dsn or get_dsn())
