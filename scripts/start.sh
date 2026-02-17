#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo "==> Avvio TorinoParking..."

# Check .env exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERRORE: file .env non trovato in $PROJECT_DIR"
  echo "Copia .env.example in .env e configura le variabili."
  exit 1
fi

# Build and start (--build rebuilds only if Dockerfile or context changed)
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "==> In attesa che i servizi siano pronti..."

# Wait for health checks (postgres and redis have healthchecks)
for service in parking_postgres parking_redis; do
  printf "    %-20s " "$service"
  for i in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      echo "OK"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "TIMEOUT (stato: $status)"
      echo "ERRORE: $service non pronto dopo 30 tentativi."
      echo "Controlla i log: docker logs $service"
      exit 1
    fi
    sleep 2
  done
done

# Quick check that backend responds
printf "    %-20s " "parking_backend"
for i in $(seq 1 20); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "OK"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "TIMEOUT"
    echo "ATTENZIONE: backend non risponde su /health dopo 40s."
    echo "Controlla i log: docker logs parking_backend"
  fi
  sleep 2
done

# Quick check that frontend responds
printf "    %-20s " "parking_frontend"
for i in $(seq 1 15); do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "OK"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "TIMEOUT"
    echo "ATTENZIONE: frontend non risponde su :3000 dopo 30s."
    echo "Controlla i log: docker logs parking_frontend"
  fi
  sleep 2
done

echo ""
echo "==> TorinoParking avviato!"
echo "    Frontend:  http://localhost:3000"
echo "    Backend:   http://localhost:8000"
echo "    API docs:  http://localhost:8000/docs"
echo "    Dockhand:  http://localhost:9000"
