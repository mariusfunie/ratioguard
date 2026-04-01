import httpx
import logging
from urllib.parse import urlparse
from app.core.config import settings

logger = logging.getLogger(__name__)

STATUS = {0: "stopped", 1: "check_wait", 2: "checking", 3: "download_wait", 4: "downloading", 5: "seed_wait", 6: "seeding"}


async def _get_transmission_config():
    try:
        from app.core.database import get_db, SettingsModel
        from sqlalchemy import select
        db = await get_db()
        async with db as session:
            result = await session.execute(select(SettingsModel).where(SettingsModel.id == "app_settings"))
            s = result.scalar_one_or_none()
            if s and s.transmission_url:
                return s.transmission_url, s.transmission_user or "", s.transmission_pass or ""
    except Exception:
        pass
    return settings.TRANSMISSION_URL, settings.TRANSMISSION_USER, settings.TRANSMISSION_PASS


async def _get_session_id() -> str:
    url, user, passwd = await _get_transmission_config()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, auth=(user, passwd) if user else None)
        return r.headers.get("X-Transmission-Session-Id", "")


async def _rpc(method: str, arguments: dict = {}) -> dict:
    url, user, passwd = await _get_transmission_config()
    session_id = await _get_session_id()
    auth = (user, passwd) if user else None
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            url, auth=auth,
            headers={"X-Transmission-Session-Id": session_id},
            json={"method": method, "arguments": arguments},
        )
        r.raise_for_status()
        data = r.json()
        if data.get("result") != "success":
            raise ValueError(f"Transmission error: {data.get('result')}")
        return data.get("arguments", {})


def _extract_tracker_name(trackers: list) -> str:
    if not trackers:
        return None
    announce = trackers[0].get("announce", "")
    sitename = trackers[0].get("sitename", "")
    if sitename:
        return sitename
    parsed = urlparse(announce)
    return parsed.netloc.replace("www.", "").split(".")[0]


def _build_torrent_dict(t: dict, include_priority: bool = False) -> dict:
    uploaded_gb = round(t.get("uploadedEver", 0) / 1024**3, 2)
    downloaded_gb = round(t.get("downloadedEver", 0) / 1024**3, 2)
    size_gb = round(t.get("sizeWhenDone", 0) / 1024**3, 2)
    hours_seeding = round(t.get("secondsSeeding", 0) / 3600, 1)
    rate_up_kb = round(t.get("rateUpload", 0) / 1024, 1)
    rate_down_kb = round(t.get("rateDownload", 0) / 1024, 1)
    tracker_name = _extract_tracker_name(t.get("trackers", []))

    result = {
        "id": t["id"],
        "name": t["name"],
        "tracker_name": tracker_name,
        "ratio": round(t.get("uploadRatio", 0), 3),
        "uploaded_gb": uploaded_gb,
        "downloaded_gb": downloaded_gb,
        "size_gb": size_gb,
        "percent_done": round(t.get("percentDone", 0) * 100, 1),
        "status": STATUS.get(t.get("status", 0), "unknown"),
        "hours_seeding": hours_seeding,
        "rate_up_kb": rate_up_kb,
        "rate_down_kb": rate_down_kb,
        "has_error": t.get("error", 0) != 0,
        "error_string": t.get("errorString", ""),
    }

    if include_priority:
        PRIORITY_MAP = {1: "high", 0: "normal", -1: "low"}
        result["bandwidth_priority"] = PRIORITY_MAP.get(t.get("bandwidthPriority", 0), "normal")

    return result


async def get_torrents() -> list:
    fields = ["id", "name", "trackers", "uploadRatio", "uploadedEver", "downloadedEver",
              "status", "secondsSeeding", "rateUpload", "rateDownload", "sizeWhenDone",
              "percentDone", "error", "errorString"]
    data = await _rpc("torrent-get", {"fields": fields})
    return [_build_torrent_dict(t) for t in data.get("torrents", [])]


async def get_torrents_with_priority() -> list:
    fields = ["id", "name", "trackers", "uploadRatio", "uploadedEver", "downloadedEver",
              "status", "secondsSeeding", "rateUpload", "rateDownload", "sizeWhenDone",
              "percentDone", "error", "errorString", "bandwidthPriority"]
    data = await _rpc("torrent-get", {"fields": fields})
    return [_build_torrent_dict(t, include_priority=True) for t in data.get("torrents", [])]


async def set_torrent_priority(torrent_ids: list, priority: str):
    bandwidth_map = {"high": 1, "normal": 0, "low": -1}
    await _rpc("torrent-set", {"ids": torrent_ids, "bandwidthPriority": bandwidth_map.get(priority, 0)})


async def start_torrents(torrent_ids: list):
    await _rpc("torrent-start", {"ids": torrent_ids})


async def stop_torrents(torrent_ids: list):
    await _rpc("torrent-stop", {"ids": torrent_ids})


async def get_session_stats() -> dict:
    data = await _rpc("session-stats")
    cumulative = data.get("cumulative-stats", {})
    return {
        "active_torrent_count": data.get("activeTorrentCount", 0),
        "paused_torrent_count": data.get("pausedTorrentCount", 0),
        "total_torrent_count": data.get("torrentCount", 0),
        "download_speed_kb": round(data.get("downloadSpeed", 0) / 1024, 1),
        "upload_speed_kb": round(data.get("uploadSpeed", 0) / 1024, 1),
        "uploaded_bytes": cumulative.get("uploadedBytes", 0),
        "downloaded_bytes": cumulative.get("downloadedBytes", 0),
    }


def _build_tracker_ratio_map(ratioguard_trackers: list) -> dict:
    tracker_map = {}
    for t in ratioguard_trackers:
        name = (t.get("name") or "").lower()
        ratio = t.get("current_ratio")
        threshold = t.get("threshold", 1.0)
        if name and ratio is not None:
            info = {"ratio": ratio, "threshold": threshold, "tracker_name": t.get("name")}
            tracker_map[name] = info
            # adauga varianta fara TLD (ex: "upload.cx" -> "upload")
            short = name.split(".")[0]
            if short != name:
                tracker_map[short] = info
    return tracker_map


async def get_recommendations(ratioguard_trackers: list) -> list:
    torrents = await get_torrents()
    tracker_ratio_map = _build_tracker_ratio_map(ratioguard_trackers)

    tracker_torrents = {}
    for torrent in torrents:
        tn = (torrent.get("tracker_name") or "").lower()
        if tn not in tracker_torrents:
            tracker_torrents[tn] = []
        tracker_torrents[tn].append(torrent)

    recommendations = []
    for tracker_key, info in tracker_ratio_map.items():
        # evita duplicate daca tracker_key e si long si short
        if any(r["tracker"] == info["tracker_name"] for r in recommendations):
            continue

        ratio = info["ratio"]
        threshold = info["threshold"]
        tracker_name = info["tracker_name"]
        t_torrents = tracker_torrents.get(tracker_key, [])

        if not t_torrents:
            continue

        seeding = [t for t in t_torrents if t["status"] == "seeding"]
        stopped = [t for t in t_torrents if t["status"] == "stopped"]
        low_ratio_torrents = [t for t in t_torrents if t["ratio"] < 1.0]

        if ratio < threshold:
            severity = "critical"
            ratio_status = f"Ratio {ratio:.2f} sub threshold {threshold} - PERICOL"
        elif ratio < threshold * 1.5:
            severity = "warning"
            ratio_status = f"Ratio {ratio:.2f} aproape de threshold {threshold}"
        elif ratio > threshold * 5:
            severity = "good"
            ratio_status = f"Ratio excelent: {ratio:.2f} - poti descarca fara griji"
        else:
            severity = "ok"
            ratio_status = f"Ratio {ratio:.2f} - OK"

        hit_and_run_warning = None
        if low_ratio_torrents:
            hit_and_run_warning = f"{len(low_ratio_torrents)} torrente cu ratio sub 1.0 - risc penalizare"

        recommendations.append({
            "tracker": tracker_name,
            "severity": severity,
            "ratio": ratio,
            "threshold": threshold,
            "ratio_status": ratio_status,
            "hit_and_run_warning": hit_and_run_warning,
            "hit_and_run_torrents": [t["name"][:50] for t in low_ratio_torrents[:3]],
            "stopped_count": len(stopped),
            "stopped_torrents": [t["name"][:50] for t in stopped[:3]],
            "torrents_count": len(t_torrents),
            "seeding_count": len(seeding),
        })

    order = {"critical": 0, "warning": 1, "good": 2, "ok": 3}
    recommendations.sort(key=lambda r: order.get(r["severity"], 4))
    return recommendations


async def auto_set_priorities(ratioguard_trackers: list) -> dict:
    torrents = await get_torrents()
    tracker_map = _build_tracker_ratio_map(ratioguard_trackers)

    high_ids = []
    normal_ids = []
    low_ids = []
    report = []

    for torrent in torrents:
        tn = (torrent.get("tracker_name") or "").lower()
        info = tracker_map.get(tn)
        if not info:
            continue

        ratio = info["ratio"]
        threshold = info["threshold"]
        torrent_id = torrent["id"]

        if ratio < threshold:
            high_ids.append(torrent_id)
            priority = "high"
        elif ratio > threshold * 3:
            low_ids.append(torrent_id)
            priority = "low"
        else:
            normal_ids.append(torrent_id)
            priority = "normal"

        report.append({
            "torrent": torrent["name"][:50],
            "tracker": info["tracker_name"],
            "tracker_ratio": ratio,
            "priority_set": priority,
        })

    if high_ids:
        await set_torrent_priority(high_ids, "high")
    if normal_ids:
        await set_torrent_priority(normal_ids, "normal")
    if low_ids:
        await set_torrent_priority(low_ids, "low")

    return {"high": len(high_ids), "normal": len(normal_ids), "low": len(low_ids), "report": report}


async def reset_all_priorities() -> dict:
    torrents = await get_torrents()
    all_ids = [t["id"] for t in torrents]
    if all_ids:
        await set_torrent_priority(all_ids, "normal")
    return {"reset": len(all_ids)}
