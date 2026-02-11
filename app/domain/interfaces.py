"""Protocol definitions establishing contracts between architectural layers.

Infrastructure implementations must structurally conform to these protocols.
No registration or base class inheritance is required — Python's structural
subtyping handles conformance checks at type-checking time.
"""

from __future__ import annotations

from typing import Protocol

from app.domain.models import Parking


class ParkingRepository(Protocol):
    async def fetch_all(self) -> list[Parking]: ...


class CacheService(Protocol):
    async def get(self, key: str) -> dict | None: ...
    async def set(self, key: str, value: dict, ttl: int | None = None) -> None: ...
    async def set_with_etag(self, key: str, value: dict, ttl: int | None = None) -> str: ...
    async def get_etag(self, key: str) -> str | None: ...
    async def delete(self, key: str) -> None: ...
    async def ping(self) -> bool: ...
