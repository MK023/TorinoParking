"""Pydantic models for API request validation and response serialization.

These schemas define the public contract of the REST API. They translate
between domain entities and the JSON representations exposed to clients.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.models import Parking


class ParkingDetailSchema(BaseModel):
    """Static detail enrichment (GTT data)."""

    model_config = {"from_attributes": True}

    address: str = ""
    district: str = ""
    operator: str = "GTT"
    floors: int | None = None
    disabled_spots: int | None = None
    is_covered: bool = True
    is_custodied: bool = False
    open_24h: bool = True
    hourly_rate_daytime: float | None = None
    hourly_rate_nighttime: float | None = None
    daily_rate: float | None = None
    monthly_subscription: float | None = None
    bus_lines: list[str] = Field(default_factory=list)
    has_metro_access: bool = False
    payment_methods: list[str] = Field(default_factory=list)
    cameras: int | None = None
    notes: str = ""


class ParkingSchema(BaseModel):
    """Real-time parking data enriched with optional static detail."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    status: int
    total_spots: int
    free_spots: int | None = None
    tendence: int | None = None
    lat: float
    lng: float
    status_label: str
    is_available: bool
    occupancy_percentage: float | None = Field(None, ge=0, le=100)
    detail: ParkingDetailSchema | None = None

    @classmethod
    def from_domain(cls, parking: Parking, detail: dict | None = None) -> ParkingSchema:
        return cls(
            id=parking.id,
            name=parking.name,
            status=parking.status,
            total_spots=parking.total_spots,
            free_spots=parking.free_spots,
            tendence=parking.tendence,
            lat=parking.lat,
            lng=parking.lng,
            status_label=parking.status_label,
            is_available=parking.is_available,
            occupancy_percentage=parking.occupancy_percentage,
            detail=ParkingDetailSchema(**detail) if detail else None,
        )


class ParkingListResponse(BaseModel):
    total: int
    last_update: datetime
    source: str
    parkings: list[ParkingSchema]


class SnapshotSchema(BaseModel):
    model_config = {"from_attributes": True}

    free_spots: int | None = None
    total_spots: int
    status: int
    tendence: int | None = None
    recorded_at: datetime


class ParkingHistoryResponse(BaseModel):
    parking_id: int
    hours: int
    total_snapshots: int
    snapshots: list[SnapshotSchema]


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    services: dict[str, str]
