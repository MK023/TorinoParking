"""HTTP middleware stack for cross-cutting concerns.

Provides security headers injection, request ID propagation for log
correlation, access logging, and sliding-window rate limiting backed
by Redis.
"""

import logging
import time
import uuid

import structlog
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.infrastructure.rate_limiter import RateLimiter

logger = structlog.get_logger()
access_logger = logging.getLogger("access")
_struct_access = structlog.wrap_logger(access_logger)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        structlog.contextvars.unbind_contextvars("request_id")
        return response


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        _struct_access.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            client_ip=request.client.host if request.client else "unknown",
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        if request.url.path.startswith("/api/v1/admin"):
            return await call_next(request)

        pool = request.app.state.redis_pool
        limiter = RateLimiter(pool)
        api_key = request.headers.get("X-API-Key")

        tier: str | None = None
        if api_key:
            from app.infrastructure.api_key_cache import lookup

            tier = await lookup(api_key)

        if tier == "premium":
            identifier = f"premium:{api_key[:8]}"
            max_requests = settings.rate_limit_premium
        elif tier is not None:
            identifier = f"auth:{api_key[:8]}"
            max_requests = settings.rate_limit_authenticated
        else:
            identifier = f"ip:{request.client.host if request.client else 'unknown'}"
            max_requests = settings.rate_limit_anonymous

        try:
            allowed, remaining, reset_at = await limiter.check(identifier, max_requests)
        except Exception:
            logger.warning("rate_limit_redis_error", exc_info=True)
            return await call_next(request)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_at),
                    "Retry-After": str(max(1, reset_at - int(time.time()))),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_at)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response
