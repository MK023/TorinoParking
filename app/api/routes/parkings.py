"""Parking data endpoints providing real-time availability from the 5T feed.

Supports ETag-based conditional requests to minimize bandwidth for
polling clients. Data is served from cache when available, falling
back to a live 5T API fetch on cache miss.
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Header, Query, Security
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_cache_service, get_db_session, get_parking_repository, verify_api_key
from app.api.schemas import ParkingDetailSchema, ParkingHistoryResponse, ParkingListResponse, ParkingSchema, SnapshotSchema
from app.domain.exceptions import ParkingNotFoundError
from app.domain.interfaces import CacheService, ParkingRepository
from app.infrastructure.db_repository import ParkingDBRepository
from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/parkings", tags=["parkings"])


async def _get_parkings_data(
    cache: CacheService,
    repository: ParkingRepository,
) -> tuple[ParkingListResponse, str]:
    cached = await cache.get(PARKINGS_CACHE_KEY)
    if cached:
        etag = await cache.get_etag(PARKINGS_CACHE_KEY)
        return ParkingListResponse(**cached), etag or ""

    parkings = await repository.fetch_all()
    schemas = [ParkingSchema.from_domain(p) for p in parkings]
    response = ParkingListResponse(
        total=len(schemas),
        last_update=datetime.now(timezone.utc),
        source="5T Torino Open Data",
        parkings=schemas,
    )
    etag = await cache.set_with_etag(PARKINGS_CACHE_KEY, response.model_dump(mode="json"))
    return response, etag


@router.get("", response_model=ParkingListResponse)
async def get_parkings(
    available: bool | None = Query(None, description="Filter by availability"),
    min_spots: int | None = Query(None, ge=0, description="Minimum free spots"),
    api_key: str | None = Security(verify_api_key),
    cache: CacheService = Depends(get_cache_service),
    repository: ParkingRepository = Depends(get_parking_repository),
    if_none_match: str | None = Header(None),
) -> ParkingListResponse | Response:
    """Get real-time parking availability in Torino.

    Supports ETag conditional requests via the If-None-Match header.
    Optionally filter by availability and minimum free spots.
    """
    if if_none_match:
        current_etag = await cache.get_etag(PARKINGS_CACHE_KEY)
        if current_etag and if_none_match.strip('"') == current_etag:
            return Response(status_code=304, headers={"ETag": f'"{current_etag}"'})

    data, etag = await _get_parkings_data(cache, repository)

    filtered = data.parkings
    if available is not None:
        filtered = [p for p in filtered if p.is_available == available]
    if min_spots is not None:
        filtered = [
            p for p in filtered
            if p.free_spots is not None and p.free_spots >= min_spots
        ]

    result = ParkingListResponse(
        total=len(filtered),
        last_update=data.last_update,
        source=data.source,
        parkings=filtered,
    )
    headers = {"ETag": f'"{etag}"'} if etag else {}
    return JSONResponse(content=result.model_dump(mode="json"), headers=headers)


@router.get("/nearby", response_model=ParkingListResponse)
async def get_nearby_parkings(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(1000, ge=100, le=5000, description="Radius in meters"),
    limit: int = Query(10, ge=1, le=50),
    api_key: str | None = Security(verify_api_key),
    db: AsyncSession = Depends(get_db_session),
) -> ParkingListResponse:
    """Find parkings within radius (meters) of a point. Uses PostGIS."""
    repo = ParkingDBRepository(db)
    entities = await repo.find_nearby(lat, lng, radius, limit)
    parkings = []
    for e in entities:
        detail_dict = (
            ParkingDetailSchema.model_validate(e.detail).model_dump()
            if e.detail
            else None
        )
        parkings.append(
            ParkingSchema(
                id=e.id,
                name=e.name,
                status=0,
                total_spots=e.total_spots,
                free_spots=None,
                tendence=None,
                lat=e.lat,
                lng=e.lng,
                status_label="nessun dato",
                is_available=False,
                occupancy_percentage=None,
                detail=ParkingDetailSchema(**detail_dict) if detail_dict else None,
            )
        )
    return ParkingListResponse(
        total=len(parkings),
        last_update=datetime.now(timezone.utc),
        source="PostGIS spatial query",
        parkings=parkings,
    )


@router.get("/{parking_id}", response_model=ParkingSchema)
async def get_parking(
    parking_id: int,
    api_key: str | None = Security(verify_api_key),
    cache: CacheService = Depends(get_cache_service),
    repository: ParkingRepository = Depends(get_parking_repository),
) -> ParkingSchema:
    """Get a single parking by ID."""
    data, _ = await _get_parkings_data(cache, repository)
    for p in data.parkings:
        if p.id == parking_id:
            return p
    raise ParkingNotFoundError(parking_id)


@router.get("/{parking_id}/history", response_model=ParkingHistoryResponse)
async def get_parking_history(
    parking_id: int,
    hours: int = Query(24, ge=1, le=720),
    api_key: str | None = Security(verify_api_key),
    db: AsyncSession = Depends(get_db_session),
) -> ParkingHistoryResponse:
    """Get availability history for a parking (default: last 24h)."""
    repo = ParkingDBRepository(db)
    snapshots = await repo.get_history(parking_id, hours)
    return ParkingHistoryResponse(
        parking_id=parking_id,
        hours=hours,
        total_snapshots=len(snapshots),
        snapshots=[SnapshotSchema.model_validate(s) for s in snapshots],
    )
