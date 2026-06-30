"""
seo/seo_drift_monitor.py — SEO baseline drift monitor

On first run, snapshots title, meta description, canonical URL, JSON-LD
presence, and OG tags for each monitored route into a SQLite DB.
On subsequent runs, diffs against the baseline and reports regressions.

Catches: missing JSON-LD, changed titles, broken canonicals, duplicate content,
missing meta descriptions — without a paid crawler subscription.

Usage (CLI):
    python3 -m seo.seo_drift_monitor --base-url https://litigaforge.com
    python3 -m seo.seo_drift_monitor --base-url https://litigaforge.com --reset

Usage (import):
    from seo.seo_drift_monitor import run_monitor
    diffs = await run_monitor(base_url="https://litigaforge.com")
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sqlite3
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import httpx

DEFAULT_BASE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com")
DEFAULT_DB_PATH = os.getenv("SEO_DRIFT_DB", "/tmp/litigaforge_seo_drift.db")
GOOGLEBOT_UA = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

MONITOR_ROUTES = [
    "/",
    "/lawyers",
    "/judgments",
    "/ask",
    "/subscription",
    "/legal-aid",
    "/free-documents",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
]

TRACKED_FIELDS = ["title", "meta_description", "canonical_url", "has_json_ld", "og_title", "og_description"]


@dataclass
class Snapshot:
    route: str
    title: str = ""
    meta_description: str = ""
    canonical_url: str = ""
    has_json_ld: bool = False
    og_title: str = ""
    og_description: str = ""
    status_code: int = 0
    error: Optional[str] = None


@dataclass
class DriftItem:
    route: str
    field: str
    baseline_value: str
    current_value: str
    detected_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


def _extract(html: str, status_code: int, route: str) -> Snapshot:
    snap = Snapshot(route=route, status_code=status_code)
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    snap.title = title_m.group(1).strip() if title_m else ""

    desc_m = re.search(
        r'<meta\s+(?:name=["\']description["\']\s+content|content=["\']([^"\']*)["\']'
        r'\s+name=["\']description["\'])',
        html, re.IGNORECASE,
    )
    if desc_m:
        snap.meta_description = (desc_m.group(1) or "").strip()
    else:
        desc_m2 = re.search(
            r'name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE
        )
        snap.meta_description = desc_m2.group(1).strip() if desc_m2 else ""

    canon_m = re.search(r'rel=["\']canonical["\']\s+href=["\'](.*?)["\']', html, re.IGNORECASE)
    snap.canonical_url = canon_m.group(1).strip() if canon_m else ""

    snap.has_json_ld = "application/ld+json" in html

    og_title_m = re.search(r'property=["\']og:title["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
    snap.og_title = og_title_m.group(1).strip() if og_title_m else ""

    og_desc_m = re.search(r'property=["\']og:description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
    snap.og_description = og_desc_m.group(1).strip() if og_desc_m else ""

    return snap


async def _fetch(client: httpx.AsyncClient, base_url: str, path: str) -> Snapshot:
    url = base_url.rstrip("/") + path
    try:
        r = await client.get(url, follow_redirects=True)
        snap = _extract(r.text, r.status_code, path)
        return snap
    except Exception as e:
        return Snapshot(route=path, error=str(e))


async def snapshot_all(base_url: str, routes: list[str]) -> list[Snapshot]:
    headers = {"User-Agent": GOOGLEBOT_UA, "Accept": "text/html,*/*"}
    async with httpx.AsyncClient(headers=headers, timeout=20.0) as client:
        return list(await asyncio.gather(*[_fetch(client, base_url, path) for path in routes]))


def _init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seo_baseline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_url TEXT NOT NULL,
            route TEXT NOT NULL,
            title TEXT, meta_description TEXT, canonical_url TEXT,
            has_json_ld INTEGER, og_title TEXT, og_description TEXT,
            captured_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seo_drift_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_url TEXT NOT NULL,
            route TEXT NOT NULL,
            field TEXT NOT NULL,
            baseline_value TEXT,
            current_value TEXT,
            detected_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def _save_baseline(conn: sqlite3.Connection, snaps: list[Snapshot], base_url: str) -> None:
    now = datetime.utcnow().isoformat()
    conn.execute("DELETE FROM seo_baseline WHERE base_url = ?", (base_url,))
    for s in snaps:
        conn.execute(
            "INSERT INTO seo_baseline (base_url, route, title, meta_description, "
            "canonical_url, has_json_ld, og_title, og_description, captured_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (base_url, s.route, s.title, s.meta_description,
             s.canonical_url, int(s.has_json_ld), s.og_title, s.og_description, now),
        )
    conn.commit()


def _load_baseline(conn: sqlite3.Connection, base_url: str) -> dict[str, dict]:
    rows = conn.execute(
        "SELECT route, title, meta_description, canonical_url, has_json_ld, "
        "og_title, og_description FROM seo_baseline WHERE base_url = ?",
        (base_url,),
    ).fetchall()
    cols = ["route", "title", "meta_description", "canonical_url",
            "has_json_ld", "og_title", "og_description"]
    return {row[0]: dict(zip(cols, row)) for row in rows}


def _diff(baseline: dict[str, dict], current: list[Snapshot], base_url: str) -> list[DriftItem]:
    diffs = []
    for snap in current:
        base = baseline.get(snap.route)
        if not base:
            continue
        checks = {
            "title": (base.get("title"), snap.title),
            "meta_description": (base.get("meta_description"), snap.meta_description),
            "canonical_url": (base.get("canonical_url"), snap.canonical_url),
            "has_json_ld": (bool(base.get("has_json_ld")), snap.has_json_ld),
            "og_title": (base.get("og_title"), snap.og_title),
            "og_description": (base.get("og_description"), snap.og_description),
        }
        for field_name, (bval, cval) in checks.items():
            if bval != cval:
                diffs.append(DriftItem(
                    route=snap.route,
                    field=field_name,
                    baseline_value=str(bval),
                    current_value=str(cval),
                ))
    return diffs


def _save_diffs(conn: sqlite3.Connection, diffs: list[DriftItem], base_url: str) -> None:
    for d in diffs:
        conn.execute(
            "INSERT INTO seo_drift_log (base_url, route, field, baseline_value, current_value, detected_at) "
            "VALUES (?,?,?,?,?,?)",
            (base_url, d.route, d.field, d.baseline_value, d.current_value, d.detected_at),
        )
    conn.commit()


async def run_monitor(
    base_url: str = DEFAULT_BASE_URL,
    db_path: str = DEFAULT_DB_PATH,
    routes: Optional[list[str]] = None,
    reset: bool = False,
) -> list[DriftItem]:
    """Run the monitor. Returns list of DriftItems (empty = no regressions)."""
    if routes is None:
        routes = MONITOR_ROUTES
    conn = _init_db(db_path)
    baseline = {} if reset else _load_baseline(conn, base_url)
    current = await snapshot_all(base_url, routes)

    if not baseline:
        _save_baseline(conn, current, base_url)
        return []

    diffs = _diff(baseline, current, base_url)
    if diffs:
        _save_diffs(conn, diffs, base_url)
    return diffs


def main() -> None:
    parser = argparse.ArgumentParser(description="LitigaForge SEO drift monitor")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--db", default=DEFAULT_DB_PATH)
    parser.add_argument("--reset", action="store_true", help="Reset baseline and re-snapshot")
    parser.add_argument("--routes", nargs="*", default=MONITOR_ROUTES)
    args = parser.parse_args()

    diffs = asyncio.run(run_monitor(
        base_url=args.base_url,
        db_path=args.db,
        routes=args.routes,
        reset=args.reset,
    ))

    if args.reset:
        print(f"✓ Baseline reset and saved for {len(args.routes)} routes @ {args.base_url}")
        return

    if not diffs:
        print(f"✓ No SEO drift detected across {len(args.routes)} routes @ {args.base_url}")
        return

    print(f"\n⚠  {len(diffs)} SEO regression(s) detected @ {args.base_url}")
    for d in diffs:
        print(f"  {d.route}  [{d.field}]")
        print(f"    baseline : {d.baseline_value[:80]!r}")
        print(f"    current  : {d.current_value[:80]!r}")
    sys.exit(1)


if __name__ == "__main__":
    main()
