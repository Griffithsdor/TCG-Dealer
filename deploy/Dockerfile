# Imagen única (API + jobs). Se construye en GitHub Actions.
# Contexto de build = raíz del repo:  docker build -f deploy/Dockerfile .
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Cliente psql para el job de migración (aplica el esquema dentro de la VPC).
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 1) Paquete de dominio compartido
COPY packages/core /app/packages/core
RUN pip install --no-cache-dir /app/packages/core

# 2) Dependencias de runtime
COPY deploy/requirements-fargate.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 3) Código, esquema y scripts de arranque
COPY services /app/services
COPY db /app/db
COPY deploy/bin /app/bin
RUN chmod +x /app/bin/*.sh

EXPOSE 8000
CMD ["/app/bin/api.sh"]
