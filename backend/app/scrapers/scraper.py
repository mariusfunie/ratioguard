import re
import httpx
from bs4 import BeautifulSoup
from typing import Optional, Tuple
from urllib.parse import urlparse, urljoin, unquote
import logging

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

SIZE_UNITS = {
    "tb": 1024**4, "gb": 1024**3, "mb": 1024**2, "kb": 1024, "b": 1,
    "tib": 1024**4, "gib": 1024**3, "mib": 1024**2, "kib": 1024,
}

def validate_url(url):
    if not url or not url.strip():
        raise ValueError("URL is empty - please edit this tracker and set the correct URL")
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        raise ValueError(f"URL missing protocol: '{url}'")
    return url

def make_absolute(url, base_url):
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    parsed = urlparse(base_url)
    return urljoin(f"{parsed.scheme}://{parsed.netloc}", url)

def _parse_size_string(s):
    m = re.search(r"([0-9]+[.,][0-9]*|[0-9]+)\s*(TB|GB|MB|KB|TiB|GiB|MiB|KiB|B)\b", str(s), re.IGNORECASE)
    if m:
        return float(m.group(1).replace(",", ".")) * SIZE_UNITS.get(m.group(2).lower().strip(), 1)
    return None

def _to_bytes(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    parsed = _parse_size_string(str(v))
    if parsed:
        return parsed
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return None

def bytes_to_human(b):
    for unit in ["TB", "GB", "MB", "KB"]:
        div = SIZE_UNITS[unit.lower()]
        if b >= div:
            return f"{b / div:.2f} {unit}"
    return f"{b:.0f} B"

def _parse_ratio_value(val):
    val = str(val).strip().rstrip(".")
    if re.match(r"^(inf|infinity|infinite|∞|---|--)", val, re.IGNORECASE):
        return 999.99
    try:
        v = float(val.replace(",", "."))
        if 0 <= v <= 9999:
            return round(v, 2)
    except Exception:
        pass
    return None

def extract_ratio_from_html(html):
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    ratio = None
    upload_bytes = None
    download_bytes = None

    ratio_labels = re.compile(r"^(ratio|raport|share\s*ratio|seeding\s*ratio)\$", re.IGNORECASE)
    upload_labels = re.compile(r"^(uploaded?|total\s*upload(ed)?|up|incarcat|seeded)\$", re.IGNORECASE)
    download_labels = re.compile(r"^(downloaded?|total\s*download(ed)?|down|descarcat|leeched)\$", re.IGNORECASE)

    for cell in soup.find_all(["td", "th", "dt", "span", "div", "li"]):
        ct = cell.get_text(strip=True)
        if ratio is None and ratio_labels.match(ct):
            nxt = cell.find_next_sibling()
            if nxt:
                ratio = _parse_ratio_value(nxt.get_text(strip=True))
        if upload_bytes is None and upload_labels.match(ct):
            nxt = cell.find_next_sibling()
            if nxt:
                upload_bytes = _parse_size_string(nxt.get_text(strip=True))
        if download_bytes is None and download_labels.match(ct):
            nxt = cell.find_next_sibling()
            if nxt:
                download_bytes = _parse_size_string(nxt.get_text(strip=True))

    if ratio is None:
        for pat in [
            r"ratio[:\s]*([0-9]+[.,][0-9]+|inf(?:inity)?\.?|∞)",
            r"raport[:\s]*([0-9]+[.,][0-9]+|inf(?:inity)?\.?|∞)",
        ]:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                ratio = _parse_ratio_value(m.group(1))
                if ratio is not None:
                    break

    if ratio is None and re.search(r"ratio[:\s]*(inf\.?|infinity|∞|---)", text, re.IGNORECASE):
        ratio = 999.99

    if upload_bytes is None:
        m = re.search(r"(?:total\s+)?(?:uploaded?|up|incarcat|seeded)[:\s]+([0-9]+[.,][0-9]*)\s*(TB|GB|MB|KB|TiB|GiB|MiB|KiB|B)\b", text, re.IGNORECASE)
        if m:
            upload_bytes = _to_bytes(m.group(1) + " " + m.group(2))

    if download_bytes is None:
        m = re.search(r"(?:total\s+)?(?:downloaded?|down|descarcat|leeched)[:\s]+([0-9]+[.,][0-9]*)\s*(TB|GB|MB|KB|TiB|GiB|MiB|KiB|B)\b", text, re.IGNORECASE)
        if m:
            download_bytes = _to_bytes(m.group(1) + " " + m.group(2))

    if ratio is None and upload_bytes and download_bytes and download_bytes > 0:
        ratio = round(upload_bytes / download_bytes, 2)
    elif ratio is None and upload_bytes and (not download_bytes or download_bytes == 0):
        ratio = 999.99

    return ratio, bytes_to_human(upload_bytes) if upload_bytes else None, bytes_to_human(download_bytes) if download_bytes else None


async def fetch_with_cookies(url, cookies_str):
    url = validate_url(url)
    cookies = {}
    for part in cookies_str.split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            cookies[k.strip()] = v.strip()
    async with httpx.AsyncClient(headers=HEADERS, cookies=cookies, follow_redirects=True, timeout=20, verify=False) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


async def fetch_with_login(login_url, profile_url, username, password, session_cookies=None):
    login_url = validate_url(login_url)
    profile_url = validate_url(profile_url)
    import requests as req_lib, urllib3, asyncio
    urllib3.disable_warnings()

    def _sync():
        s = req_lib.Session()
        s.verify = False
        s.headers.update(HEADERS)

        if session_cookies:
            for part in session_cookies.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    s.cookies.set(k.strip(), v.strip())
            try:
                r = s.get(profile_url, timeout=20)
                if r.status_code == 200 and username.lower() in r.text.lower():
                    return r.text, "; ".join(f"{k}={v}" for k, v in s.cookies.items())
            except Exception:
                pass

        login_page = s.get(login_url, timeout=20)
        from bs4 import BeautifulSoup as _BS
        soup = _BS(login_page.text, "html.parser")
        # cauta form-ul de login - cel care contine input de tip password
        form = None
        for f in soup.find_all("form"):
            if f.find("input", {"type": "password"}):
                form = f
                break
        if not form:
            form = soup.find("form")
        data = {}
        if form:
            for inp in form.find_all("input"):
                n = inp.get("name")
                if n:
                    data[n] = inp.get("value", "")

        ukeys = ["user", "login", "name", "email", "membername", "username"]
        pkeys = ["pass", "pwd", "password"]
        for key in list(data.keys()):
            kl = key.lower()
            if any(u in kl for u in ukeys):
                data[key] = username
            elif any(p in kl for p in pkeys):
                data[key] = password
        if not any(any(u in k.lower() for u in ukeys) for k in data):
            data["username"] = username
        if not any(any(p in k.lower() for p in pkeys) for k in data):
            data["password"] = password

        xsrf = s.cookies.get("XSRF-TOKEN", "")
        if xsrf:
            xsrf = unquote(xsrf)
            s.headers.update({"X-XSRF-TOKEN": xsrf})
            data["_token"] = xsrf

        action = form.get("action", "") if form else ""
        action = make_absolute(action, login_url) if action else login_url
        s.post(action, data=data, timeout=20)

        r = s.get(profile_url, timeout=20)
        if r.status_code != 200:
            raise ValueError(f"Profile page returned {r.status_code}")
        return r.text, "; ".join(f"{k}={v}" for k, v in s.cookies.items())

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync)


async def fetch_api_ratio(api_url, api_key):
    api_url = validate_url(api_url)
    h = {**HEADERS, "Authorization": f"Bearer {api_key}", "X-Api-Key": api_key}
    async with httpx.AsyncClient(headers=h, follow_redirects=False, timeout=20, verify=False) as client:
        r = await client.get(api_url, params={"passkey": api_key, "apikey": api_key})
        if r.status_code in (301, 302, 303, 307, 308):
            raise ValueError(f"API redirect - token may be expired")
        r.raise_for_status()
        data = r.json()

    def fk(d, *keys):
        for k in keys:
            if k in d:
                return d[k]
            for val in d.values():
                if isinstance(val, dict) and k in val:
                    return val[k]
        return None

    ratio = _parse_ratio_value(fk(data, "ratio", "shareRatio", "share_ratio"))
    ub = _to_bytes(fk(data, "uploaded", "upload", "seeded", "totalUploaded"))
    db = _to_bytes(fk(data, "downloaded", "download", "leeched", "totalDownloaded"))

    if ratio is None and ub and db and db > 0:
        ratio = round(ub / db, 2)
    elif ratio is None and ub and (not db or db == 0):
        ratio = 999.99

    return ratio, bytes_to_human(ub) if ub else None, bytes_to_human(db) if db else None
