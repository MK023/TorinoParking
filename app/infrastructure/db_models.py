"""SQLAlchemy ORM models for the parking database schema.

Defines the persistent representation of parking master data,
static detail (GTT enrichment), time-series availability snapshots,
and API key management.
Uses PostGIS geography types for spatial indexing of parking locations.
"""

from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ParkingEntity(Base):
    __tablename__ = "parkings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_spots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True
    )

    detail: Mapped["ParkingDetailEntity | None"] = relationship(
        back_populates="parking", lazy="joined", uselist=False
    )

    __table_args__ = (
        Index("idx_parkings_location", "location", postgresql_using="gist"),
    )


class ParkingDetailEntity(Base):
    """Static enrichment data scraped from GTT."""

    __tablename__ = "parking_details"

    parking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("parkings.id"), primary_key=True
    )
    address: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    district: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    operator: Mapped[str] = mapped_column(String(100), nullable=False, server_default="GTT")
    floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disabled_spots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_covered: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_custodied: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    open_24h: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    hourly_rate_daytime: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    hourly_rate_nighttime: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    daily_rate: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    monthly_subscription: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    bus_lines: Mapped[list[str] | None] = mapped_column(ARRAY(String(20)), nullable=True)
    has_metro_access: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    payment_methods: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)), nullable=True)
    cameras: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    parking: Mapped["ParkingEntity"] = relationship(back_populates="detail")


class ParkingSnapshot(Base):
    __tablename__ = "parking_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parking_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("parkings.id"), nullable=False
    )
    free_spots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_spots: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[int] = mapped_column(Integer, nullable=False)
    tendence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_snapshot_parking_time", "parking_id", recorded_at.desc()),
        Index("idx_snapshot_recorded_at", recorded_at.desc()),
    )


class ApiKeyEntity(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False, server_default="authenticated")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
