from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from app.core.database import get_db, TrackerModel, SettingsModel
from app.services.prowlarr import get_prowlarr_indexers, sync_priorities_to_prowlarr, get_prowlarr_status

router = APIRouter()


class AssignProwlarrId(BaseModel):
    tracker_id: str
    prowlarr_id: int


@router.get("/indexers")
async def list_prowlarr_indexers():
    db = await get_db()
    async with db as session:
        s_result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        s = s_result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Settings not found")
        if not s.prowlarr_url or not s.prowlarr_api_key:
            raise HTTPException(400, "Prowlarr URL and API key required in Settings")
        try:
            indexers = await get_prowlarr_indexers(s.prowlarr_url, s.prowlarr_api_key)
        except Exception as e:
            raise HTTPException(502, f"Prowlarr error: {e}")

        t_result = await session.execute(select(TrackerModel))
        trackers = t_result.scalars().all()
        tracker_map = {t.prowlarr_id: {"tracker_id": t.id, "tracker_name": t.name, "current_ratio": t.current_ratio, "status": t.status} for t in trackers if t.prowlarr_id}

    result = []
    for idx in indexers:
        pid = idx.get("id")
        result.append({
            "id": pid, "name": idx.get("name"), "protocol": idx.get("protocol"),
            "privacy": idx.get("privacy"), "enable": idx.get("enable"),
            "priority": idx.get("priority"), "infoLink": idx.get("infoLink"),
            "linked": tracker_map.get(pid),
        })
    return result


@router.get("/trackers-unlinked")
async def unlinked_trackers():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.prowlarr_id == None))
        trackers = result.scalars().all()
        return [{"id": t.id, "name": t.name, "current_ratio": t.current_ratio, "status": t.status} for t in trackers]


@router.post("/assign")
async def assign_prowlarr_id(body: AssignProwlarrId):
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == body.tracker_id))
        tracker = result.scalar_one_or_none()
        if not tracker:
            raise HTTPException(404, "Tracker not found")
        tracker.prowlarr_id = body.prowlarr_id
        await session.commit()
    return {"ok": True}


@router.delete("/assign/{tracker_id}")
async def unassign_prowlarr_id(tracker_id: str):
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == tracker_id))
        tracker = result.scalar_one_or_none()
        if tracker:
            tracker.prowlarr_id = None
            await session.commit()
    return {"ok": True}


@router.post("/sync-priorities")
async def sync_priorities():
    result = await sync_priorities_to_prowlarr()
    return result


@router.get("/status")
async def prowlarr_status():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        s = result.scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Settings not found")
    return await get_prowlarr_status(s.prowlarr_url, s.prowlarr_api_key)
