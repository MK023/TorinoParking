"""PostgreSQL repository for parking historical data.

Implements write operations for storing snapshots and read operations
for historical and spatial queries. All queries use parameterized
SQLAlchemy statements to prevent injection.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import insert, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.domain.models import Parking
from app.infrastructure.db_models import ParkingDetailEntity, ParkingEntity, ParkingSnapshot


class ParkingDBRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_parking_metadata(self, parkings: list[Parking]) -> int:
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
            await self._session.execute(stmt)
        await self._session.flush()
        return len(parkings)

    async def store_snapshots(self, parkings: list[Parking]) -> int:
        now = datetime.now(timezone.utc)
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
        await self._session.execute(insert(ParkingSnapshot), rows)
        await self._session.commit()
        return len(rows)

    async def find_nearby(
        self, lat: float, lng: float, radius_meters: int = 1000, limit: int = 10
    ) -> list[ParkingEntity]:
        """Spatial query: parkings within *radius_meters*, with detail joined."""
        point = f"SRID=4326;POINT({lng} {lat})"
        stmt = (
            select(ParkingEntity)
            .options(joinedload(ParkingEntity.detail))
            .where(text("ST_DWithin(location, ST_GeogFromText(:point), :radius)"))
            .params(point=point, radius=radius_meters)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_history(
        self, parking_id: int, hours: int = 24
    ) -> list[ParkingSnapshot]:
        """Return snapshots for a parking within the last N hours."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        stmt = (
            select(ParkingSnapshot)
            .where(
                ParkingSnapshot.parking_id == parking_id,
                ParkingSnapshot.recorded_at >= cutoff,
            )
            .order_by(ParkingSnapshot.recorded_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_details(self) -> dict[int, ParkingDetailEntity]:
        """Load all detail rows in a single query, keyed by parking_id."""
        result = await self._session.execute(select(ParkingDetailEntity))
        return {d.parking_id: d for d in result.scalars().all()}
