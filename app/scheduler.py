"""In-process async scheduler replacing Celery.

Uses APScheduler's AsyncIOScheduler to run periodic jobs inside the
FastAPI event loop.  Jobs reuse the shared httpx client, Redis pool,
and async SQLAlchemy session — no synchronous duplicates needed.
"""

from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
import structlog
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, JobExecutionEvent
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import insert, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.schemas import ParkingDetailSchema, ParkingSchema
from app.config import settings
from app.infrastructure.database import async_session_factory
from app.infrastructure.db_models import ParkingDetailEntity, ParkingEntity, ParkingSnapshot
from app.infrastructure.parser import ParkingXMLParser
from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY
from app.infrastructure.serialization import serialize

logger = structlog.get_logger()

scheduler = AsyncIOScheduler(timezone="Europe/Rome")


def _job_listener(event: JobExecutionEvent) -> None:
    if event.exception:
        logger.error(
            "scheduler_job_error",
            job_id=event.job_id,
            error=str(event.exception),
        )
    else:
        logger.info("scheduler_job_done", job_id=event.job_id)


async def _load_details_map() -> dict[int, dict]:
    """Load all parking detail rows into a dict keyed by parking_id."""
    async with async_session_factory() as session:
        result = await session.execute(select(ParkingDetailEntity))
        details = result.scalars().all()
    return {
        d.parking_id: ParkingDetailSchema.model_validate(d).model_dump()
        for d in details
    }


async def fetch_parking_data(
    http_client: httpx.AsyncClient,
    redis_pool: aioredis.Redis,
) -> None:
    """Fetch parking data from 5T, store snapshots, merge detail, update cache."""
    try:
        response = await http_client.get(
            settings.five_t_api_url, timeout=settings.five_t_timeout
        )
        response.raise_for_status()

        parser = ParkingXMLParser()
        parkings = parser.parse_response(response.text)

        # Load static detail data from DB (one query, cached per cycle)
        details_map = await _load_details_map()

        # Build enriched schemas with detail
        schemas = [
            ParkingSchema.from_domain(p, detail=details_map.get(p.id))
            for p in parkings
        ]
        cache_data = {
            "total": len(schemas),
            "last_update": datetime.now(timezone.utc).isoformat(),
            "source": "5T Torino Open Data + GTT",
            "parkings": [s.model_dump(mode="json") for s in schemas],
        }

        serialized = serialize(
            cache_data,
            compress=settings.cache_compression,
            threshold=settings.cache_compression_threshold,
        )
        await redis_pool.set(PARKINGS_CACHE_KEY, serialized, ex=settings.cache_ttl)

        # Upsert parking master data + store snapshots
        now = datetime.now(timezone.utc)
        async with async_session_factory() as session:
            for p in parkings:
                stmt = pg_insert(ParkingEntity).values(
                    id=p.id,
                    name=p.name,
                    total_spots=p.total_spots,
                    lat=p.lat,
                    lng=p.lng,
                    location=f"SRID=4326;POINT({p.lng} {p.lat})",
                ).on_conflict_do_update(
                    index_elements=["id"],
                    set_={
                        "name": p.name,
                        "total_spots": p.total_spots,
                        "lat": p.lat,
                        "lng": p.lng,
                        "location": f"SRID=4326;POINT({p.lng} {p.lat})",
                    },
                )
                await session.execute(stmt)
            await session.flush()

            rows = [
                {
                    "parking_id": p.id,
                    "free_spots": p.free_spots,
                    "total_spots": p.total_spots,
                    "status": p.status,
                    "tendence": p.tendence,
                    "recorded_at": now,
                }
                for p in parkings
            ]
            await session.execute(insert(ParkingSnapshot), rows)
            await session.commit()

        logger.info("fetch_parking_data_done", count=len(parkings))
    except Exception:
        logger.error("fetch_parking_data_error", exc_info=True)


async def log_cache_stats(redis_pool: aioredis.Redis) -> None:
    """Log Redis memory stats."""
    try:
        info = await redis_pool.info("memory")
        keys = await redis_pool.dbsize()
        logger.info(
            "cache_stats",
            used_memory=info.get("used_memory_human"),
            keys=keys,
        )
    except Exception:
        logger.error("cache_stats_error", exc_info=True)


async def purge_old_snapshots() -> None:
    """Delete snapshots older than retention period."""
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                text(
                    "DELETE FROM parking_snapshots "
                    "WHERE recorded_at < NOW() - make_interval(days => :days)"
                ),
                {"days": settings.snapshot_retention_days},
            )
            await session.commit()
            deleted = result.rowcount
        logger.info("purge_snapshots_done", deleted=deleted)
    except Exception:
        logger.error("purge_snapshots_error", exc_info=True)


def configure_scheduler(
    http_client: httpx.AsyncClient,
    redis_pool: aioredis.Redis,
) -> None:
    """Register all jobs and the event listener."""
    scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    scheduler.add_job(
        fetch_parking_data,
        "interval",
        seconds=120,
        args=[http_client, redis_pool],
        id="fetch_parking_data",
        max_instances=1,
        misfire_grace_time=30,
        replace_existing=True,
    )

    scheduler.add_job(
        log_cache_stats,
        "cron",
        minute=0,
        args=[redis_pool],
        id="log_cache_stats",
        max_instances=1,
        replace_existing=True,
    )

    scheduler.add_job(
        purge_old_snapshots,
        "cron",
        hour=3,
        minute=0,
        id="purge_old_snapshots",
        max_instances=1,
        replace_existing=True,
    )
