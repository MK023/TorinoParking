"""Health check endpoint for infrastructure monitoring and orchestration.

Returns the operational status of all backing services. Used by Docker
HEALTHCHECK, load balancers, and uptime monitors to determine whether
the instance should receive traffic.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_cache_service, get_db_session
from app.api.schemas import HealthResponse
from app.config import settings
from app.domain.interfaces import CacheService

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    cache: CacheService = Depends(get_cache_service),
    db: AsyncSession = Depends(get_db_session),
) -> HealthResponse | JSONResponse:
    redis_ok = await cache.ping()

    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    all_ok = redis_ok and db_ok
    response = HealthResponse(
        status="healthy" if all_ok else "degraded",
        version=settings.version,
        environment=settings.environment,
        services={
            "redis": "up" if redis_ok else "down",
            "postgres": "up" if db_ok else "down",
            "five_t_api": "configured",
        },
    )
    if not all_ok:
        return JSONResponse(content=response.model_dump(), status_code=503)
    return response
