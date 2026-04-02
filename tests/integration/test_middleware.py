"""Integration tests for HTTP middleware stack."""

import pytest


@pytest.mark.asyncio
async def test_request_id_generated(client):
    """RequestIDMiddleware should add X-Request-ID to responses."""
    resp = await client.get("/health")
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


@pytest.mark.asyncio
async def test_request_id_propagated(client):
    """RequestIDMiddleware should echo back a valid client-provided ID."""
    resp = await client.get("/health", headers={"X-Request-ID": "test-req-123"})
    assert resp.headers["x-request-id"] == "test-req-123"


@pytest.mark.asyncio
async def test_request_id_invalid_replaced(client):
    """RequestIDMiddleware should replace invalid IDs (e.g. with spaces)."""
    resp = await client.get("/health", headers={"X-Request-ID": "has spaces!"})
    assert resp.headers["x-request-id"] != "has spaces!"


@pytest.mark.asyncio
async def test_security_headers_present(client):
    """SecurityHeadersMiddleware should set all required headers."""
    resp = await client.get("/health")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "strict-transport-security" in resp.headers
    assert "content-security-policy" in resp.headers


@pytest.mark.asyncio
async def test_hsts_header_value(client):
    """HSTS should have a long max-age and include subdomains."""
    resp = await client.get("/health")
    hsts = resp.headers["strict-transport-security"]
    assert "max-age=" in hsts
    assert "includeSubDomains" in hsts


@pytest.mark.asyncio
async def test_csp_allows_mapbox(client):
    """CSP should whitelist Mapbox for images and connections."""
    resp = await client.get("/health")
    csp = resp.headers["content-security-policy"]
    assert "api.mapbox.com" in csp


@pytest.mark.asyncio
async def test_rate_limit_headers_on_api(client):
    """RateLimitMiddleware should add rate limit headers on API routes."""
    resp = await client.get("/api/v1/parkings")
    assert "x-ratelimit-limit" in resp.headers
    assert "x-ratelimit-remaining" in resp.headers
    assert "x-ratelimit-reset" in resp.headers


@pytest.mark.asyncio
async def test_rate_limit_skips_health(client):
    """RateLimitMiddleware should skip /health."""
    resp = await client.get("/health")
    assert "x-ratelimit-limit" not in resp.headers


@pytest.mark.asyncio
async def test_geolocation_allowed_in_permissions_policy(client):
    """Permissions-Policy should allow geolocation for the app."""
    resp = await client.get("/health")
    pp = resp.headers["permissions-policy"]
    assert "geolocation=(self)" in pp
