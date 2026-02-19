"""Centralized configuration loaded from environment variables via Doppler.

All runtime parameters are defined as typed Pydantic fields with sensible
defaults. In production, values are injected by the Doppler secrets manager.
The module exports a cached singleton accessible as ``settings``.
"""

import json
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Parking Torino API"
    version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    log_dir: str = "logs"
    log_max_bytes: int = 10_485_760
    log_backup_count: int = 5

    database_url: str = "postgresql+asyncpg://parking:parking@postgres:5432/parking"

    redis_url: str = "redis://redis:6379/0"
    redis_max_connections: int = 20
    redis_socket_timeout: float = 5.0
    redis_socket_connect_timeout: float = 2.0
    redis_retry_on_timeout: bool = True
    redis_key_prefix: str = "parking:"

    admin_api_key: str = ""

    hmac_salt: str = ""

    five_t_api_url: str = "https://opendata.5t.torino.it/get_pk"
    five_t_timeout: int = 10

    cache_ttl: int = 120
    cache_compression: bool = True
    cache_compression_threshold: int = 512

    rate_limit_anonymous: int = 20
    rate_limit_authenticated: int = 100
    rate_limit_premium: int = 1000

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v

    sentry_dsn: str = ""

    httpx_max_connections: int = 20
    httpx_max_keepalive: int = 10
    httpx_keepalive_expiry: float = 30.0

    snapshot_retention_days: int = 30

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
