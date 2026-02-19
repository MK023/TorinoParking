#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRIES=0
until pg_isready -h postgres -U "${POSTGRES_USER:-parking}" -q 2>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: PostgreSQL not ready after ${MAX_RETRIES}s"
        exit 1
    fi
    sleep 1
done

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
