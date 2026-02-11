"""Domain-level exceptions decoupled from HTTP status codes.

These exceptions represent business-rule violations and infrastructure
failures. The API layer is responsible for translating them into
appropriate HTTP responses.
"""


class FiveTApiError(Exception):
    """Raised when communication with the 5T API fails."""


class ParkingNotFoundError(Exception):
    """Raised when a requested parking does not exist."""

    def __init__(self, parking_id: int) -> None:
        self.parking_id = parking_id
        super().__init__(f"Parking {parking_id} not found")
