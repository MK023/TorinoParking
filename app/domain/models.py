"""Domain entities representing the core business objects of the parking system.

Each entity is a frozen dataclass enforcing immutability. Business rules
such as availability checks and occupancy calculations are expressed
as computed properties on the entities themselves.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Parking:
    """Real-time parking data from 5T feed."""

    id: int
    name: str
    status: int
    total_spots: int
    free_spots: int | None
    tendence: int | None
    lat: float
    lng: float

    @property
    def status_label(self) -> str:
        if self.status == 0:
            return "fuori servizio"
        if self.free_spots is None:
            return "nessun dato"
        if self.free_spots == 0:
            return "pieno"
        return "aperto"

    @property
    def is_available(self) -> bool:
        return self.status == 1 and self.free_spots is not None and self.free_spots > 0

    @property
    def occupancy_percentage(self) -> float | None:
        if self.free_spots is None or self.total_spots == 0:
            return None
        clamped_free = max(0, min(self.free_spots, self.total_spots))
        return round((1 - clamped_free / self.total_spots) * 100, 1)


@dataclass(frozen=True)
class ParkingDetail:
    """Static enrichment data from GTT (address, rates, payments, etc.)."""

    parking_id: int
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
    bus_lines: list[str] = field(default_factory=list)
    has_metro_access: bool = False
    payment_methods: list[str] = field(default_factory=list)
    cameras: int | None = None
    notes: str = ""
