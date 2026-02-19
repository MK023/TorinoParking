# Torino Parking

> Real-time parking availability in Turin, Italy. Open data from [5T Torino](https://opendata.5t.torino.it) updated every 2 minutes.

[![CI](https://github.com/MK023/TorinoParking/actions/workflows/ci.yml/badge.svg)](https://github.com/MK023/TorinoParking/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)

<!--
<p align="center">
  <img src="docs/screenshot.png" alt="Torino Parking" width="800">
</p>
-->

## Overview

Full-stack application that aggregates real-time parking data from Turin's open data platform (5T) and enriches it with static details from GTT (address, rates, payment methods, transit connections). Designed mobile-first with an Apple-inspired UI.

## Features

### Frontend
- Interactive Leaflet map with Mapbox tiles (dark/light theme auto-detection)
- Color-coded markers by occupancy: green (free), amber (filling), red (full), grey (closed/out of service)
- Marker clustering with triangle indicators for nearly-full lots
- Geolocation with PostGIS spatial queries ("Near me")
- Parking detail panel: rates, payment methods, transit lines, accessibility info
- Historical availability chart (last 6 hours, hourly aggregation)
- POI layers: hospitals and universities with nearest-parking suggestions
- Real-time weather display (Open-Meteo, no API key required)
- Mobile: iOS-style bottom sheet with swipe gestures, frosted glass backdrop, 44px touch targets
- Desktop: collapsible sidebar with live statistics
- Smart auto-refresh: 2 min browsing, 30s after geolocation

### Backend
- FastAPI async REST API with structured logging (structlog)
- Redis cache with transparent compression (orjson + zlib) and ETag support
- PostgreSQL + PostGIS for spatial queries and time-series snapshots
- In-process APScheduler: fetch 5T data (2 min), log cache stats (hourly), purge old snapshots (daily)
- API key management with HMAC-SHA256 hashing and configurable salt
- Multi-tier sliding-window rate limiting (anonymous / authenticated / premium)
- Input validation via Pydantic, CORS middleware, Sentry integration (optional)

## Architecture

```
Client (Browser/Mobile)
        │
        ▼
┌──────────────────────────┐
│  React 19 + Vite + TS    │  :3000
│  Leaflet + Mapbox tiles   │
└──────────┬───────────────┘
           │ JSON
           ▼
┌──────────────────────────┐
│  FastAPI Backend          │  :8000
│  APScheduler (in-process) │──→ 5T Open Data API (XML)
└────┬─────────┬───────────┘
     │         │
     ▼         ▼
 PostgreSQL   Redis
 + PostGIS    Cache
```

## Quick Start

```bash
# Clone
git clone https://github.com/MK023/TorinoParking.git
cd TorinoParking

# Configure environment
cp .env.example .env
# Edit .env: set ADMIN_API_KEY, POSTGRES_PASSWORD, VITE_MAPBOX_TOKEN

# Start all services
docker compose up -d

# Or use the helper script (auto-detects Doppler secrets)
./scripts/start.sh
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000         |
| Backend   | http://localhost:8000         |
| API Docs  | http://localhost:8000/docs    |

### Secrets Management

The project supports [Doppler](https://www.doppler.com/) for secrets management. If Doppler CLI is configured, the start script auto-detects it and injects secrets. Otherwise, it falls back to the `.env` file.

```bash
# With Doppler
doppler run -- docker compose up -d

# Without Doppler
docker compose up -d  # reads from .env
```

## API Endpoints

| Method | Endpoint                           | Description                    |
|--------|------------------------------------|--------------------------------|
| GET    | `/api/v1/parkings`                 | All parkings (cached)          |
| GET    | `/api/v1/parkings?available=true`  | Filter by availability         |
| GET    | `/api/v1/parkings?min_spots=5`     | Filter by minimum free spots   |
| GET    | `/api/v1/parkings/nearby`          | Spatial search (lat/lng/radius) |
| GET    | `/api/v1/parkings/{id}/history`    | Historical snapshots           |
| GET    | `/health`                          | Health check                   |

Full interactive docs at `/docs` (Swagger UI) or `/redoc`.

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | React 19, TypeScript 5, Vite 7, Leaflet, Mapbox     |
| Backend    | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic 2      |
| Database   | PostgreSQL 16 + PostGIS 3.4                          |
| Cache      | Redis 7 (LRU, 512MB)                                |
| Scheduler  | APScheduler (AsyncIO, in-process)                    |
| CI/CD      | GitHub Actions (lint, test, build, security audit)   |
| Infra      | Docker Compose, Doppler (optional)                   |

## Data Sources

- **Real-time:** [5T Torino Open Data](https://opendata.5t.torino.it) — 40 parking facilities, updated every 2 minutes
- **Static enrichment:** GTT — 22 parkings with address, rates, payment methods, transit connections
- **Weather:** [Open-Meteo](https://open-meteo.com) — current conditions, no API key required
- **POI:** Hospitals (8) and universities (6) with GPS coordinates

## Documentation

| Document                                    | Content                              |
|---------------------------------------------|--------------------------------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)     | System architecture and data flow    |
| [SETUP.md](docs/SETUP.md)                   | Development setup guide              |
| [SECURITY.md](docs/SECURITY.md)             | Threat model and security practices  |
| [GDPR.md](docs/GDPR.md)                     | Privacy compliance reference         |
| [ROADMAP.md](ROADMAP.md)                    | Roadmap and progress tracking        |

## Development

```bash
# Backend linting
ruff check app/ tests/
ruff format app/ tests/

# Backend tests
pytest tests/ -v --cov=app

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend build
cd frontend && npm run build
```

## License

[MIT](LICENSE)

## Author

Marco Bellingeri — [@MK023](https://github.com/MK023)
