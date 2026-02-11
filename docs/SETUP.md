# 🚀 Setup & Installation Guide

Guida completa per setup ambiente di sviluppo.

## Prerequisites

### Required
- **Docker** 24.0+ ([Install](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.20+ (bundled with Docker Desktop)
- **Git** 2.40+
- **Python** 3.12+ (per development locale)

### Recommended
- **Dockhand** ([https://dockhand.pro](https://dockhand.pro)) - Docker UI manager
- **VS Code** con extensions (vedi TOOLS.md)
- **Claude Code** - AI coding assistant

## Quick Start (5 minuti)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/torino-parking.git
cd torino-parking

# 2. Copy environment template
cp .env.example .env

# 3. Generate strong secrets
# macOS/Linux:
export API_KEY=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Add to .env
echo "API_KEY=$API_KEY" >> .env
echo "JWT_SECRET=$JWT_SECRET" >> .env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env

# 4. Start tutto con Docker Compose
docker-compose up -d

# 5. Verifica
curl http://localhost:8000/health

# 6. Docs interattive
open http://localhost:8000/docs
```

**Output atteso:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-02-11T14:30:00Z"
}
```

## Development Setup Completo

### 1. Environment Variables

```bash
# .env
# === App Settings ===
APP_NAME="Parking Torino API"
VERSION="1.0.0"
ENVIRONMENT="development"  # development | staging | production
DEBUG=true

# === Security ===
API_KEY=your-secret-api-key-min-32-chars
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-fernet-encryption-key

# === Database ===
DATABASE_URL=postgresql+asyncpg://parking:parking123@postgres:5432/parking
POSTGRES_USER=parking
POSTGRES_PASSWORD=parking123
POSTGRES_DB=parking

# === Redis ===
REDIS_URL=redis://redis:6379/0

# === External APIs ===
FIVE_T_API_URL=https://opendata.5t.torino.it/get_pk
FIVE_T_TIMEOUT=10

# === Rate Limiting ===
RATE_LIMIT_ANONYMOUS=20     # requests per minute
RATE_LIMIT_AUTHENTICATED=100
RATE_LIMIT_PREMIUM=1000

# === Monitoring ===
SENTRY_DSN=  # Optional: Add your Sentry DSN

# === CORS ===
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# === Celery ===
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

### 2. Docker Compose Stack

Il file `docker-compose.yml` definisce tutti i servizi:

```bash
# Start tutti i servizi
docker-compose up -d

# Logs
docker-compose logs -f backend

# Stop
docker-compose down

# Rebuild dopo modifiche al Dockerfile
docker-compose up -d --build
```

**Servizi disponibili:**
- `backend` - FastAPI API (porta 8000)
- `postgres` - Database (porta 5432)
- `redis` - Cache/Queue (porta 6379)
- `celery_worker` - Background tasks
- `celery_beat` - Scheduler
- `flower` - Celery monitoring UI (porta 5555)

### 3. Dockhand Setup (Opzionale ma raccomandato)

```bash
# Start Dockhand
docker run -d \
  --name dockhand \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dockhand_data:/app/data \
  fnsys/dockhand:latest

# Open UI
open http://localhost:3000
```

**Dockhand features:**
- Visual Docker management
- Container logs in real-time
- Resource monitoring
- Stack editor
- Vulnerability scanning

### 4. Database Migrations

```bash
# Crea database e tabelle
docker-compose exec backend alembic upgrade head

# Crea nuova migration
docker-compose exec backend alembic revision --autogenerate -m "Add new table"

# Rollback
docker-compose exec backend alembic downgrade -1
```

### 5. Python Virtual Environment (Dev locale)

```bash
# Create venv
python3.12 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run locally (senza Docker)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Development Tools

### VS Code Extensions

Installa da `.vscode/extensions.json`:
```bash
code --install-extension ms-python.python
code --install-extension charliermarsh.ruff
code --install-extension ms-azuretools.vscode-docker
```

Vedi [TOOLS.md](TOOLS.md) per lista completa.

### Code Quality Tools

```bash
# Linting
ruff check app/

# Formatting
ruff format app/

# Type checking
mypy app/

# Tests
pytest tests/ -v --cov=app

# All checks
./scripts/check.sh
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Setup hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Testing

### Run Tests

```bash
# All tests
pytest

# Specific file
pytest tests/test_parkings.py

# With coverage
pytest --cov=app --cov-report=html

# Open coverage report
open htmlcov/index.html
```

### Test Database

Tests usano database separato:
```bash
# .env.test
DATABASE_URL=postgresql+asyncpg://postgres:test@localhost:5432/parking_test
```

## Troubleshooting

### Container non parte

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Port already in use
sudo lsof -i :8000  # Find process on port 8000
kill -9 <PID>

# 2. Database connection failed
docker-compose ps  # Check postgres is running
docker-compose exec postgres pg_isready

# 3. Permission denied
sudo chmod 666 /var/run/docker.sock
```

### Database connection errors

```bash
# Reset database
docker-compose down -v  # WARNING: Deletes all data!
docker-compose up -d postgres
docker-compose exec backend alembic upgrade head
```

### Redis connection errors

```bash
# Test Redis
docker-compose exec redis redis-cli ping
# Should return: PONG

# Flush cache
docker-compose exec redis redis-cli FLUSHALL
```

### Import errors

```bash
# Rebuild Python dependencies
docker-compose build --no-cache backend
```

## Production Deployment

Vedi [DEPLOYMENT.md](DEPLOYMENT.md) per:
- Deploy su Fly.io
- CI/CD GitHub Actions
- Secrets management
- Monitoring setup
- Backup strategy

## Next Steps

Dopo setup:
1. ✅ Leggi [ARCHITECTURE.md](ARCHITECTURE.md) - Capire struttura
2. ✅ Leggi [BEST_PRACTICES.md](BEST_PRACTICES.md) - Code standards
3. ✅ Crea primo endpoint - Vedi esempi in `app/api/`
4. ✅ Scrivi tests - Usa fixtures in `tests/conftest.py`
5. ✅ Deploy staging - GitHub Actions automatic

## Useful Commands

```bash
# === Docker ===
docker-compose up -d              # Start all
docker-compose down               # Stop all
docker-compose logs -f backend    # Follow logs
docker-compose exec backend bash  # Shell into container
docker-compose restart backend    # Restart service

# === Database ===
docker-compose exec postgres psql -U parking -d parking
\dt                    # List tables
\d parking_availability_history  # Describe table
SELECT COUNT(*) FROM parkings;   # Query

# === Redis ===
docker-compose exec redis redis-cli
KEYS *                # List all keys
GET parkings:all      # Get value
FLUSHALL              # Clear everything

# === Celery ===
docker-compose logs -f celery_worker  # Worker logs
docker-compose logs -f celery_beat    # Scheduler logs
open http://localhost:5555            # Flower UI

# === API Testing ===
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/parkings
http GET http://localhost:8000/api/v1/parkings  # httpie (better curl)

# === Code Quality ===
./scripts/lint.sh     # Run all linters
./scripts/test.sh     # Run tests
./scripts/format.sh   # Format code
```

## Support

**Issues:** [GitHub Issues](https://github.com/yourusername/torino-parking/issues)
**Docs:** `/docs` directory
**Contact:** your-email@example.com
