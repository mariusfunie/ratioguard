from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.core.database import get_db, TrackerModel
from app.models.schemas import TrackerCreate, TrackerUpdate, TrackerOut
import uuid

router = APIRouter()


def _to_dict(t: TrackerModel) -> dict:
    return {c.name: getattr(t, c.name) for c in t.__table__.columns}


@router.get("", response_model=list[TrackerOut])
async def list_trackers():
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel))
        return [_to_dict(t) for t in result.scalars().all()]


@router.post("", response_model=TrackerOut, status_code=201)
async def create_tracker(body: TrackerCreate):
    db = await get_db()
    async with db as session:
        tracker = TrackerModel(id=str(uuid.uuid4()), **body.model_dump())
        session.add(tracker)
        await session.commit()
        return _to_dict(tracker)


@router.patch("/{tracker_id}", response_model=TrackerOut)
async def update_tracker(tracker_id: str, body: TrackerUpdate):
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == tracker_id))
        tracker = result.scalar_one_or_none()
        if not tracker:
            raise HTTPException(404, "Tracker not found")
        raw = body.model_dump()
        for k, v in raw.items():
            if v is not None or k == "prowlarr_priority":
                setattr(tracker, k, v)
        await session.commit()
        return _to_dict(tracker)


@router.delete("/{tracker_id}", status_code=204)
async def delete_tracker(tracker_id: str):
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == tracker_id))
        tracker = result.scalar_one_or_none()
        if not tracker:
            raise HTTPException(404, "Tracker not found")
        await session.delete(tracker)
        await session.commit()


@router.post("/{tracker_id}/check", response_model=TrackerOut)
async def check_one(tracker_id: str):
    from app.services.checker import check_tracker_by_id
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == tracker_id))
        tracker = result.scalar_one_or_none()
        if not tracker:
            raise HTTPException(404, "Tracker not found")
        updated = await check_tracker_by_id(tracker_id)
        return _to_dict(updated)


@router.post("/check-all")
async def check_all():
    from app.services.checker import check_all_trackers
    await check_all_trackers()
    return {"message": "All trackers checked"}
