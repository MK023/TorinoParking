"""Integration tests for /health endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_returns_healthy(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["services"]["redis"] == "up"
    assert body["services"]["postgres"] == "up"
