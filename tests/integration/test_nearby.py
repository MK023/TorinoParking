"""Integration tests for nearby parkings geo-spatial endpoint."""

import pytest
import pytest_asyncio
from sqlalchemy import text


@pytest.fixture(autouse=True)
def _tables(_create_tables):
    """Ensure tables exist."""


@pytest_asyncio.fixture
async def _seed_parkings(db_session):
    """Insert parkings with PostGIS coordinates."""
    await db_session.execute(
        text(
            "INSERT INTO parkings (id, name, total_spots, lat, lng, location) VALUES "
            "(901, 'Centro', 100, 45.0703, 7.6869, ST_GeogFromText('SRID=4326;POINT(7.6869 45.0703)')), "
            "(902, 'Vicino', 80, 45.0710, 7.6875, ST_GeogFromText('SRID=4326;POINT(7.6875 45.0710)')), "
            "(903, 'Lontano', 60, 45.1200, 7.7500, ST_GeogFromText('SRID=4326;POINT(7.7500 45.1200)')) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_nearby_returns_close_parkings(client, _seed_parkings):
    resp = await client.get(
        "/api/v1/parkings/nearby?lat=45.0703&lng=7.6869&radius=500"
    )
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
async def test_nearby_empty_when_none_in_radius(client, _seed_parkings):
    resp = await client.get(
        "/api/v1/parkings/nearby?lat=40.0&lng=10.0&radius=100"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["parkings"] == []
