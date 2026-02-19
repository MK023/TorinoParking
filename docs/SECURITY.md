# Security - Threat Model & Best Practices

Documento su sicurezza, threat modeling e linee guida.

## Stato Implementazione

### Implementato
- API key validation con HMAC-SHA256 (hash in PostgreSQL, salt configurabile via env)
- Admin CRUD API key protetto da `X-Admin-Key`
- Rate limiting sliding window multi-tier (anonymous/authenticated/premium) via Redis
- Cache in-memory API key con TTL 60s
- Input validation tramite Pydantic su tutti gli endpoint
- CORS middleware configurato
- SQLAlchemy ORM (prevenzione SQL injection)
- Secrets in environment variables (`.env`, non nel codice)

### Non ancora implementato (materiale di riferimento sotto)
- HTTPS/TLS (nessun reverse proxy configurato, in development si usa HTTP)
- Database encryption at rest
- JWT authentication (non ci sono utenti, solo API key)
- Security headers middleware (HSTS, CSP, etc.)
- Security scanning automatico in CI (Bandit, Trivy, Safety, GitLeaks)
- Prometheus/Sentry monitoring
- Audit log table
- RBAC (role-based access control)

> **Nota:** Le sezioni seguenti servono come linee guida e materiale di
> riferimento per quando queste funzionalita' verranno implementate.
> Non descrivono lo stato attuale del sistema.

---

## Threat Model - OWASP Top 10 (2021)

### A01 - Broken Access Control
**Mitigazioni implementate:**
- API key validation su endpoint sensibili
- Rate limiting multi-tier (IP, API key, user)
- Admin API key protection on sensitive endpoints
- Dependency injection per authorization

**Esempio:**
```python
# app/api/deps.py
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.API_KEY:
        raise HTTPException(403, "Invalid API key")
    return x_api_key
```

### A02 - Cryptographic Failures
**Mitigazioni:**
- [ ] HTTPS only (TLS 1.3) — non ancora configurato
- [x] Secrets in environment variables
- [ ] Database encryption at rest — non implementato
- [x] HMAC-SHA256 per API key hashing (non bcrypt)
- [x] No secrets in Git

**Configurazione:**
```python
# app/config.py
class Settings(BaseSettings):
    API_KEY: str = Field(..., min_length=32)  # Required, strong
    DATABASE_URL: str  # Never print/log this
    SENTRY_DSN: str | None = None  # Optional
    
    class Config:
        env_file = ".env"
        case_sensitive = True
```

### A03 - Injection (SQL, NoSQL, Command)

**SQL Injection Prevention:**
```python
# ✅ SAFE - ORM with parameters
from sqlalchemy import select

async def get_parking(parking_id: str, db: AsyncSession):
    stmt = select(Parking).where(Parking.id == parking_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

# ❌ VULNERABLE - Never do this!
async def get_parking_unsafe(parking_id: str):
    query = f"SELECT * FROM parkings WHERE id = '{parking_id}'"
    # Vulnerable to: parking_id = "1; DROP TABLE parkings;--"
```

**Input Validation:**
```python
# Pydantic validation
from pydantic import BaseModel, Field, validator
import re

class ParkingSearchParams(BaseModel):
    name: str | None = Field(None, max_length=100)
    min_spots: int = Field(0, ge=0, le=1000)
    
    @validator('name')
    def validate_name(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9\s\-]+$', v):
            raise ValueError("Invalid characters in name")
        return v
```

**NoSQL Injection (Redis):**
```python
# ✅ SAFE - Validate keys
async def get_cache(key: str):
    if not key.isalnum() or len(key) > 50:
        raise ValueError("Invalid cache key")
    return await redis.get(f"parking:{key}")

# ❌ DANGEROUS - User input in EVAL
# Never use EVAL with user input!
```

### A04 - Insecure Design

**Secure Design Principles:**
- Principle of Least Privilege
- Fail-safe defaults
- Defense in depth
- Separation of concerns

**Esempio:**
```python
# Default = restrictive
API_RATE_LIMIT_ANONYMOUS = 20  # requests/min
API_RATE_LIMIT_AUTHENTICATED = 100
API_RATE_LIMIT_PREMIUM = 1000

# Fail-safe: se rate limiter fallisce, nega accesso
try:
    await check_rate_limit(api_key)
except Exception:
    raise HTTPException(503, "Rate limiter unavailable")
```

### A05 - Security Misconfiguration

**Production Checklist:**
```python
# ❌ Development
DEBUG = True
CORS_ORIGINS = ["*"]
ALLOWED_HOSTS = ["*"]

# ✅ Production
DEBUG = False
CORS_ORIGINS = ["https://app.example.com"]
ALLOWED_HOSTS = ["api.example.com"]
SWAGGER_ENABLED = False  # Disable in production
```

**Security Headers:**
```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

### A06 - Vulnerable Components

**Dependency Management:**
```bash
# Scan vulnerabilities
pip install safety
safety check

# Keep updated
pip-audit
```

**GitHub Actions:**
```yaml
- name: Safety check
  run: |
    pip install safety
    safety check --json
```

### A07 - Authentication Failures

**API Key Management:**
```python
# Strong API keys (256-bit)
import secrets

def generate_api_key():
    prefix = secrets.token_hex(4)  # 8-char prefix for identification
    secret = secrets.token_urlsafe(32)  # 256-bit secret
    return f"pk_{prefix}_{secret}"

# Storage: HMAC-SHA256 hash in database (salt from env var)
import hmac, hashlib
hashed_key = hmac.new(
    settings.hmac_salt.encode(), api_key.encode(), hashlib.sha256
).hexdigest()
```

**JWT Implementation (non implementato - riferimento per il futuro):**
```python
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = settings.JWT_SECRET  # Strong, random
ALGORITHM = "HS256"

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

### A08 - Software/Data Integrity

**Docker Image Signing:**
```dockerfile
# Use official images
FROM python:3.12-slim

# Verify checksums
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client=16.* \
    && rm -rf /var/lib/apt/lists/*
```

### A09 - Logging & Monitoring Failures

**Structured Logging:**
```python
import structlog

logger = structlog.get_logger()

logger.info(
    "request_completed",
    method=request.method,
    path=request.url.path,
    status_code=response.status_code,
    duration_ms=duration * 1000,
    request_id=request.state.request_id
)
```

**Security Events to Log:**
- Authentication failures
- Authorization failures
- Rate limit exceeded
- Suspicious patterns
- Admin actions

**Audit Log:**
```python
async def log_audit(
    action: str,
    user_id: str,
    resource: str,
    ip: str
):
    await db.execute(
        """
        INSERT INTO audit_log 
        (action, user_id, resource, ip_address, timestamp)
        VALUES (:action, :user_id, :resource, :ip, NOW())
        """,
        {"action": action, "user_id": user_id, ...}
    )
```

### A10 - SSRF (Server-Side Request Forgery)

**Whitelist External URLs:**
```python
ALLOWED_EXTERNAL_APIS = [
    "https://opendata.5t.torino.it"
]

async def fetch_external(url: str):
    if not any(url.startswith(allowed) for allowed in ALLOWED_EXTERNAL_APIS):
        raise ValueError("URL not in whitelist")
    
    async with httpx.AsyncClient() as client:
        return await client.get(url, timeout=10.0)
```

## Rate Limiting - Advanced Implementation

### Multi-Layer Strategy

```python
# app/core/rate_limiting.py
from redis.asyncio import Redis
import time

class RateLimiter:
    """Sliding window rate limiter"""
    
    async def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        burst_max: int | None = None
    ):
        now = time.time()
        window_start = now - window_seconds
        
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(f"rl:{key}", 0, window_start)
        
        # Count current requests
        pipe.zcard(f"rl:{key}")
        
        # Add current request
        pipe.zadd(f"rl:{key}", {str(now): now})
        pipe.expire(f"rl:{key}", window_seconds + 1)
        
        results = await pipe.execute()
        current_requests = results[1]
        
        # Burst protection (1 second window)
        if burst_max:
            burst_start = now - 1
            burst_count = await self.redis.zcount(
                f"rl:{key}", burst_start, now
            )
            if burst_count > burst_max:
                raise HTTPException(429, "Burst rate limit exceeded")
        
        if current_requests > max_requests:
            raise HTTPException(429, "Rate limit exceeded")
```

### Middleware Implementation

```python
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip health checks
    if request.url.path in ["/health", "/metrics"]:
        return await call_next(request)
    
    limiter = RateLimiter(redis)
    api_key = request.headers.get("X-API-Key")
    client_ip = request.client.host
    
    # Tier-based limits
    if api_key == settings.PREMIUM_API_KEY:
        await limiter.check_rate_limit(
            f"premium:{api_key}", 
            max_requests=1000, 
            window_seconds=60,
            burst_max=50
        )
    elif api_key:
        await limiter.check_rate_limit(
            f"api:{api_key}",
            max_requests=100,
            window_seconds=60,
            burst_max=10
        )
    else:
        # Anonymous (strict)
        await limiter.check_rate_limit(
            f"ip:{client_ip}",
            max_requests=20,
            window_seconds=60,
            burst_max=5
        )
    
    response = await call_next(request)
    return response
```

## CORS Configuration

### Development vs Production

```python
# Development
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

# Production
CORS_ORIGINS = [
    "https://app.example.com",
    "https://www.example.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Rate-Limit-Remaining"]
)
```

## CSRF Protection

### When needed?

```
API REST con JWT in header → NO CSRF needed
API con session cookies → CSRF OBBLIGATORIO
```

**Per JWT (non ancora implementato, riferimento futuro):**
```python
# NO CSRF token needed
# JWT in Authorization header = safe from CSRF

async def verify_jwt(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401)
    token = authorization.replace("Bearer ", "")
    # Verify token...
```

**Se usassi cookies:**
```python
from fastapi_csrf_protect import CsrfProtect

@router.post("/action")
async def protected_action(
    csrf_protect: CsrfProtect = Depends()
):
    await csrf_protect.validate_csrf(request)
    # Your code...
```

## XSS Prevention

**JSON API = Low risk, ma...**

```python
# ✅ SAFE - FastAPI auto-escapes JSON
return {"name": parking.name}  # Safe even if name contains <script>

# ❌ DANGEROUS - If you return HTML
from fastapi.responses import HTMLResponse

@router.get("/info", response_class=HTMLResponse)
async def get_info():
    # NEVER interpolate user data in HTML!
    return f"<h1>{user_input}</h1>"  # XSS vulnerable!
```

**Input Sanitization:**
```python
from bleach import clean

@validator('description')
def sanitize_html(cls, v):
    if v:
        return clean(v, tags=[], strip=True)
    return v
```

## Secrets Management

### Environment Variables

```bash
# .env (NEVER commit to Git!)
DATABASE_URL=postgresql+asyncpg://parking:parking123@postgres:5432/parking
ADMIN_API_KEY=your-admin-secret-key-min-32-chars
HMAC_SALT=your-hmac-salt
SENTRY_DSN=  # opzionale
```

### Docker Secrets (Production)

```yaml
# docker-compose.yml
services:
  backend:
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
```

### Rotation Strategy

```python
# Support multiple API keys
VALID_API_KEYS = [
    settings.API_KEY_PRIMARY,
    settings.API_KEY_SECONDARY  # During rotation
]

async def verify_api_key(api_key: str):
    if api_key not in VALID_API_KEYS:
        raise HTTPException(403)
```

## Security Testing

### Automated Scans (non ancora configurati nella CI)

```yaml
# .github/workflows/security.yml (esempio, non presente nel repo)
jobs:
  security:
    steps:
      - name: Bandit (Python SAST)
        run: bandit -r app/
      
      - name: Safety (Dependency check)
        run: safety check
      
      - name: Trivy (Container scan)
        run: trivy image parking-backend:latest
      
      - name: GitLeaks (Secret scan)
        run: gitleaks detect
```

### Manual Testing Checklist

```markdown
- [ ] SQL injection test on all inputs
- [ ] XSS test on text fields
- [ ] CSRF test (if using cookies)
- [ ] Rate limiting test (burst + sustained)
- [ ] Authentication bypass attempts
- [ ] Authorization escalation tests
- [ ] Sensitive data exposure in logs
- [ ] Error message information disclosure
```

## Incident Response Plan

### Detection (pianificato)
- Sentry alerts for errors (non ancora configurato)
- Prometheus alerts for anomalies (non ancora configurato)
- Rate limit violations log
- Failed auth attempts monitoring

### Response Steps
1. Identify scope (logs, metrics)
2. Contain (block IP, revoke keys)
3. Investigate root cause
4. Remediate vulnerability
5. Post-mortem documentation

### Communication
- Internal: Slack/email team
- External: Status page (if public API)
- Legal: GDPR breach notification (if PII exposed)

## Security Checklist - Pre-Production

```markdown
## Network Security
- [ ] HTTPS only (no HTTP)
- [ ] TLS 1.3 configured
- [ ] Valid SSL certificate
- [ ] DDoS protection enabled

## Application Security
- [ ] DEBUG = False
- [ ] Strong API keys (min 32 chars)
- [ ] Rate limiting active
- [ ] CORS restricted
- [ ] Security headers enabled
- [ ] Input validation on all endpoints

## Data Security
- [ ] Database encryption at rest
- [ ] Secrets in env vars (not code)
- [ ] No PII in logs
- [ ] GDPR endpoints implemented

## Monitoring
- [ ] Sentry configured
- [ ] Audit logging active
- [ ] Alerts configured
- [ ] Health checks working

## Compliance
- [ ] Privacy policy published
- [ ] GDPR compliance verified
- [ ] Data retention policy defined
- [ ] Incident response plan documented
```
