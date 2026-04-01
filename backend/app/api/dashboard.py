from fastapi import APIRouter, Query
from sqlalchemy import select, desc, func
from app.core.database import get_db, TrackerModel, RatioHistoryModel
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/stats")
async def dashboard_stats():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel))
        trackers = result.scalars().all()
        total = len(trackers)
        healthy = sum(1 for t in trackers if t.status != "error" and t.current_ratio is not None and t.current_ratio >= t.threshold)
        warning = sum(1 for t in trackers if t.status != "error" and t.current_ratio is not None and t.current_ratio < t.threshold)
        error = sum(1 for t in trackers if t.status == "error")
        return {"total": total, "healthy": healthy, "warning": warning, "error": error}


@router.get("/ratio-history/{tracker_id}")
async def ratio_history(tracker_id: str, days: int = Query(30, le=90)):
    db = await get_db()
    async with db as session:
        since = datetime.utcnow() - timedelta(days=days)
        result = await session.execute(
            select(RatioHistoryModel)
            .where(RatioHistoryModel.tracker_id == tracker_id)
            .where(RatioHistoryModel.recorded_at >= since)
            .order_by(RatioHistoryModel.recorded_at)
        )
        rows = result.scalars().all()
        return [{"tracker_id": r.tracker_id, "ratio": r.ratio, "upload": r.upload, "download": r.download, "recorded_at": r.recorded_at} for r in rows]
