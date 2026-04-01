from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from app.core.database import get_db, TrackerModel, SettingsModel
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter()


@router.get("/export")
async def export_backup():
    """Exporta toate trackerele (fara parole/cookies) ca JSON."""
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel))
        trackers = result.scalars().all()

        s_result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        settings = s_result.scalar_one_or_none()

    export = {
        "version": "1.0",
        "trackers": [
            {
                "name": t.name,
                "auth_type": t.auth_type,
                "threshold": t.threshold,
                "enabled": t.enabled,
                "profile_url": t.profile_url,
                "login_url": t.login_url,
                "username": t.username,
                "api_url": t.api_url,
                "prowlarr_id": t.prowlarr_id,
                # excludem: password, api_key, manual_cookies, session_cookies
            }
            for t in trackers
        ],
        "settings": {
            "check_interval_hours": settings.check_interval_hours if settings else 24,
            "notifications_enabled": settings.notifications_enabled if settings else True,
            "prowlarr_url": settings.prowlarr_url if settings else "",
            "transmission_url": settings.transmission_url if settings else "",
            "transmission_user": settings.transmission_user if settings else "",
            # excludem: parole, api keys, webhook
        }
    }
    return export


class TrackerImport(BaseModel):
    name: str
    auth_type: str
    threshold: float = 1.0
    enabled: bool = True
    profile_url: Optional[str] = None
    login_url: Optional[str] = None
    username: Optional[str] = None
    api_url: Optional[str] = None
    prowlarr_id: Optional[int] = None


class BackupImport(BaseModel):
    version: str = "1.0"
    trackers: List[TrackerImport] = []


@router.post("/import")
async def import_backup(body: BackupImport):
    """Importa trackerele din backup. Nu suprascrie trackerele existente cu acelasi nume."""
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel))
        existing_names = {t.name.lower() for t in result.scalars().all()}

        added = 0
        skipped = 0

        for t in body.trackers:
            if t.name.lower() in existing_names:
                skipped += 1
                continue
            session.add(TrackerModel(
                id=str(uuid.uuid4()),
                name=t.name,
                auth_type=t.auth_type,
                threshold=t.threshold,
                enabled=t.enabled,
                profile_url=t.profile_url,
                login_url=t.login_url,
                username=t.username,
                api_url=t.api_url,
                prowlarr_id=t.prowlarr_id,
                status="unknown",
            ))
            added += 1

        await session.commit()
        return {"added": added, "skipped": skipped}
