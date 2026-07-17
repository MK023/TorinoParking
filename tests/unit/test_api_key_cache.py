"""Unit tests for the in-memory API key cache failure path."""

import time
from unittest.mock import patch

import pytest

from app.infrastructure import api_key_cache
from app.infrastructure.api_key_service import hash_api_key


@pytest.mark.asyncio
async def test_lookup_serves_stale_cache_when_db_down():
    """Regression: DB transitoriamente giù → si serve la cache stale.

    Prima del fix l'errore del refresh propagava fino al middleware e ogni
    richiesta con X-API-Key falliva con 500, pur avendo in memoria le chiavi
    valide di 60 secondi prima. Il backoff evita che ogni richiesta in coda
    ripaghi il timeout DB.
    """
    api_key_cache.clear()
    api_key_cache._cache = {hash_api_key("tp_test-key"): "free"}
    # Cache scaduta: ensure_fresh proverà il refresh dal DB
    api_key_cache._last_refresh = time.monotonic() - api_key_cache.TTL_SECONDS - 1

    def _db_down():
        raise ConnectionError("db down")

    try:
        with patch.object(api_key_cache, "async_session_factory", side_effect=_db_down) as factory:
            assert await api_key_cache.lookup("tp_test-key") == "free"
            assert await api_key_cache.lookup("tp_test-key") == "free"
            # Backoff: il secondo lookup non deve ritentare subito il DB
            assert factory.call_count == 1
    finally:
        api_key_cache.clear()
