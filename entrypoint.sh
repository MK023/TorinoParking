#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER:-parking}" -q 2>/dev/null; do
    sleep 1
done
echo "PostgreSQL ready."

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
