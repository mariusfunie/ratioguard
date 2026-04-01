import httpx
import logging
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def _prowlarr_request(prowlarr_url: str, api_key: str, method: str, path: str, json=None):
    url = prowlarr_url.rstrip("/") + path
    headers = {"X-Api-Key": api_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15, verify=False) as client:
        kwargs = {"headers": headers}
        if json is not None:
            kwargs["json"] = json
        r = await getattr(client, method)(url, **kwargs)
        r.raise_for_status()
        return r.json() if r.content else {}


async def get_prowlarr_indexers(prowlarr_url: str, api_key: str):
    return await _prowlarr_request(prowlarr_url, api_key, "get", "/api/v1/indexer")


async def get_prowlarr_status(prowlarr_url: str, api_key: str) -> dict:
    try:
        data = await _prowlarr_request(prowlarr_url, api_key, "get", "/api/v1/system/status")
        return {"connected": True, "version": data.get("version", ""), "instance_name": data.get("instanceName", "Prowlarr")}
    except Exception as e:
        return {"connected": False, "error": str(e)}


async def sync_priorities_to_prowlarr():
    from app.core.database import get_db, TrackerModel, SettingsModel
    db = await get_db()
    async with db as session:
        s_result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
        app_settings = s_result.scalar_one_or_none()
        if not app_settings:
            return {"updated": 0, "skipped": 0, "errors": ["Settings not found"]}

        prowlarr_url = app_settings.prowlarr_url
        api_key = app_settings.prowlarr_api_key

        if not prowlarr_url or not api_key:
            return {"updated": 0, "skipped": 0, "errors": []}

        t_result = await session.execute(
            select(TrackerModel).where(
                TrackerModel.prowlarr_id != None,
                TrackerModel.current_ratio != None,
                TrackerModel.status == "online",
            )
        )
        trackers = t_result.scalars().all()

        if not trackers:
            return {"updated": 0, "skipped": 0, "errors": []}

        ratios = [min(t.current_ratio, 10.0) for t in trackers]
        r_min = min(ratios)
        r_max = max(ratios)
        PRIO_BEST = 10
        PRIO_WORST = 50

        def calc_priority(ratio):
            ratio = min(ratio, 10.0)
            if r_max == r_min:
                return PRIO_BEST
            normalized = (ratio - r_min) / (r_max - r_min)
            return round(PRIO_WORST - normalized * (PRIO_WORST - PRIO_BEST))

        try:
            indexers = await get_prowlarr_indexers(prowlarr_url, api_key)
        except Exception as e:
            return {"updated": 0, "skipped": 0, "errors": [str(e)]}

        indexers_by_id = {idx["id"]: idx for idx in indexers}
        updated = 0
        skipped = 0
        errors = []

        for tracker in trackers:
            prowlarr_id = tracker.prowlarr_id
            manual_priority = tracker.prowlarr_priority
            new_priority = manual_priority if manual_priority else calc_priority(tracker.current_ratio)

            idx = indexers_by_id.get(prowlarr_id)
            if not idx:
                skipped += 1
                continue

            current_priority = idx.get("priority", 25)
            if manual_priority and current_priority == new_priority:
                skipped += 1
                continue

            payload = {**idx, "priority": new_priority}
            try:
                await _prowlarr_request(prowlarr_url, api_key, "put", f"/api/v1/indexer/{prowlarr_id}", json=payload)
                tracker.prowlarr_priority = new_priority
                await session.commit()
                updated += 1
            except Exception as e:
                errors.append(f"{tracker.name}: {e}")

        return {"updated": updated, "skipped": skipped, "errors": errors}
