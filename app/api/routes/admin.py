"""Admin routes for API key management.

All endpoints require the ``X-Admin-Key`` header to match the
``ADMIN_API_KEY`` environment variable (constant-time comparison).
"""

import hmac
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session
from app.config import settings
from app.infrastructure.api_key_service import ApiKeyService

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _verify_admin(x_admin_key: str = Header(...)) -> None:
    if not settings.admin_api_key or not hmac.compare_digest(x_admin_key, settings.admin_api_key):
        raise HTTPException(status_code=403, detail="Invalid admin key")


class CreateKeyRequest(BaseModel):
    name: str = Field(..., max_length=100)
    tier: Literal["authenticated", "premium"] = "authenticated"


class KeyResponse(BaseModel):
    id: int
    name: str
    tier: str
    is_active: bool
    created_at: str
    last_used_at: str | None = None


class CreateKeyResponse(KeyResponse):
    raw_key: str


@router.post("/keys", response_model=CreateKeyResponse)
async def create_api_key(
    body: CreateKeyRequest,
    _: None = Depends(_verify_admin),
    db: AsyncSession = Depends(get_db_session),
) -> CreateKeyResponse:
    """Create a new API key. The raw key is returned once and never stored."""
    service = ApiKeyService(db)
    raw_key, entity = await service.create_key(body.name, body.tier)
    return CreateKeyResponse(
        id=entity.id,
        raw_key=raw_key,
        name=entity.name,
        tier=entity.tier,
        is_active=entity.is_active,
        created_at=entity.created_at.isoformat(),
        last_used_at=entity.last_used_at.isoformat() if entity.last_used_at else None,
    )


@router.get("/keys", response_model=list[KeyResponse])
async def list_api_keys(
    _: None = Depends(_verify_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[KeyResponse]:
    """List all API keys (without hashes)."""
    service = ApiKeyService(db)
    keys = await service.list_keys()
    return [
        KeyResponse(
            id=k.id,
            name=k.name,
            tier=k.tier,
            is_active=k.is_active,
            created_at=k.created_at.isoformat(),
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
        )
        for k in keys
    ]


@router.delete("/keys/{key_id}")
async def revoke_api_key(
    key_id: int,
    _: None = Depends(_verify_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Revoke an API key (set is_active=false)."""
    service = ApiKeyService(db)
    found = await service.revoke_key(key_id)
    if not found:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"status": "revoked", "key_id": key_id}
