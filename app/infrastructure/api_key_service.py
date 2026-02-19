"""API key lifecycle management with SHA-256 HMAC hashing.

Raw keys are shown once at creation time and never stored.  Only the
HMAC-SHA256 digest (with a static application-level salt) is persisted
in PostgreSQL.
"""

import hmac
import secrets
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.db_models import ApiKeyEntity


def hash_api_key(raw_key: str) -> str:
    """Derive a hex SHA-256 HMAC from *raw_key* using a configurable salt."""
    return hmac.digest(settings.hmac_salt.encode(), raw_key.encode(), "sha256").hex()


def generate_raw_key() -> str:
    """Return a new raw API key with ``tp_`` prefix."""
    return f"tp_{secrets.token_urlsafe(32)}"


class ApiKeyService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_key(self, name: str, tier: str = "authenticated") -> tuple[str, ApiKeyEntity]:
        """Create a new API key.  Returns ``(raw_key, entity)``."""
        raw_key = generate_raw_key()
        entity = ApiKeyEntity(
            key_hash=hash_api_key(raw_key),
            name=name,
            tier=tier,
        )
        self._session.add(entity)
        await self._session.commit()
        await self._session.refresh(entity)
        return raw_key, entity

    async def verify_key(self, raw_key: str) -> ApiKeyEntity | None:
        """Look up a key by its hash and bump *last_used_at*."""
        key_hash = hash_api_key(raw_key)
        result = await self._session.execute(
            select(ApiKeyEntity).where(
                ApiKeyEntity.key_hash == key_hash,
                ApiKeyEntity.is_active.is_(True),
            )
        )
        entity = result.scalar_one_or_none()
        if entity is not None:
            await self._session.execute(
                update(ApiKeyEntity)
                .where(ApiKeyEntity.id == entity.id)
                .values(last_used_at=datetime.now(timezone.utc))
            )
            await self._session.commit()
        return entity

    async def list_keys(self) -> list[ApiKeyEntity]:
        """Return all API keys (active and revoked)."""
        result = await self._session.execute(
            select(ApiKeyEntity).order_by(ApiKeyEntity.created_at.desc())
        )
        return list(result.scalars().all())

    async def revoke_key(self, key_id: int) -> bool:
        """Deactivate a key.  Returns *True* if found."""
        result = await self._session.execute(
            update(ApiKeyEntity).where(ApiKeyEntity.id == key_id).values(is_active=False)
        )
        await self._session.commit()
        return result.rowcount > 0
