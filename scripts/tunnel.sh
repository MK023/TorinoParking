#!/usr/bin/env bash
# Espone TorinoParking (Caddy :80) via ngrok sul dominio riservato in .env,
# per testare l'app da iPhone. Caddy inoltra il traffico a frontend/backend.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ponytail: leggo solo la riga che serve invece di sourcare .env (CORS_ORIGINS ha JSON che romperebbe il source)
DOMAIN=$(grep -E '^NGROK_DOMAIN=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\'' ')

if [ -z "${DOMAIN:-}" ]; then
  echo "ERRORE: NGROK_DOMAIN mancante in .env" >&2
  exit 1
fi

if ! curl -skf https://localhost/health > /dev/null 2>&1; then
  echo "ATTENZIONE: l'app non risponde su https://localhost — avviala prima con 'make up'" >&2
fi

echo "==> Tunnel pubblico:  https://$DOMAIN  ->  Caddy :80"
echo "    Aprilo dal browser dell'iPhone. Ctrl-C per fermare."
exec ngrok http --url="$DOMAIN" 80
