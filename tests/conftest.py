"""Shared test fixtures.

When running locally, testcontainers spin up PostgreSQL (PostGIS) and Redis.
In CI (``GITHUB_ACTIONS`` env var set), service containers are used instead
and testcontainers are skipped.
"""

import os
from unittest.mock import patch

import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Detect CI vs local
# ---------------------------------------------------------------------------
IN_CI = os.environ.get("GITHUB_ACTIONS") == "true"

_pg_container = None
_redis_container = None


def pytest_configure(config):
    """Set env vars BEFORE any app module is imported."""
    global _pg_container, _redis_container

    if IN_CI:
        # CI service containers expose on localhost
        os.environ.setdefault(
            "DATABASE_URL",
            "postgresql+asyncpg://parking:parking@localhost:5432/parking",
        )
        os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    else:
        # Local: spin up testcontainers
        from testcontainers.postgres import PostgresContainer
        from testcontainers.redis import RedisContainer

        _pg_container = (
            PostgresContainer(
                image="postgis/postgis:16-3.4-alpine",
                username="parking",
                password="parking",
                dbname="parking",
            )
            .with_exposed_ports(5432)
        )
        _pg_container.start()

        pg_host = _pg_container.get_container_host_ip()
        pg_port = _pg_container.get_exposed_port(5432)
        os.environ["DATABASE_URL"] = (
            f"postgresql+asyncpg://parking:parking@{pg_host}:{pg_port}/parking"
        )

        _redis_container = RedisContainer(image="redis:7-alpine").with_exposed_ports(6379)
        _redis_container.start()

        redis_host = _redis_container.get_container_host_ip()
        redis_port = _redis_container.get_exposed_port(6379)
        os.environ["REDIS_URL"] = f"redis://{redis_host}:{redis_port}/0"

    # Common test settings
    os.environ["ENVIRONMENT"] = "test"
    os.environ["ADMIN_API_KEY"] = "test-admin-key-that-is-long-enough-32ch"
    os.environ["LOG_LEVEL"] = "WARNING"

    # Reset cached settings so they pick up new env vars
    from app.config import get_settings

    get_settings.cache_clear()


def pytest_unconfigure(config):
    global _pg_container, _redis_container
    if _pg_container is not None:
        _pg_container.stop()
    if _redis_container is not None:
        _redis_container.stop()


@pytest.fixture(scope="session")
def _create_tables():
    """Create all tables once per session (faster than running Alembic)."""
    import asyncio

    from app.infrastructure.database import engine
    from app.infrastructure.db_models import Base

    async def _setup():
        async with engine.begin() as conn:
            # PostGIS extension may not exist in test container without migration
            await conn.execute(
                __import__("sqlalchemy").text(
                    "CREATE EXTENSION IF NOT EXISTS postgis"
                )
            )
            await conn.run_sync(Base.metadata.create_all)

    asyncio.get_event_loop_policy().new_event_loop().run_until_complete(_setup())
    yield


@pytest_asyncio.fixture
async def client(_create_tables):
    """ASGI test client with scheduler mocked out."""
    from httpx import ASGITransport, AsyncClient

    with (
        patch("app.main.configure_scheduler"),
        patch("app.main.scheduler") as mock_sched,
    ):
        mock_sched.start = lambda: None
        mock_sched.shutdown = lambda wait=True: None

        from app.main import create_app

        app = create_app()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            yield ac


@pytest_asyncio.fixture
async def db_session():
    """Provide a fresh async DB session for tests."""
    from app.infrastructure.database import async_session_factory

    async with async_session_factory() as session:
        yield session
        await session.rollback()
