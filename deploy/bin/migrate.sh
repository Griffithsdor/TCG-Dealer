#!/bin/sh
# Job de migración: aplica el esquema + seeds a la BD privada (corre dentro de
# la VPC, por eso puede alcanzar Aurora). Ejecutar una vez tras el primer deploy:
#   aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"job",
#     "command":["/app/bin/migrate.sh"]}]}'
set -e
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/db/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/db/seed_games.sql
echo "esquema aplicado."
