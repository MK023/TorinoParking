"""Domain layer containing business entities, rules, and contracts.

This layer has zero dependencies on infrastructure, frameworks, or I/O.
All interfaces are defined as ``typing.Protocol`` classes, allowing the
infrastructure layer to satisfy contracts without inheritance coupling.
"""

from app.domain.exceptions import FiveTApiError, ParkingNotFoundError
from app.domain.interfaces import CacheService, ParkingRepository
from app.domain.models import Parking

__all__ = [
    "CacheService",
    "FiveTApiError",
    "Parking",
    "ParkingNotFoundError",
    "ParkingRepository",
]
