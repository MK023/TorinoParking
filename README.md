# Torino Parking - Real-Time Parking Availability API

Backend API che aggrega dati real-time dall'API Open Data 5T del Comune di Torino per fornire disponibilita parcheggi tramite API REST.

## Stack Tecnologico

- **FastAPI** (Python 3.12) - API async
- **PostgreSQL 16 + PostGIS** - storage + query geo-spaziali
- **Redis 7** - cache con compressione e ETag
- **APScheduler** - job periodici in-process (fetch dati, cleanup, purge)
- **Docker + Docker Compose** - orchestrazione locale
- **GitHub Actions** - CI (lint, test, Docker build)
- **Sentry** - error tracking (opzionale)
- **structlog** - logging strutturato JSON

## Funzionalita Implementate

### API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/v1/parkings` | Lista parcheggi con disponibilita real-time. Filtri: `?available=true`, `?min_spots=N` |
| `GET` | `/api/v1/parkings/nearby` | Ricerca geo-spaziale PostGIS. Params: `lat`, `lng`, `radius` (metri), `limit` |
| `GET` | `/api/v1/parkings/{id}` | Singolo parcheggio per ID |
| `GET` | `/api/v1/parkings/{id}/history` | Storico disponibilita. Param: `?hours=24` (max 720) |
| `GET` | `/health` | Health check (Redis + PostgreSQL) |
| `POST` | `/api/v1/admin/keys` | Crea API key (richiede `X-Admin-Key`) |
| `GET` | `/api/v1/admin/keys` | Lista API keys |
| `DELETE` | `/api/v1/admin/keys/{id}` | Revoca API key |

### Core Features

- **Cache Redis** con TTL 120s, compressione orjson + zlib, ETag per conditional requests (304)
- **Dati arricchiti**: merge automatico dati real-time 5T + dettagli statici GTT (22 parcheggi con indirizzo, tariffe, metodi pagamento, linee bus, metro)
- **API key management**: HMAC-SHA256, tiers anonymous/authenticated/premium, cache in-memory 60s
- **Rate limiting**: sliding window multi-tier (20/100/1000 req/min) con Redis sorted sets
- **Background jobs**: fetch 5T ogni 2 min, cleanup cache ogni ora, purge snapshot ogni notte
- **Snapshot storici**: tabella time-series con retention 30 giorni

### Architettura

Clean Architecture con separazione domain/infrastructure/API:
- Domain layer: entita frozen dataclass, Protocol per contracts
- Infrastructure: repository PostgreSQL, client HTTP 5T, cache Redis
- API: FastAPI routes, middleware stack (security headers, rate limiting, access log, request ID)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/marcobellingeri/TorinoParking.git
cd TorinoParking

# 2. Configura environment
cp .env.example .env

# 3. Avvia con Docker Compose
docker-compose up -d

# 4. Verifica
curl http://localhost:8000/health
```

L'API sara disponibile su `http://localhost:8000`

Swagger UI: `http://localhost:8000/docs` (solo in development)

## Test

```bash
# Unit tests (no Docker richiesto)
python -m pytest tests/unit/ -v

# Integration + E2E (richiede Docker per testcontainers)
python -m pytest tests/ -v
```

## Documentazione

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Architettura del sistema
- **[docs/SECURITY.md](docs/SECURITY.md)** - Threat model e security practices
- **[docs/GDPR.md](docs/GDPR.md)** - Compliance GDPR e privacy
- **[docs/SETUP.md](docs/SETUP.md)** - Setup locale e troubleshooting
- **[ROADMAP.md](ROADMAP.md)** - Miglioramenti futuri

## Security

- API key con hash HMAC-SHA256 (salt configurabile via env var)
- Rate limiting per IP (anonymous) e per API key (authenticated)
- Security headers: X-Content-Type-Options, X-Frame-Options, Cache-Control
- CORS configurabile per environment
- Secrets in environment variables
- Input validation con Pydantic

## CI/CD

GitHub Actions pipeline: **ruff lint** -> **pytest con coverage** -> **Docker build**

## Roadmap

Vedi [ROADMAP.md](ROADMAP.md) per i miglioramenti pianificati: HTTPS/TLS, circuit breaker, Prometheus metrics, user authentication JWT, push notifications.

## License

MIT

## Contatti

Marco Bellingeri - [@MK023](https://github.com/MK023)
