"""Integration tests for sliding-window rate limiter with real Redis."""

import pytest

from app.infrastructure.rate_limiter import RateLimiter


@pytest.mark.asyncio
async def test_rate_limiter_allows_within_limit():
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        limiter = RateLimiter(pool)
        key = "test:rate_allow"
        await pool.delete(f"ratelimit:{key}")

        for _ in range(5):
            allowed, remaining, _ = await limiter.check(key, 5)
            assert allowed is True
    finally:
        await pool.delete(f"ratelimit:{key}")
        await pool.close()


@pytest.mark.asyncio
async def test_rate_limiter_blocks_over_limit():
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        limiter = RateLimiter(pool)
        key = "test:rate_block"
        await pool.delete(f"ratelimit:{key}")

        for _ in range(3):
            await limiter.check(key, 3)

        allowed, remaining, _ = await limiter.check(key, 3)
        assert allowed is False
        assert remaining == 0
    finally:
        await pool.delete(f"ratelimit:{key}")
        await pool.close()
