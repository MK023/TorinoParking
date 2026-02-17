# Torino Parking - Real-Time Parking Availability

Applicazione full-stack che aggrega dati real-time dall'API Open Data 5T del Comune di Torino per fornire disponibilita parcheggi tramite mappa interattiva e API REST.

## Stack Tecnologico

### Backend
- **FastAPI** (Python 3.12) - API async
- **PostgreSQL 16 + PostGIS** - storage + query geo-spaziali
- **Redis 7** - cache con compressione e ETag
- **APScheduler** - job periodici in-process (fetch dati, cleanup, purge)
- **structlog** - logging strutturato JSON
- **Sentry** - error tracking (opzionale)

### Frontend
- **React 19** + **TypeScript** - SPA
- **Leaflet** (react-leaflet) - mappa interattiva
- **Vite** - dev server + build

### Infrastruttura
- **Docker + Docker Compose** - orchestrazione locale (5 servizi)
- **GitHub Actions** - CI (lint, test, Docker build)

## Funzionalita

### Mappa Interattiva
- Mappa dark-themed centrata su Torino con marker colorati per occupazione
- Colori: verde (<70%), ambra (70-90%), rosso (>90%), grigio (non disponibile)
- Geolocalizzazione: "Vicino a me" con ricerca parcheggi nel raggio
- Pannello dettaglio con info GTT: tariffe, metodi pagamento, linee bus, metro
- Grafico storico disponibilita (ultime 6 ore)
- Auto-refresh ogni 2 minuti
- Design responsive (mobile + desktop)

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
- Frontend: React SPA con Leaflet, hook custom con auto-refresh

## Quick Start

```bash
# 1. Clone
git clone https://github.com/MK023/TorinoParking.git
cd TorinoParking

# 2. Configura environment
cp .env.example .env

# 3. Avvia con Docker Compose (backend + frontend + DB + cache)
docker-compose up -d

# 4. Verifica
curl http://localhost:8000/health
```

| Servizio | URL |
|----------|-----|
| Frontend (mappa) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI (dev) | http://localhost:8000/docs |
| Dockhand (Docker UI) | http://localhost:9000 |

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

Vedi [ROADMAP.md](ROADMAP.md) per i miglioramenti pianificati: HTTPS/TLS, circuit breaker, Prometheus metrics, user authentication JWT, push notifications, app mobile iOS.

## License

MIT

## Contatti

Marco Bellingeri - [@MK023](https://github.com/MK023)
