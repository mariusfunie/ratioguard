from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.core.database import get_db, SettingsModel
from app.models.schemas import AppSettingsUpdate
from app.core.scheduler import reschedule
import httpx

router = APIRouter()


def _to_dict(s: SettingsModel) -> dict:
    return {c.name: getattr(s, c.name) for c in s.__table__.columns}


@router.get("")
async def get_settings():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Settings not found")
        return _to_dict(s)


@router.patch("")
async def update_settings(body: AppSettingsUpdate):
    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Settings not found")
        for k, v in body.model_dump().items():
            if v is not None:
                setattr(s, k, v)
        await session.commit()
        if body.check_interval_hours:
            await reschedule(body.check_interval_hours)
        return _to_dict(s)


@router.post("/test-discord")
async def test_discord():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        s = result.scalar_one_or_none()
        webhook = s.discord_webhook_url if s else ""
    if not webhook:
        raise HTTPException(400, "Discord webhook URL not configured")
    payload = {"embeds": [{"title": "RatioGuard - Test", "description": "Discord integration working.", "color": 0x00E5C0}]}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(webhook, json=payload)
    if r.status_code not in (200, 204):
        raise HTTPException(502, f"Discord returned {r.status_code}")
    return {"message": "Test notification sent"}
