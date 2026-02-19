"""Unit tests for production config validators."""

import os
from unittest.mock import patch

import pytest


class TestProductionValidators:
    """Ensure Settings enforces strong secrets in non-dev environments."""

    def _make_settings(self, **overrides):
        """Create a fresh Settings instance with given env overrides."""
        env = {
            "ENVIRONMENT": "production",
            "DATABASE_URL": "postgresql+asyncpg://u:p@db:5432/d",
            "REDIS_URL": "redis://redis:6379/0",
            "ADMIN_API_KEY": "a" * 32,
            "HMAC_SALT": "b" * 16,
            **overrides,
        }
        with patch.dict(os.environ, env, clear=False):
            from app.config import Settings

            return Settings()

    def test_production_rejects_short_admin_key(self):
        with pytest.raises(ValueError, match="ADMIN_API_KEY"):
            self._make_settings(ADMIN_API_KEY="short")

    def test_production_rejects_empty_hmac_salt(self):
        with pytest.raises(ValueError, match="HMAC_SALT"):
            self._make_settings(HMAC_SALT="")

    def test_production_accepts_strong_secrets(self):
        s = self._make_settings()
        assert s.environment == "production"
        assert len(s.admin_api_key) >= 32
        assert len(s.hmac_salt) >= 16

    def test_dev_allows_weak_secrets(self):
        s = self._make_settings(ENVIRONMENT="development", ADMIN_API_KEY="", HMAC_SALT="")
        assert s.environment == "development"

    def test_test_allows_weak_secrets(self):
        s = self._make_settings(ENVIRONMENT="test", ADMIN_API_KEY="weak", HMAC_SALT="")
        assert s.environment == "test"

    def test_cors_origins_from_json_string(self):
        s = self._make_settings(CORS_ORIGINS='["http://a.com","http://b.com"]')
        assert s.cors_origins == ["http://a.com", "http://b.com"]
