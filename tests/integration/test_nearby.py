"""Integration tests for nearby parkings geo-spatial endpoint."""

import pytest
import pytest_asyncio
import respx
from httpx import Response
from sqlalchemy import text

MOCK_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="901" Name="Centro" status="1" Total="100" Free="42"
           tendence="1" lat="45.0703" lng="7.6869"/>
  <PK_data ID="902" Name="Vicino" status="1" Total="80" Free="5"
           tendence="0" lat="45.0710" lng="7.6875"/>
</traffic_data>
"""


@pytest.fixture(autouse=True)
def _tables(_create_tables):
    """Ensure tables exist."""


@pytest_asyncio.fixture
async def _seed_parkings(db_session):
    """Insert parkings with PostGIS coordinates."""
    await db_session.execute(
        text(
            "INSERT INTO parkings"
            " (id, name, total_spots, lat, lng, location) VALUES "
            "(901, 'Centro', 100, 45.0703, 7.6869,"
            " ST_GeogFromText('SRID=4326;POINT(7.6869 45.0703)')), "
            "(902, 'Vicino', 80, 45.0710, 7.6875,"
            " ST_GeogFromText('SRID=4326;POINT(7.6875 45.0710)')), "
            "(903, 'Lontano', 60, 45.1200, 7.7500,"
            " ST_GeogFromText('SRID=4326;POINT(7.7500 45.1200)')) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_nearby_returns_close_parkings(client, _seed_parkings):
    resp = await client.get("/api/v1/parkings/nearby?lat=45.0703&lng=7.6869&radius=500")
    assert resp.status_code == 200
    body = resp.json()
    ids = [p["id"] for p in body["parkings"]]
    assert 901 in ids
    assert 902 in ids
    assert 903 not in ids


@pytest.mark.asyncio
async def test_nearby_requires_lat_lng(client):
    resp = await client.get("/api/v1/parkings/nearby")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_nearby_merges_live_data_on_cold_cache(client, _seed_parkings):
    """Regression: con cache Redis fredda /nearby deve fare fallback sul feed
    5T live e servire free_spots/status reali, non degradare a "nessun dato"
    (bug: a _get_parkings_data veniva passato il repository PostGIS, privo di
    fetch_all, e l'AttributeError era ingoiato)."""
    from app.config import settings
    from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY, create_redis_pool

    pool = create_redis_pool()
    try:
        await pool.delete(PARKINGS_CACHE_KEY)
    finally:
        await pool.close()

    with respx.mock:
        respx.get(settings.five_t_api_url).mock(return_value=Response(200, text=MOCK_XML))
        resp = await client.get("/api/v1/parkings/nearby?lat=45.0703&lng=7.6869&radius=500")

    assert resp.status_code == 200
    by_id = {p["id"]: p for p in resp.json()["parkings"]}
    assert by_id[901]["free_spots"] == 42
    assert by_id[901]["is_available"] is True
    assert by_id[901]["status_label"] != "nessun dato"
    assert by_id[902]["free_spots"] == 5


@pytest.mark.asyncio
async def test_nearby_empty_when_none_in_radius(client, _seed_parkings):
    resp = await client.get("/api/v1/parkings/nearby?lat=40.0&lng=10.0&radius=100")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["parkings"] == []
