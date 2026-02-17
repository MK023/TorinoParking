# Architecture - Torino Parking API

> **Nota:** Questo e' un documento in evoluzione. Alcune sezioni descrivono
> l'architettura pianificata e non ancora implementata. Le sezioni non ancora
> realizzate sono contrassegnate come tali.

Documento di architettura del sistema.

## Overview Sistema

```
┌─────────────┐
│ Mobile App  │
│ iOS/Android │
└──────┬──────┘
       │ HTTPS/JSON
       │ API Key
       ▼
┌──────────────────────────────────┐
│      FastAPI Backend             │
│  ┌────────────────────────────┐  │
│  │  API Layer (Routes)        │  │
│  └─────────┬──────────────────┘  │
│            ▼                      │
│  ┌────────────────────────────┐  │
│  │  Domain (Business Logic)   │  │
│  └─────────┬──────────────────┘  │
│            ▼                      │
│  ┌────────────────────────────┐  │
│  │  Infrastructure (DB/API)   │  │
│  └────────────────────────────┘  │
│                                   │
│  ┌────────────────────────────┐  │
│  │  APScheduler (in-process)  │  │
│  │  - fetch 5T data (2 min)   │  │
│  │  - cleanup cache (1 hr)    │  │
│  │  - purge snapshots (daily) │  │
│  └────────────────────────────┘  │
└─────┬──────────┬─────────────────┘
      │          │
      ▼          ▼
┌──────────┐  ┌──────────┐  ┌─────────┐
│PostgreSQL│  │  Redis   │  │ 5T API  │
│+ PostGIS │  │  Cache   │  │(XML)    │
└──────────┘  └──────────┘  └─────────┘
```

## Clean Architecture Layers

### 1. API Layer (`app/api/`)
Responsabilità:
- HTTP request/response handling
- Input validation (Pydantic)
- Dependency injection
- Error handling HTTP

### 2. Domain Layer (`app/domain/`)
Responsabilita':
- Models (Parking, ParkingDetail)
- Interfaces (repository protocol)
- Business rules (no I/O)

Esempio:
```python
# app/domain/models.py
@dataclass
class Parking:
    id: int
    name: str
    lat: float
    lng: float
    free_spots: int | None

    def is_available(self) -> bool:
        """Business rule"""
        return self.free_spots is not None and self.free_spots > 0
```

### 3. Infrastructure Layer (`app/infrastructure/`)
Responsabilità:
- Database access (SQLAlchemy)
- External API clients (5T API)
- Cache (Redis)
- File system

## Data Flow

### Request Flow (Read)
```
1. Mobile App → GET /api/v1/parkings?lat=45.06&lng=7.68

2. FastAPI → Middleware stack
   - CORS headers
   - Rate limiting (Redis)
   - Security headers
   - Request logging

3. API Layer → Validate input (Pydantic)
   - ParkingSearchParams model

4. Use Case → Get from cache
   - Check Redis: key="parkings:all"
   - Cache HIT? Return
   - Cache MISS? Continue

5. Repository → Fetch from DB/API
   - Query PostgreSQL (historical data)
   - Call 5T API if fresh data needed
   - Parse XML → Domain entities

6. Transform → Response
   - Domain entities → Pydantic response models
   - Add metadata (total, last_update)

7. Cache → Store result
   - Redis SET with TTL 120s

8. Response → JSON to client
   - HTTP 200 + JSON
   - Headers: X-Rate-Limit, X-Process-Time
```

### Background Tasks Flow (Write)
```
1. APScheduler (in-process) → Trigger scheduled job
   - Every 2 minutes

2. Scheduler job → Execute
   - fetch_parking_data()

3. 5T API Client → HTTP GET
   - https://opendata.5t.torino.it/get_pk
   - Parse XML response

4. Repository → Save to DB
   - INSERT INTO parking_snapshots
   - Batch insert for performance

5. Cache → Update Redis
   - SET parkings:all (JSON, compressed)
   - TTL 120 seconds
```

## Component Details

### PostgreSQL Schema
```sql
-- Master data
CREATE TABLE parkings (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_spots INTEGER NOT NULL DEFAULT 0,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    location GEOGRAPHY(POINT, 4326)
);

-- Time-series data (snapshots from 5T)
CREATE TABLE parking_snapshots (
    id BIGSERIAL PRIMARY KEY,
    parking_id INTEGER REFERENCES parkings(id),
    free_spots INTEGER,
    total_spots INTEGER NOT NULL,
    status INTEGER NOT NULL,
    tendence INTEGER,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_snapshot_parking_time
    ON parking_snapshots(parking_id, recorded_at DESC);

CREATE INDEX idx_snapshot_recorded_at
    ON parking_snapshots(recorded_at DESC);

CREATE INDEX idx_parkings_location
    ON parkings USING GIST(location);
```

### Redis Cache Strategy
```
Key structure:
- parkings:all → List of all parkings (TTL 120s)
- parking:{id} → Single parking detail (TTL 120s)
- rate_limit:{api_key} → Rate limit counter (TTL 60s)
- cache:stats → Cache hit/miss stats

Eviction policy: LRU (Least Recently Used)
Max memory: 512MB
```

### APScheduler Jobs
```python
# Periodic jobs (in-process APScheduler)
1. fetch_parking_data (every 2 min)   — fetch from 5T API, update cache + DB
2. cleanup_expired_cache (every hour) — remove stale Redis keys
3. purge_old_snapshots (daily)        — delete parking_snapshots older than retention period
```

## Deployment Architecture

```
┌────────────────────────────────┐
│      Docker Compose Stack      │
│                                │
│  ┌──────────────────────────┐  │
│  │  backend (container)     │  │
│  │  FastAPI + APScheduler   │  │
│  │  Port: 8000              │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  postgres (container)    │  │
│  │  PostGIS 16              │  │
│  │  Port: 5432              │  │
│  │  Volume: postgres_data   │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  redis (container)       │  │
│  │  Port: 6379              │  │
│  │  Volume: redis_data      │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  dockhand (container)    │  │
│  │  Docker UI Manager       │  │
│  │  Port: 3000              │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
- FastAPI: Stateless, can scale N instances (nota: APScheduler e' in-process, quindi servira' un lock distribuito per evitare job duplicati su piu' istanze)
- PostgreSQL: Read replicas for heavy read workload
- Redis: Redis Cluster for high availability

### Vertical Scaling
- Database: More RAM for larger datasets
- Redis: Memory-intensive, size based on cache needs

### Performance Targets
- API Response time: < 100ms (p95)
- Cache hit rate: > 95%
- Database queries: < 50ms (p95)
- Background tasks: Complete within 30s

## Security Architecture

Vedi [SECURITY.md](SECURITY.md) per dettagli completi.

Implementato:
1. Application (CORS, rate limiting sliding window)
2. Authentication (API keys con HMAC-SHA256)
3. Authorization (Admin key per admin routes)

Pianificato:
4. Network (TLS, reverse proxy)
5. User auth (JWT, RBAC)
6. Data (encryption at rest)
7. Monitoring (audit logs, alerts)

## Monitoring & Observability

### Implementato
- **structlog** per logging strutturato JSON con correlation ID (request_id)
- Log level configurabile via env var `LOG_LEVEL`
- **Sentry** error tracking integrato (opzionale, attivabile via `SENTRY_DSN` in env)

### Pianificato
- Prometheus metrics endpoint (`/metrics`) con metriche custom
- Grafana dashboard preconfigurata

## ADR (Architecture Decision Records)

### ADR-001: PostgreSQL over MongoDB
**Decision:** PostgreSQL + PostGIS
**Rationale:** 
- GIS queries native
- JSONB for flexibility
- ACID guarantees

### ADR-002: Redis for caching
**Decision:** Redis over Memcached
**Rationale:**
- Persistence support
- Data structures (sorted sets for rate limiting)
- Pub/sub for future real-time features

### ADR-003: APScheduler over Celery
**Decision:** APScheduler in-process scheduler
**Rationale:**
- Nessun container aggiuntivo (no worker, no beat separati)
- Sufficiente per 3 job periodici (fetch, cleanup, purge)
- Setup semplice: scheduler parte con l'app FastAPI
- Se servira' scaling orizzontale, si valutera' Celery o ARQ

### ADR-004: FastAPI over Flask/Django
**Decision:** FastAPI
**Rationale:**
- Native async/await
- Automatic OpenAPI docs
- Type safety with Pydantic
- Modern, performant
