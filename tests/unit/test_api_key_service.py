"""Unit tests for API key service hashing."""

from app.infrastructure.api_key_service import generate_raw_key, hash_api_key


class TestApiKeyHashing:
    def test_hash_is_deterministic(self):
        key = "tp_test_key_123"
        assert hash_api_key(key) == hash_api_key(key)

    def test_hash_is_hex_sha256(self):
        result = hash_api_key("tp_test_key_123")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_different_keys_different_hashes(self):
        h1 = hash_api_key("tp_key_one")
        h2 = hash_api_key("tp_key_two")
        assert h1 != h2

    def test_generate_raw_key_format(self):
        key = generate_raw_key()
        assert key.startswith("tp_")
        assert len(key) > 20
