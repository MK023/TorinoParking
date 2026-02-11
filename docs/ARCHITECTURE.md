# 🏗️ Architecture - Torino Parking API

Documento di architettura completa del sistema.

## Overview Sistema

```
┌─────────────┐
│ Mobile App  │
│ iOS/Android │
└──────┬──────┘
       │ HTTPS/JSON
       │ API Key / JWT
       ▼
┌──────────────────┐
│  Load Balancer   │
│  (Nginx/Caddy)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────────┐
│      FastAPI Backend             │
│  ┌────────────────────────────┐  │
│  │  API Layer (Routes)        │  │
│  └─────────┬──────────────────┘  │
│            ▼                      │
│  ┌────────────────────────────┐  │
│  │  Application (Use Cases)   │  │
│  └─────────┬──────────────────┘  │
│            ▼                      │
│  ┌────────────────────────────┐  │
│  │  Domain (Business Logic)   │  │
│  └─────────┬──────────────────┘  │
│            ▼                      │
│  ┌────────────────────────────┐  │
│  │  Infrastructure (DB/API)   │  │
│  └────────────────────────────┘  │
└─────┬──────────┬─────────────────┘
      │          │
      ▼          ▼
┌──────────┐  ┌──────────┐  ┌─────────┐
│PostgreSQL│  │  Redis   │  │ 5T API  │
│+ PostGIS │  │  Cache   │  │(XML)    │
└──────────┘  └────┬─────┘  └─────────┘
                   │
              ┌────▼────┐
              │ Celery  │
              │ Workers │
              └─────────┘
```

## Clean Architecture Layers

### 1. API Layer (`app/api/`)
Responsabilità:
- HTTP request/response handling
- Input validation (Pydantic)
- Dependency injection
- Error handling HTTP

### 2. Application Layer (`app/application/`)
Responsabilità:
- Use cases (orchestrazione)
- Business workflows
- Transaction management

Esempio:
```python
# app/application/use_cases/get_parkings.py
class GetParkingsUseCase:
    def __init__(self, repository: ParkingRepository):
        self.repository = repository
    
    async def execute(self, filters: ParkingFilters):
        return await self.repository.get_all(filters)
```

### 3. Domain Layer (`app/domain/`)
Responsabilità:
- Entities (Parking, User)
- Value Objects (Coordinate, Address)
- Business rules PURE (no I/O)

Esempio:
```python
# app/domain/entities/parking.py
@dataclass
class Parking:
    id: str
    name: str
    coordinate: Coordinate
    free_spots: int
    
    def is_available(self) -> bool:
        """Business rule"""
        return self.free_spots > 0
```

### 4. Infrastructure Layer (`app/infrastructure/`)
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
1. Celery Beat → Trigger scheduled task
   - Every 2 minutes

2. Celery Worker → Execute task
   - fetch_parking_data()

3. 5T API Client → HTTP GET
   - https://opendata.5t.torino.it/get_pk
   - Parse XML response

4. Repository → Save to DB
   - INSERT INTO parking_availability_history
   - Batch insert for performance

5. Cache → Update Redis
   - SET parkings:all (JSON)
   - TTL 120 seconds
```

## Component Details

### PostgreSQL Schema
```sql
-- Master data
CREATE TABLE parkings (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    total_spots INTEGER,
    pricing_info JSONB
);

-- Time-series data
CREATE TABLE parking_availability_history (
    id BIGSERIAL PRIMARY KEY,
    parking_id VARCHAR(50) REFERENCES parkings(id),
    free_spots INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_availability_time 
    ON parking_availability_history(parking_id, recorded_at DESC);

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

### Celery Tasks
```python
# Periodic tasks (Celery Beat)
1. fetch_parking_data (every 2 min)
2. cleanup_expired_cache (every hour)
3. process_daily_analytics (daily at 3 AM)

# On-demand tasks
1. send_availability_alert(user_id, parking_id)
2. scan_vulnerabilities()
```

## Deployment Architecture

```
┌────────────────────────────────┐
│      Docker Compose Stack      │
│                                │
│  ┌──────────────────────────┐  │
│  │  fastapi (container)     │  │
│  │  Port: 8000              │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  postgres (container)    │  │
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
│  │  celery_worker           │  │
│  └──────────────────────────┘  │
│                                │
│  ┌──────────────────────────┐  │
│  │  celery_beat             │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
        │
        │ Managed by
        ▼
┌────────────────────┐
│     Dockhand       │
│  Docker UI Manager │
│  Port: 3000        │
└────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
- FastAPI: Stateless, can scale N instances
- Celery Workers: Scale based on queue depth
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

Layers:
1. Network (TLS, firewall)
2. Application (CORS, rate limiting)
3. Authentication (API keys, JWT)
4. Authorization (RBAC)
5. Data (encryption, GDPR)
6. Monitoring (audit logs, alerts)

## Monitoring & Observability

### Metrics (Prometheus)
- Request rate, latency, errors
- Cache hit/miss ratio
- Database connection pool
- Celery queue depth

### Logging (Structured JSON)
```json
{
  "timestamp": "2025-02-11T14:30:00Z",
  "level": "INFO",
  "request_id": "abc-123",
  "method": "GET",
  "path": "/api/v1/parkings",
  "status_code": 200,
  "duration_ms": 42
}
```

### Error Tracking (Sentry)
- Automatic error capture
- Stack traces with context
- Release tracking
- Performance monitoring

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

### ADR-003: Celery over custom queue
**Decision:** Celery with Redis broker
**Rationale:**
- Mature, battle-tested
- Built-in scheduling (Beat)
- Good monitoring tools (Flower)

### ADR-004: FastAPI over Flask/Django
**Decision:** FastAPI
**Rationale:**
- Native async/await
- Automatic OpenAPI docs
- Type safety with Pydantic
- Modern, performant
