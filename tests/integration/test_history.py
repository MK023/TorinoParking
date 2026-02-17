"""Integration tests for parking history endpoint."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import insert, text

from app.infrastructure.db_models import ParkingSnapshot


@pytest.fixture(autouse=True)
def _tables(_create_tables):
    """Ensure tables exist."""


@pytest_asyncio.fixture
async def _seed_history(db_session):
    """Insert a parking and some snapshots for testing."""
    await db_session.execute(
        text(
            "INSERT INTO parkings (id, name, total_spots, lat, lng) "
            "VALUES (999, 'Test Parking', 100, 45.07, 7.68) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )
    now = datetime.now(timezone.utc)
    rows = [
        {
            "parking_id": 999,
            "free_spots": 50 - i * 5,
            "total_spots": 100,
            "status": 1,
            "tendence": 1,
            "recorded_at": now.replace(hour=max(0, now.hour - i)),
        }
        for i in range(5)
    ]
    await db_session.execute(insert(ParkingSnapshot), rows)
    await db_session.commit()


@pytest.mark.asyncio
async def test_history_returns_snapshots(client, _seed_history):
    resp = await client.get("/api/v1/parkings/999/history?hours=24")
    assert resp.status_code == 200
    body = resp.json()
    assert body["parking_id"] == 999
    assert body["total_snapshots"] >= 1
    assert len(body["snapshots"]) >= 1
    snap = body["snapshots"][0]
    assert "free_spots" in snap
    assert "total_spots" in snap
    assert "recorded_at" in snap


@pytest.mark.asyncio
async def test_history_empty_for_unknown_parking(client):
    resp = await client.get("/api/v1/parkings/99999/history")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_snapshots"] == 0
    assert body["snapshots"] == []
