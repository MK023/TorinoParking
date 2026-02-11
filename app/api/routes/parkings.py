"""Parking data endpoints providing real-time availability from the 5T feed.

Supports ETag-based conditional requests to minimize bandwidth for
polling clients. Data is served from cache when available, falling
back to a live 5T API fetch on cache miss.
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Header, Security
from fastapi.responses import JSONResponse, Response

from app.api.dependencies import get_cache_service, get_parking_repository, verify_api_key
from app.api.schemas import ParkingListResponse, ParkingSchema
from app.domain.exceptions import ParkingNotFoundError
from app.domain.interfaces import CacheService, ParkingRepository
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
    api_key: str | None = Security(verify_api_key),
    cache: CacheService = Depends(get_cache_service),
    repository: ParkingRepository = Depends(get_parking_repository),
    if_none_match: str | None = Header(None),
) -> ParkingListResponse | Response:
    """Get real-time parking availability in Torino.

    Supports ETag conditional requests via the If-None-Match header.
    """
    if if_none_match:
        current_etag = await cache.get_etag(PARKINGS_CACHE_KEY)
        if current_etag and if_none_match.strip('"') == current_etag:
            return Response(status_code=304, headers={"ETag": f'"{current_etag}"'})

    data, etag = await _get_parkings_data(cache, repository)
    headers = {"ETag": f'"{etag}"'} if etag else {}
    return JSONResponse(content=data.model_dump(mode="json"), headers=headers)


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
