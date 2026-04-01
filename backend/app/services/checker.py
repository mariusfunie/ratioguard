from datetime import datetime
from typing import Optional
import logging
import httpx
from sqlalchemy import select, update

from app.scrapers.scraper import (
    fetch_with_cookies,
    fetch_with_login,
    fetch_api_ratio,
    extract_ratio_from_html,
)

logger = logging.getLogger(__name__)


async def check_tracker_by_id(tracker_id: str):
    from app.core.database import get_db, TrackerModel
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.id == tracker_id))
        tracker = result.scalar_one_or_none()
        if not tracker:
            raise ValueError(f"Tracker {tracker_id} not found")
        return await _do_check(tracker, session)


async def check_all_trackers():
    from app.core.database import get_db, TrackerModel
    db = await get_db()
    async with db as session:
        result = await session.execute(select(TrackerModel).where(TrackerModel.enabled == True))
        trackers = result.scalars().all()
        for tracker in trackers:
            try:
                await _do_check(tracker, session)
            except Exception as e:
                logger.error(f"Unhandled error for tracker {tracker.name}: {e}")

    # sync priorities to Prowlarr after all checks
    try:
        from app.services.prowlarr import sync_priorities_to_prowlarr
        result = await sync_priorities_to_prowlarr()
        logger.info(f"Prowlarr priority sync: {result}")
    except Exception as e:
        logger.error(f"Prowlarr priority sync failed: {e}")


async def _do_check(tracker, session):
    from app.core.database import RatioHistoryModel
    ratio = None
    upload = None
    download = None
    error = None

    try:
        if tracker.auth_type == "cookie":
            html = await fetch_with_cookies(tracker.profile_url, tracker.manual_cookies or "")
            ratio, upload, download = extract_ratio_from_html(html)

        elif tracker.auth_type == "login":
            html, new_cookies = await fetch_with_login(
                tracker.login_url, tracker.profile_url,
                tracker.username, tracker.password,
                tracker.session_cookies,
            )
            ratio, upload, download = extract_ratio_from_html(html)
            tracker.session_cookies = new_cookies

        elif tracker.auth_type == "api":
            ratio, upload, download = await fetch_api_ratio(tracker.api_url, tracker.api_key or "")

        if ratio is None:
            raise ValueError("Could not parse ratio from page")

        tracker.status = "online"
        tracker.error_reason = None

    except Exception as e:
        error = str(e)
        tracker.status = "error"
        tracker.error_reason = error
        logger.warning(f"Tracker {tracker.name} check failed: {e}")

    tracker.last_checked = datetime.utcnow()
    if ratio is not None:
        # detectie free leech - ratio a crescut dar downloadedEver nu s-a schimbat
        # indiciu: ratio creste fara download nou
        old_ratio = tracker.current_ratio
        old_download = tracker.download
        if (old_ratio is not None and ratio > old_ratio * 1.05
                and old_download is not None and old_download == download
                and download not in (None, "0 B", "-")):
            tracker.free_leech_detected = True
        else:
            tracker.free_leech_detected = False

        tracker.current_ratio = ratio
        tracker.upload = upload
        tracker.download = download

    await session.commit()

    if ratio is not None:
        session.add(RatioHistoryModel(
            tracker_id=tracker.id,
            ratio=ratio,
            upload=upload,
            download=download,
            recorded_at=datetime.utcnow(),
        ))
        await session.commit()

    if tracker.status == "online" and ratio is not None and ratio < tracker.threshold:
        await send_discord_alert(tracker.name, ratio, tracker.threshold)

    return tracker


async def send_discord_alert(tracker_name: str, ratio: float, threshold: float):
    from app.core.database import get_db, SettingsModel, NotificationModel
    from sqlalchemy import select
    db = await get_db()
    async with db as session:
        result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        app_settings = result.scalar_one_or_none()
        if not app_settings or not app_settings.notifications_enabled:
            return
        webhook_url = app_settings.discord_webhook_url
        if not webhook_url:
            return

    embed = {
        "title": "RatioGuard - Ratio Alert",
        "color": 0xFF4D6D,
        "fields": [
            {"name": "Tracker", "value": tracker_name, "inline": True},
            {"name": "Current Ratio", "value": str(round(ratio, 2)), "inline": True},
            {"name": "Threshold", "value": str(threshold), "inline": True},
        ],
        "footer": {"text": "RatioGuard"},
        "timestamp": datetime.utcnow().isoformat(),
    }

    discord_sent = False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json={"embeds": [embed]})
            discord_sent = r.status_code in (200, 204)
    except Exception as e:
        logger.warning(f"Discord webhook failed: {e}")

    db = await get_db()
    async with db as session:
        session.add(NotificationModel(
            tracker_name=tracker_name,
            ratio=ratio,
            threshold=threshold,
            message=f"Ratio {ratio} dropped below threshold {threshold}",
            discord_sent=discord_sent,
        ))
        await session.commit()
