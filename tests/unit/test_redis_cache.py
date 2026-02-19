"""Unit tests for RedisCache operations."""

import pytest
import pytest_asyncio

from app.infrastructure.redis_cache import RedisCache, create_redis_pool


@pytest_asyncio.fixture
async def cache():
    """Create a RedisCache instance connected to the test Redis."""
    pool = create_redis_pool()
    rc = RedisCache(pool=pool, default_ttl=10)
    yield rc
    await pool.flushdb()
    await pool.close()


class TestRedisCache:
    @pytest.mark.asyncio
    async def test_set_and_get(self, cache):
        await cache.set("test:key", {"a": 1})
        result = await cache.get("test:key")
        assert result == {"a": 1}

    @pytest.mark.asyncio
    async def test_get_missing_key(self, cache):
        result = await cache.get("test:missing")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_with_etag(self, cache):
        etag = await cache.set_with_etag("test:etag", {"b": 2})
        assert isinstance(etag, str)
        assert len(etag) == 32  # MD5 hex

    @pytest.mark.asyncio
    async def test_get_etag(self, cache):
        etag = await cache.set_with_etag("test:etag2", {"c": 3})
        stored_etag = await cache.get_etag("test:etag2")
        assert stored_etag == etag

    @pytest.mark.asyncio
    async def test_get_etag_missing(self, cache):
        result = await cache.get_etag("test:no_etag")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete(self, cache):
        await cache.set("test:del", {"d": 4})
        await cache.delete("test:del")
        result = await cache.get("test:del")
        assert result is None

    @pytest.mark.asyncio
    async def test_ping(self, cache):
        assert await cache.ping() is True

    @pytest.mark.asyncio
    async def test_info(self, cache):
        info = await cache.info()
        assert "used_memory" in info
        assert "keys" in info
