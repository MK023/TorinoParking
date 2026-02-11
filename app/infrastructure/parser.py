"""XML parser for the 5T Open Data parking feed.

Transforms raw XML responses from the 5T API into domain Parking entities.
Malformed entries are logged and silently skipped to ensure partial data
availability even when individual records are corrupt.
"""

import structlog
import xmltodict

from app.domain.exceptions import FiveTApiError
from app.domain.models import Parking

logger = structlog.get_logger()


class ParkingXMLParser:
    @staticmethod
    def parse_entry(pk: dict) -> Parking | None:
        try:
            return Parking(
                id=int(pk["@ID"]),
                name=pk["@Name"],
                status=int(pk.get("@status", 0)),
                total_spots=int(pk.get("@Total", 0)),
                free_spots=max(0, int(pk["@Free"])) if "@Free" in pk else None,
                tendence=int(pk["@tendence"]) if "@tendence" in pk else None,
                lat=float(pk["@lat"]),
                lng=float(pk["@lng"]),
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning("parse_parking_failed", error=str(e), raw_data=pk)
            return None

    @classmethod
    def parse_response(cls, xml_text: str) -> list[Parking]:
        try:
            data = xmltodict.parse(xml_text)
            pk_list = data["traffic_data"]["PK_data"]
        except (KeyError, Exception) as e:
            raise FiveTApiError(f"Unexpected 5T XML format: {e}") from e

        if isinstance(pk_list, dict):
            pk_list = [pk_list]

        return [p for pk in pk_list if (p := cls.parse_entry(pk)) is not None]
