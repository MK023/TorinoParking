"""Application factory and lifecycle management for Parking Torino API.

Creates the FastAPI instance with its middleware stack, registers
route modules, and manages the lifecycle of shared resources
including the Redis connection pool, HTTP client, and database engine.
"""

from contextlib import asynccontextmanager

import httpx
import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.middleware import (
    AccessLogMiddleware,
    RateLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.api.routes import health, parkings
from app.api.routes.admin import router as admin_router
from app.config import settings
from app.infrastructure.database import engine
from app.infrastructure.redis_cache import create_redis_pool
from app.logging_config import configure_logging
from app.scheduler import configure_scheduler, scheduler

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)

    app.state.http_client = httpx.AsyncClient(
        limits=httpx.Limits(
            max_connections=settings.httpx_max_connections,
            max_keepalive_connections=settings.httpx_max_keepalive,
            keepalive_expiry=settings.httpx_keepalive_expiry,
        ),
        timeout=httpx.Timeout(settings.five_t_timeout, connect=5.0),
    )
    app.state.redis_pool = create_redis_pool()

    configure_scheduler(app.state.http_client, app.state.redis_pool)
    scheduler.start()

    logger.info("app_startup", environment=settings.environment)
    yield

    scheduler.shutdown(wait=False)
    await app.state.http_client.aclose()
    await app.state.redis_pool.close()
    await engine.dispose()
    logger.info("app_shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    register_exception_handlers(app)

    # Middleware stack (added last = executed first)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=500)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET"],
        allow_headers=["X-API-Key", "Content-Type", "Accept", "If-None-Match"],
    )

    app.include_router(health.router)
    app.include_router(parkings.router)
    app.include_router(admin_router)

    return app


app = create_app()
