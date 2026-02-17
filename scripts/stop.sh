#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo "==> Arresto TorinoParking..."

docker compose -f "$COMPOSE_FILE" down

echo "==> Tutti i servizi arrestati."
echo ""
echo "    I volumi dati (postgres, redis) sono preservati."
echo "    Per rimuovere anche i volumi: docker compose -f $COMPOSE_FILE down -v"
