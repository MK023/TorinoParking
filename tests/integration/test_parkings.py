"""Integration tests for parking API endpoints with real Redis."""

import pytest

from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY
from app.infrastructure.serialization import serialize


@pytest.mark.asyncio
async def test_get_parkings_from_cache(client):
    """Pre-populate Redis cache and verify the API serves the data."""
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        cache_data = {
            "total": 1,
            "last_update": "2026-01-01T00:00:00+00:00",
            "source": "test",
            "parkings": [
                {
                    "id": 99,
                    "name": "Test Parking",
                    "status": 1,
                    "total_spots": 50,
                    "free_spots": 25,
                    "tendence": 0,
                    "lat": 45.07,
                    "lng": 7.68,
                    "status_label": "aperto",
                    "is_available": True,
                    "occupancy_percentage": 50.0,
                    "detail": None,
                }
            ],
        }
        serialized = serialize(cache_data, compress=False)
        await pool.set(PARKINGS_CACHE_KEY, serialized, ex=60)

        resp = await client.get("/api/v1/parkings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["parkings"][0]["id"] == 99
        assert body["parkings"][0]["name"] == "Test Parking"
        assert body["parkings"][0]["status_label"] == "aperto"
    finally:
        await pool.delete(PARKINGS_CACHE_KEY)
        await pool.close()


@pytest.mark.asyncio
async def test_get_single_parking(client):
    """Verify single-parking lookup from cached data."""
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        cache_data = {
            "total": 2,
            "last_update": "2026-01-01T00:00:00+00:00",
            "source": "test",
            "parkings": [
                {
                    "id": 1,
                    "name": "P1",
                    "status": 1,
                    "total_spots": 100,
                    "free_spots": 50,
                    "tendence": 0,
                    "lat": 45.07,
                    "lng": 7.68,
                    "status_label": "aperto",
                    "is_available": True,
                    "occupancy_percentage": 50.0,
                    "detail": {
                        "address": "Via Test 1",
                        "district": "Circoscrizione 1",
                        "operator": "GTT",
                        "hourly_rate_daytime": 1.00,
                        "payment_methods": ["carte", "Telepass"],
                    },
                },
                {
                    "id": 2,
                    "name": "P2",
                    "status": 0,
                    "total_spots": 40,
                    "free_spots": 0,
                    "tendence": None,
                    "lat": 45.08,
                    "lng": 7.69,
                    "status_label": "fuori servizio",
                    "is_available": False,
                    "occupancy_percentage": 100.0,
                    "detail": None,
                },
            ],
        }
        serialized = serialize(cache_data, compress=False)
        await pool.set(PARKINGS_CACHE_KEY, serialized, ex=60)

        resp = await client.get("/api/v1/parkings/1")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "P1"
        assert body["detail"]["address"] == "Via Test 1"
        assert "Telepass" in body["detail"]["payment_methods"]

        resp_2 = await client.get("/api/v1/parkings/2")
        assert resp_2.status_code == 200
        assert resp_2.json()["status_label"] == "fuori servizio"

        resp_404 = await client.get("/api/v1/parkings/999")
        assert resp_404.status_code == 404
    finally:
        await pool.delete(PARKINGS_CACHE_KEY)
        await pool.close()
