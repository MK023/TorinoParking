"""In-memory cache of active API key hashes for fast middleware lookups.

The cache is refreshed from PostgreSQL every ``TTL_SECONDS`` seconds,
keeping the hot path (middleware + dependency) free from DB round-trips.
"""

import asyncio
import time

import structlog
from sqlalchemy import select

from app.infrastructure.api_key_service import hash_api_key
from app.infrastructure.database import async_session_factory
from app.infrastructure.db_models import ApiKeyEntity

logger = structlog.get_logger()

TTL_SECONDS = 60
RETRY_BACKOFF_SECONDS = 5

_cache: dict[str, str] = {}  # key_hash -> tier
_last_refresh: float = 0.0
_refresh_lock = asyncio.Lock()


async def refresh() -> None:
    """Load all active keys from PostgreSQL into the in-memory dict."""
    global _cache, _last_refresh
    async with async_session_factory() as session:
        result = await session.execute(
            select(ApiKeyEntity.key_hash, ApiKeyEntity.tier).where(ApiKeyEntity.is_active.is_(True))
        )
        _cache = {row.key_hash: row.tier for row in result.all()}
    _last_refresh = time.monotonic()


async def ensure_fresh() -> None:
    """Refresh the cache if it has gone stale.

    Uses a lock with double-check to prevent concurrent refreshes:
    under load, multiple coroutines could pass the staleness check
    simultaneously and fire parallel DB queries, causing torn writes
    to ``_cache``. The lock + double-check ensures exactly one refresh
    per TTL window.

    If the DB is transiently unreachable the stale cache keeps serving
    (a key valid 60s ago is better than a 500 for every authenticated
    client) and the next retry is pushed ``RETRY_BACKOFF_SECONDS`` ahead
    so queued requests don't each pay the DB timeout in turn. On a cold
    start with the DB down the cache is empty, so keys fail closed (403).
    """
    global _last_refresh
    if time.monotonic() - _last_refresh > TTL_SECONDS:
        async with _refresh_lock:
            if time.monotonic() - _last_refresh > TTL_SECONDS:
                try:
                    await refresh()
                except Exception:
                    logger.warning("api_key_cache_refresh_failed", exc_info=True)
                    _last_refresh = time.monotonic() - TTL_SECONDS + RETRY_BACKOFF_SECONDS


async def lookup(raw_key: str) -> str | None:
    """Hash *raw_key* and return its tier if present in the cache."""
    await ensure_fresh()
    return _cache.get(hash_api_key(raw_key))


def clear() -> None:
    """Reset the cache (useful in tests)."""
    global _cache, _last_refresh
    _cache = {}
    _last_refresh = 0.0
