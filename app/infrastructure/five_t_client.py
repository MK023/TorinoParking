"""Async HTTP client for the 5T Torino Open Data parking API.

Implements the ParkingRepository protocol by fetching real-time XML data
from the 5T endpoint, delegating parsing to ParkingXMLParser, and
returning a list of domain Parking entities.
"""

import httpx
import structlog

from app.domain.exceptions import FiveTApiError
from app.domain.models import Parking
from app.infrastructure.parser import ParkingXMLParser

logger = structlog.get_logger()


class FiveTClient:
    def __init__(self, client: httpx.AsyncClient, url: str, timeout: int = 10) -> None:
        self._client = client
        self._url = url
        self._timeout = timeout
        self._parser = ParkingXMLParser()

    async def fetch_all(self) -> list[Parking]:
        logger.info("five_t_fetch_start", url=self._url)
        try:
            response = await self._client.get(self._url, timeout=self._timeout)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise FiveTApiError(f"5T API request failed: {e}") from e

        parkings = self._parser.parse_response(response.text)
        logger.info("five_t_fetch_done", count=len(parkings))
        return parkings
