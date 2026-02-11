"""FastAPI dependency injection providers.

Wires infrastructure implementations to domain protocol contracts.
Each provider extracts shared resources from ``app.state`` and constructs
the appropriate infrastructure object per request.
"""

import httpx
import redis.asyncio as aioredis
from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.database import async_session_factory
from app.infrastructure.five_t_client import FiveTClient
from app.infrastructure.redis_cache import RedisCache

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str | None:
    if api_key is not None:
        from app.infrastructure.api_key_cache import lookup

        tier = await lookup(api_key)
        if tier is None:
            raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key


def get_redis_pool(request: Request) -> aioredis.Redis:
    return request.app.state.redis_pool


def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


def get_cache_service(request: Request) -> RedisCache:
    return RedisCache(pool=get_redis_pool(request), default_ttl=settings.cache_ttl)


def get_parking_repository(request: Request) -> FiveTClient:
    return FiveTClient(
        client=get_http_client(request),
        url=settings.five_t_api_url,
        timeout=settings.five_t_timeout,
    )


async def get_db_session():
    async with async_session_factory() as session:
        yield session
