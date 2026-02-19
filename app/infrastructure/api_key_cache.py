"""In-memory cache of active API key hashes for fast middleware lookups.

The cache is refreshed from PostgreSQL every ``TTL_SECONDS`` seconds,
keeping the hot path (middleware + dependency) free from DB round-trips.
"""

import time

from sqlalchemy import select

from app.infrastructure.api_key_service import hash_api_key
from app.infrastructure.database import async_session_factory
from app.infrastructure.db_models import ApiKeyEntity

TTL_SECONDS = 60

_cache: dict[str, str] = {}  # key_hash -> tier
_last_refresh: float = 0.0


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
    """Refresh the cache if it has gone stale."""
    if time.monotonic() - _last_refresh > TTL_SECONDS:
        await refresh()


async def lookup(raw_key: str) -> str | None:
    """Hash *raw_key* and return its tier if present in the cache."""
    await ensure_fresh()
    return _cache.get(hash_api_key(raw_key))


def clear() -> None:
    """Reset the cache (useful in tests)."""
    global _cache, _last_refresh
    _cache = {}
    _last_refresh = 0.0
