from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler()


async def start_scheduler():
    scheduler.add_job(
        run_all_checks,
        trigger=IntervalTrigger(hours=24),
        id="check_all_trackers",
        replace_existing=True,
    )
    scheduler.start()
    print("Scheduler started")


async def stop_scheduler():
    scheduler.shutdown(wait=False)


async def run_all_checks():
    from app.services.checker import check_all_trackers
    from app.core.database import get_db
    from app.core.database import SettingsModel
    from sqlalchemy import select

    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        app_settings = result.scalar_one_or_none()
        interval = app_settings.check_interval_hours if app_settings else 24

    scheduler.reschedule_job(
        "check_all_trackers",
        trigger=IntervalTrigger(hours=interval),
    )
    await check_all_trackers()


async def reschedule(hours: int):
    scheduler.reschedule_job(
        "check_all_trackers",
        trigger=IntervalTrigger(hours=hours),
    )
