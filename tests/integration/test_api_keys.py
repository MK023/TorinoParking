"""Integration tests for admin API key CRUD."""

import pytest


ADMIN_HEADERS = {"X-Admin-Key": "test-admin-key-that-is-long-enough-32ch"}


@pytest.mark.asyncio
async def test_create_api_key(client):
    resp = await client.post(
        "/api/v1/admin/keys",
        json={"name": "test-key"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "test-key"
    assert body["tier"] == "authenticated"
    assert body["is_active"] is True
    assert body["raw_key"].startswith("tp_")


@pytest.mark.asyncio
async def test_list_api_keys(client):
    # Create a key first
    await client.post(
        "/api/v1/admin/keys",
        json={"name": "list-test"},
        headers=ADMIN_HEADERS,
    )

    resp = await client.get("/api/v1/admin/keys", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    keys = resp.json()
    assert isinstance(keys, list)
    assert any(k["name"] == "list-test" for k in keys)


@pytest.mark.asyncio
async def test_revoke_api_key(client):
    # Create
    create_resp = await client.post(
        "/api/v1/admin/keys",
        json={"name": "revoke-test"},
        headers=ADMIN_HEADERS,
    )
    key_id = create_resp.json()["id"]

    # Revoke
    resp = await client.delete(
        f"/api/v1/admin/keys/{key_id}",
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"

    # Verify revoked
    list_resp = await client.get("/api/v1/admin/keys", headers=ADMIN_HEADERS)
    revoked = [k for k in list_resp.json() if k["id"] == key_id]
    assert revoked[0]["is_active"] is False


@pytest.mark.asyncio
async def test_admin_requires_key(client):
    resp = await client.get("/api/v1/admin/keys")
    assert resp.status_code == 422  # missing required header


@pytest.mark.asyncio
async def test_admin_rejects_bad_key(client):
    resp = await client.get(
        "/api/v1/admin/keys",
        headers={"X-Admin-Key": "wrong-key"},
    )
    assert resp.status_code == 403
