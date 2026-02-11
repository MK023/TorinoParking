"""Unit tests for ParkingXMLParser."""

import pytest

from app.domain.exceptions import FiveTApiError
from app.infrastructure.parser import ParkingXMLParser

MULTI_ENTRY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="1" Name="Parcheggio A" status="1" Total="100" Free="42"
           tendence="1" lat="45.07" lng="7.68"/>
  <PK_data ID="2" Name="Parcheggio B" status="0" Total="50" Free="0"
           tendence="0" lat="45.08" lng="7.69"/>
</traffic_data>
"""

SINGLE_ENTRY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="10" Name="Solo" status="1" Total="200" Free="150"
           tendence="-1" lat="45.10" lng="7.70"/>
</traffic_data>
"""

MALFORMED_XML = "<not>valid</xml>"

ENTRY_WITH_INVALID_DATA_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="abc" Name="Bad" status="1" Total="100" Free="10"
           lat="45.0" lng="7.0"/>
  <PK_data ID="3" Name="Good" status="1" Total="80" Free="20"
           tendence="1" lat="45.09" lng="7.71"/>
</traffic_data>
"""


class TestParkingXMLParser:
    def test_parse_multi_entry(self):
        parkings = ParkingXMLParser.parse_response(MULTI_ENTRY_XML)
        assert len(parkings) == 2
        assert parkings[0].id == 1
        assert parkings[0].name == "Parcheggio A"
        assert parkings[0].free_spots == 42
        assert parkings[1].id == 2
        assert parkings[1].status == 0

    def test_parse_single_entry(self):
        parkings = ParkingXMLParser.parse_response(SINGLE_ENTRY_XML)
        assert len(parkings) == 1
        assert parkings[0].id == 10
        assert parkings[0].name == "Solo"
        assert parkings[0].total_spots == 200
        assert parkings[0].tendence == -1

    def test_parse_malformed_raises(self):
        with pytest.raises(FiveTApiError, match="Unexpected 5T XML format"):
            ParkingXMLParser.parse_response(MALFORMED_XML)

    def test_parse_invalid_entry_skipped(self):
        parkings = ParkingXMLParser.parse_response(ENTRY_WITH_INVALID_DATA_XML)
        assert len(parkings) == 1
        assert parkings[0].id == 3
        assert parkings[0].name == "Good"

    def test_parse_entry_none_on_missing_fields(self):
        result = ParkingXMLParser.parse_entry({"@Name": "No ID"})
        assert result is None

    def test_free_spots_clamped_to_zero(self):
        entry = {
            "@ID": "5",
            "@Name": "Neg",
            "@status": "1",
            "@Total": "100",
            "@Free": "-5",
            "@lat": "45.0",
            "@lng": "7.0",
        }
        p = ParkingXMLParser.parse_entry(entry)
        assert p is not None
        assert p.free_spots == 0
