from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy import select
from app.core.database import get_db, TrackerModel
from app.services.transmission import (
    get_torrents_with_priority, get_session_stats, get_recommendations,
    set_torrent_priority, start_torrents, stop_torrents,
    auto_set_priorities, reset_all_priorities
)

router = APIRouter()


@router.get("/torrents")
async def list_torrents(tracker: str = None):
    try:
        torrents = await get_torrents_with_priority()
        if tracker:
            torrents = [t for t in torrents if (t.get("tracker_name") or "").lower() == tracker.lower()]
        torrents.sort(key=lambda t: (t["status"] != "seeding", t["ratio"]))
        return torrents
    except Exception as e:
        raise HTTPException(502, f"Transmission error: {e}")


@router.get("/stats")
async def session_stats():
    try:
        return await get_session_stats()
    except Exception as e:
        raise HTTPException(502, f"Transmission error: {e}")


@router.get("/recommendations")
async def recommendations():
    try:
        db = await get_db()
        async with db as session:
            result = await session.execute(select(TrackerModel).where(TrackerModel.status == "online"))
            trackers = result.scalars().all()
            tracker_list = [{"name": t.name, "current_ratio": t.current_ratio, "threshold": t.threshold} for t in trackers]
        return await get_recommendations(tracker_list)
    except Exception as e:
        raise HTTPException(502, f"Error: {e}")


@router.post("/auto-priorities")
async def auto_priorities():
    """Seteaza automat prioritatile bazat pe ratio-urile din RatioGuard."""
    try:
        db = await get_db()
        async with db as session:
            result = await session.execute(select(TrackerModel).where(TrackerModel.status == "online"))
            trackers = result.scalars().all()
            tracker_list = [{"name": t.name, "current_ratio": t.current_ratio, "threshold": t.threshold} for t in trackers]
        return await auto_set_priorities(tracker_list)
    except Exception as e:
        raise HTTPException(502, f"Error: {e}")


@router.post("/reset-priorities")
async def reset_priorities():
    """Reseteaza toate torrentele la prioritate normala."""
    try:
        return await reset_all_priorities()
    except Exception as e:
        raise HTTPException(502, f"Transmission error: {e}")


class TorrentAction(BaseModel):
    ids: List[int]
    action: str


@router.post("/action")
async def torrent_action(body: TorrentAction):
    try:
        if body.action == "start":
            await start_torrents(body.ids)
        elif body.action == "stop":
            await stop_torrents(body.ids)
        elif body.action in ("priority_high", "priority_normal", "priority_low"):
            priority = body.action.replace("priority_", "")
            await set_torrent_priority(body.ids, priority)
        else:
            raise HTTPException(400, f"Unknown action: {body.action}")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(502, f"Transmission error: {e}")
