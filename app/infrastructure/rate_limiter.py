"""Sliding window rate limiter backed by Redis sorted sets.

Each request timestamp is stored as a member scored by its Unix time.
Counting members within the window gives the current request count.
A single Redis pipeline makes the check-and-increment atomic, with an
automatic expiry slightly longer than the window to prevent unbounded
key growth.
"""

import time

import redis.asyncio as aioredis
import structlog

logger = structlog.get_logger()

WINDOW_SECONDS = 60


class RateLimiter:
    def __init__(self, pool: aioredis.Redis) -> None:
        self._pool = pool

    async def check(self, identifier: str, max_requests: int) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, reset_at_epoch)."""
        now = time.time()
        key = f"ratelimit:{identifier}"

        async with self._pool.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, now - WINDOW_SECONDS)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, WINDOW_SECONDS + 1)
            results = await pipe.execute()

        current_count = results[1]
        reset_at = int(now) + WINDOW_SECONDS
        allowed = current_count < max_requests

        if not allowed:
            await self._pool.zrem(key, str(now))
            return False, 0, reset_at

        remaining = max(0, max_requests - current_count - 1)
        return True, remaining, reset_at
