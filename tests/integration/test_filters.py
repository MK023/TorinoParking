"""Integration tests for parking list filters."""

import pytest
import pytest_asyncio
import respx
from httpx import Response

from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY

MOCK_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="1" Name="Pieno" status="1" Total="100" Free="0"
           tendence="0" lat="45.07" lng="7.68"/>
  <PK_data ID="2" Name="Pochi posti" status="1" Total="100" Free="3"
           tendence="1" lat="45.08" lng="7.69"/>
  <PK_data ID="3" Name="Libero" status="1" Total="100" Free="50"
           tendence="1" lat="45.09" lng="7.70"/>
  <PK_data ID="4" Name="Chiuso" status="0" Total="100" Free="0"
           tendence="0" lat="45.10" lng="7.71"/>
</traffic_data>
"""


@pytest.fixture(autouse=True)
def _tables(_create_tables):
    pass


@pytest_asyncio.fixture
async def _populate_cache(client):
    """Run scheduler to populate cache with mock data."""
    from app.config import settings
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        await pool.delete(PARKINGS_CACHE_KEY)
        with respx.mock:
            respx.get(settings.five_t_api_url).mock(
                return_value=Response(200, text=MOCK_XML)
            )
            from app.scheduler import fetch_parking_data

            await fetch_parking_data(
                http_client=client._transport.app.state.http_client,
                redis_pool=pool,
            )
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_filter_available_only(client, _populate_cache):
    resp = await client.get("/api/v1/parkings?available=true")
    assert resp.status_code == 200
    body = resp.json()
    for p in body["parkings"]:
        assert p["is_available"] is True
    names = [p["name"] for p in body["parkings"]]
    assert "Pieno" not in names
    assert "Chiuso" not in names


@pytest.mark.asyncio
async def test_filter_min_spots(client, _populate_cache):
    resp = await client.get("/api/v1/parkings?min_spots=10")
    assert resp.status_code == 200
    body = resp.json()
    for p in body["parkings"]:
        assert p["free_spots"] is not None
        assert p["free_spots"] >= 10


@pytest.mark.asyncio
async def test_no_filter_returns_all(client, _populate_cache):
    resp = await client.get("/api/v1/parkings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
