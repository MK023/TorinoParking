#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# --- Colori ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { printf "${GREEN}OK${NC}\n"; }
warn() { printf "${YELLOW}$1${NC}\n"; }
fail() { printf "${RED}$1${NC}\n"; }

echo "==> Avvio TorinoParking..."

# --- Secrets: Doppler o .env ---
USE_DOPPLER=false
if command -v doppler &> /dev/null \
  && doppler secrets --project torino-parking --config dev > /dev/null 2>&1; then
  USE_DOPPLER=true
  echo "    Secrets: Doppler"
elif [ ! -f "$PROJECT_DIR/.env" ]; then
  fail "ERRORE: Doppler non configurato e .env non trovato"
  echo "  1. brew install dopplerhq/cli/doppler && doppler login && doppler setup"
  echo "  2. cp .env.example .env  (e configura i valori)"
  exit 1
else
  echo "    Secrets: .env"
fi

# --- Genera frontend/.env da Doppler (Vite lo richiede) ---
if [ "$USE_DOPPLER" = true ]; then
  MAPBOX_TOKEN=$(doppler secrets get VITE_MAPBOX_TOKEN --plain --project torino-parking --config dev 2>/dev/null) || true
  if [ -n "$MAPBOX_TOKEN" ]; then
    echo "VITE_MAPBOX_TOKEN=$MAPBOX_TOKEN" > "$PROJECT_DIR/frontend/.env"
    echo "    Frontend .env generato da Doppler"
  else
    warn "    ATTENZIONE: VITE_MAPBOX_TOKEN non trovato in Doppler"
  fi
fi

# --- Build e start ---
if [ "$USE_DOPPLER" = true ]; then
  doppler run --project torino-parking --config dev -- docker compose -f "$COMPOSE_FILE" up -d --build
else
  docker compose -f "$COMPOSE_FILE" up -d --build
fi

# --- Health checks ---
echo ""
echo "==> In attesa dei servizi..."

wait_for_container() {
  local name=$1 retries=$2
  printf "    %-20s " "$name"
  for i in $(seq 1 "$retries"); do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then ok; return 0; fi
    sleep 2
  done
  fail "TIMEOUT"; echo "    docker logs $name"; return 1
}

wait_for_http() {
  local name=$1 url=$2 retries=$3
  printf "    %-20s " "$name"
  for i in $(seq 1 "$retries"); do
    if curl -sf "$url" > /dev/null 2>&1; then ok; return 0; fi
    sleep 3
  done
  warn "TIMEOUT (potrebbe essere ancora in avvio)"
  echo "    docker logs $name"
  return 0
}

wait_for_container parking_postgres 30 || exit 1
wait_for_container parking_redis 15 || exit 1
wait_for_http parking_backend http://localhost:8000/health 40
wait_for_http parking_frontend http://localhost:3000 20

# --- Summary ---
echo ""
echo "==> TorinoParking avviato!"
echo "    Frontend:  http://localhost:3000"
echo "    Backend:   http://localhost:8000"
echo "    API docs:  http://localhost:8000/docs"
[ "$USE_DOPPLER" = true ] && echo "    Secrets:   Doppler"
