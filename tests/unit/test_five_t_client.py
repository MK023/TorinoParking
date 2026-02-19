"""Unit tests for FiveTClient with mocked HTTP."""

import httpx
import pytest
import respx
from httpx import Response

from app.domain.exceptions import FiveTApiError
from app.infrastructure.five_t_client import FiveTClient

MOCK_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="1" Name="Test" status="1" Total="100" Free="50"
           tendence="1" lat="45.0" lng="7.6"/>
</traffic_data>
"""


class TestFiveTClient:
    @pytest.mark.asyncio
    async def test_fetch_all_success(self):
        url = "https://mock-5t.test/get_pk"
        async with httpx.AsyncClient() as http:
            with respx.mock:
                respx.get(url).mock(return_value=Response(200, text=MOCK_XML))
                client = FiveTClient(client=http, url=url, timeout=5)
                parkings = await client.fetch_all()

        assert len(parkings) == 1
        assert parkings[0].name == "Test"
        assert parkings[0].free_spots == 50

    @pytest.mark.asyncio
    async def test_fetch_all_http_error(self):
        url = "https://mock-5t.test/get_pk"
        async with httpx.AsyncClient() as http:
            with respx.mock:
                respx.get(url).mock(return_value=Response(500))
                client = FiveTClient(client=http, url=url, timeout=5)

                with pytest.raises(FiveTApiError, match="5T API request failed"):
                    await client.fetch_all()

    @pytest.mark.asyncio
    async def test_fetch_all_connection_error(self):
        url = "https://mock-5t.test/get_pk"
        async with httpx.AsyncClient() as http:
            with respx.mock:
                respx.get(url).mock(side_effect=httpx.ConnectError("refused"))
                client = FiveTClient(client=http, url=url, timeout=5)

                with pytest.raises(FiveTApiError):
                    await client.fetch_all()
