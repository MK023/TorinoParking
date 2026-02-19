"""End-to-end test: 5T fetch → Redis cache → API response.

The external 5T API is mocked with *respx* so the test exercises the
full pipeline without network access.
"""

import pytest
import respx
from httpx import Response

from app.infrastructure.redis_cache import PARKINGS_CACHE_KEY

MOCK_5T_XML = """<?xml version="1.0" encoding="UTF-8"?>
<traffic_data>
  <PK_data ID="1" Name="Lingotto" status="1" Total="500" Free="123"
           tendence="1" lat="45.0312" lng="7.6654"/>
  <PK_data ID="2" Name="Porta Nuova" status="1" Total="300" Free="80"
           tendence="0" lat="45.0622" lng="7.6782"/>
</traffic_data>
"""


@pytest.mark.asyncio
async def test_full_fetch_to_api_flow(client, _create_tables):
    """Mock 5T XML → fetch_parking_data → Redis → API serves data."""
    from app.config import settings
    from app.infrastructure.redis_cache import create_redis_pool

    pool = create_redis_pool()
    try:
        # Clear any pre-existing cache
        await pool.delete(PARKINGS_CACHE_KEY)

        # Mock the external 5T API
        with respx.mock:
            respx.get(settings.five_t_api_url).mock(return_value=Response(200, text=MOCK_5T_XML))

            # Run the scheduler job directly
            from app.scheduler import fetch_parking_data

            await fetch_parking_data(
                http_client=client._transport.app.state.http_client,  # type: ignore[attr-defined]
                redis_pool=pool,
            )

        # Verify cache was populated
        cached = await pool.get(PARKINGS_CACHE_KEY)
        assert cached is not None

        # Populate the app's Redis for the API call
        from app.infrastructure.serialization import deserialize

        data = deserialize(cached)
        assert data["total"] == 2
        assert data["parkings"][0]["name"] == "Lingotto"
        assert data["parkings"][0]["status_label"] == "aperto"

        # Now the API should serve data from the cache we just populated
        resp = await client.get("/api/v1/parkings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert any(p["name"] == "Lingotto" for p in body["parkings"])
        assert any(p["name"] == "Porta Nuova" for p in body["parkings"])

        # Single parking lookup
        resp_single = await client.get("/api/v1/parkings/1")
        assert resp_single.status_code == 200
        single = resp_single.json()
        assert single["name"] == "Lingotto"
        assert single["status_label"] == "aperto"

        # 404 for non-existent
        resp_404 = await client.get("/api/v1/parkings/999")
        assert resp_404.status_code == 404

    finally:
        await pool.delete(PARKINGS_CACHE_KEY)
        await pool.close()
