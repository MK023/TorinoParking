"""High-performance Redis cache with transparent compression and ETag support.

Uses orjson for serialization and zlib for payload compression above a
configurable threshold. Provides atomic set-with-ETag operations via
Redis pipelines for conditional HTTP responses. All operations degrade
gracefully on connection errors.
"""

import hashlib

import redis.asyncio as aioredis
import structlog

from app.config import settings
from app.infrastructure.serialization import deserialize, serialize

logger = structlog.get_logger()

PARKINGS_CACHE_KEY = f"{settings.redis_key_prefix}all"


def create_redis_pool() -> aioredis.Redis:
    return aioredis.from_url(
        settings.redis_url,
        decode_responses=False,
        max_connections=settings.redis_max_connections,
        socket_timeout=settings.redis_socket_timeout,
        socket_connect_timeout=settings.redis_socket_connect_timeout,
        retry_on_timeout=settings.redis_retry_on_timeout,
        health_check_interval=30,
    )


class RedisCache:
    def __init__(self, pool: aioredis.Redis, default_ttl: int = 120) -> None:
        self._pool = pool
        self._default_ttl = default_ttl

    def _encode(self, value: dict) -> bytes:
        return serialize(
            value,
            compress=settings.cache_compression,
            threshold=settings.cache_compression_threshold,
        )

    async def get(self, key: str) -> dict | None:
        try:
            data = await self._pool.get(key)
            if data is not None:
                return deserialize(data)
            return None
        except Exception:
            logger.warning("cache_get_error", key=key, exc_info=True)
            return None

    async def set(self, key: str, value: dict, ttl: int | None = None) -> None:
        try:
            await self._pool.set(key, self._encode(value), ex=ttl or self._default_ttl)
        except Exception:
            logger.warning("cache_set_error", key=key, exc_info=True)

    async def set_with_etag(self, key: str, value: dict, ttl: int | None = None) -> str:
        try:
            encoded = self._encode(value)
            etag = hashlib.md5(encoded).hexdigest()  # noqa: S324
            async with self._pool.pipeline(transaction=True) as pipe:
                pipe.set(key, encoded, ex=ttl or self._default_ttl)
                pipe.set(f"{key}:etag", etag, ex=ttl or self._default_ttl)
                await pipe.execute()
            return etag
        except Exception:
            logger.warning("cache_set_etag_error", key=key, exc_info=True)
            return ""

    async def get_etag(self, key: str) -> str | None:
        try:
            etag = await self._pool.get(f"{key}:etag")
            return etag.decode() if etag else None
        except Exception:
            return None

    async def delete(self, key: str) -> None:
        try:
            async with self._pool.pipeline(transaction=True) as pipe:
                pipe.delete(key)
                pipe.delete(f"{key}:etag")
                await pipe.execute()
        except Exception:
            logger.warning("cache_delete_error", key=key, exc_info=True)

    async def ping(self) -> bool:
        try:
            return await self._pool.ping()
        except Exception:
            return False

    async def info(self) -> dict:
        try:
            mem = await self._pool.info("memory")
            return {
                "used_memory": mem.get("used_memory_human", "unknown"),
                "max_memory": mem.get("maxmemory_human", "unknown"),
                "keys": await self._pool.dbsize(),
            }
        except Exception:
            return {}
