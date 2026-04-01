from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from app.core.database import get_db, NotificationModel

router = APIRouter()


def _to_dict(n: NotificationModel) -> dict:
    return {c.name: getattr(n, c.name) for c in n.__table__.columns}


@router.get("")
async def list_notifications(limit: int = Query(50, le=200)):
    db = await get_db()
    async with db as session:
        result = await session.execute(
            select(NotificationModel).order_by(desc(NotificationModel.sent_at)).limit(limit)
        )
        return [_to_dict(n) for n in result.scalars().all()]
