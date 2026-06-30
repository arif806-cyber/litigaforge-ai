"""
seo/sitemap_manager.py — Merged sitemap generator + search-engine pings

Generates a single unified sitemap.xml covering:
  - Static app routes (hardcoded with correct priorities)
  - Judgment pages (live, from the /judgments/sitemap-data API)
  - Blog articles (live, from the Cloudflare Worker sitemap.xml)

Also pings Google, Bing, and IndexNow after every deploy.

Usage:
    from seo.sitemap_manager import build_sitemap_xml, notify_search_engines

    xml = await build_sitemap_xml()
    results = await notify_search_engines()
"""
import os
import re
from datetime import date
from typing import Optional
from urllib.parse import quote

import httpx

SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")
BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")
BLOG_WORKER_URL = os.getenv(
    "BLOG_WORKER_URL",
    "https://litigaforge-blog.arif-806.workers.dev",
).rstrip("/")
INDEXNOW_KEY = os.getenv("INDEXNOW_KEY", "").strip()
_LOCAL_PORT = os.getenv("PORT", "5000")

TODAY = date.today().isoformat()

# ── Static route manifest ─────────────────────────────────────────────────────
# (path, priority, changefreq)
STATIC_ROUTES: list[tuple[str, str, str]] = [
    ("/",               "1.0", "daily"),
    ("/lawyers",        "0.9", "daily"),
    ("/ask",            "0.9", "daily"),
    ("/judgments",      "0.9", "daily"),
    ("/post-case",      "0.8", "weekly"),
    ("/subscription",   "0.8", "weekly"),
    ("/legal-aid",      "0.8", "weekly"),
    ("/free-documents", "0.8", "weekly"),
    ("/about",          "0.6", "monthly"),
    ("/contact",        "0.5", "monthly"),
    ("/privacy",        "0.4", "monthly"),
    ("/terms",          "0.4", "monthly"),
    ("/blog",           "0.9", "daily"),
]


def _entry(loc: str, lastmod: str = TODAY, changefreq: str = "weekly", priority: str = "0.7") -> str:
    return (
        "  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


async def _fetch_judgment_urls(timeout: float = 10.0) -> list[dict]:
    """Fetch judgment pages from the local FastAPI sitemap-data endpoint."""
    url = f"http://localhost:{_LOCAL_PORT}{BASE_PATH}/judgments/sitemap-data"
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(url)
            if r.status_code == 200:
                return r.json().get("items", [])
    except Exception:
        pass
    return []


async def _fetch_blog_urls(timeout: float = 15.0) -> list[dict]:
    """Crawl the Cloudflare Worker sitemap to collect blog article URLs."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.get(f"{BLOG_WORKER_URL}/sitemap.xml")
            if r.status_code != 200:
                return []
            locs = re.findall(r"<loc>(.*?)</loc>", r.text)
            return [
                {"url": loc, "lastmod": TODAY}
                for loc in locs
                if "/blog/" in loc and loc.startswith("http")
            ]
    except Exception:
        return []


async def build_sitemap_xml() -> str:
    """Build a merged sitemap XML and return it as a string."""
    entries: list[str] = []

    for path, priority, changefreq in STATIC_ROUTES:
        entries.append(_entry(f"{SITE_URL}{path}", TODAY, changefreq, priority))

    for item in await _fetch_judgment_urls():
        url = item.get("url") or f"{SITE_URL}{item.get('path', '')}"
        lastmod = item.get("lastmod") or TODAY
        entries.append(_entry(url, lastmod, "weekly", "0.8"))

    for item in await _fetch_blog_urls():
        entries.append(_entry(item["url"], item.get("lastmod", TODAY), "weekly", "0.7"))

    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n"
        "</urlset>"
    )


async def notify_search_engines(sitemap_url: Optional[str] = None) -> dict:
    """Ping Google, Bing, and IndexNow with the sitemap URL.

    Call this once after every production deploy.
    Returns a dict with the HTTP status (or error string) per engine.
    """
    if sitemap_url is None:
        sitemap_url = f"{SITE_URL}/sitemap.xml"

    encoded = quote(sitemap_url, safe="")
    results: dict = {}

    async with httpx.AsyncClient(timeout=10.0) as c:
        for engine, ping_url in [
            ("google", f"https://www.google.com/ping?sitemap={encoded}"),
            ("bing",   f"https://www.bing.com/ping?sitemap={encoded}"),
        ]:
            try:
                r = await c.get(ping_url)
                results[engine] = r.status_code
            except Exception as e:
                results[engine] = f"error: {e}"

        if INDEXNOW_KEY:
            host = SITE_URL.replace("https://", "").replace("http://", "")
            try:
                r = await c.post(
                    "https://api.indexnow.org/indexnow",
                    json={
                        "host": host,
                        "key": INDEXNOW_KEY,
                        "keyLocation": f"{SITE_URL}/{INDEXNOW_KEY}.txt",
                        "urlList": [sitemap_url],
                    },
                    headers={"Content-Type": "application/json"},
                )
                results["indexnow"] = r.status_code
            except Exception as e:
                results["indexnow"] = f"error: {e}"
        else:
            results["indexnow"] = "skipped (INDEXNOW_KEY not set)"

    return results
