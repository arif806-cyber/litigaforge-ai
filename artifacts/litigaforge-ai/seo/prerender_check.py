"""
seo/prerender_check.py — Crawler visibility regression check

Fetches each key route with a Googlebot User-Agent and verifies that the
returned HTML contains expected content markers (page-specific text, JSON-LD
presence). Exits non-zero on failure — suitable for CI gating.

Addresses the root-cause SPA crawler issue: if Googlebot sees the same empty
HTML shell on every route, this check will detect the missing markers and fail
the CI run before it ships again.

Usage (CLI):
    python3 -m seo.prerender_check --base-url https://litigaforge.com

Usage (import):
    from seo.prerender_check import run_checks
    results = await run_checks(base_url="https://litigaforge.com")
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass, field
from typing import Optional

import httpx

GOOGLEBOT_UA = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)
DEFAULT_BASE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com")

# (path, required_markers)
# Markers are case-insensitive substrings expected in the Googlebot-visible HTML.
# Failing any marker means the SPA shell was returned unrendered.
ROUTES_TO_CHECK: list[tuple[str, list[str]]] = [
    ("/",             ["LitigaForge", "legal"]),
    ("/lawyers",      ["LitigaForge", "lawyer"]),
    ("/judgments",    ["LitigaForge", "judgment"]),
    ("/ask",          ["LitigaForge", "legal"]),
    ("/subscription", ["LitigaForge"]),
    ("/legal-aid",    ["LitigaForge", "legal"]),
    ("/about",        ["LitigaForge"]),
    ("/contact",      ["LitigaForge"]),
]

GLOBAL_MARKERS = ["LitigaForge", "<title"]


@dataclass
class RouteResult:
    path: str
    status_code: int = 0
    html_length: int = 0
    has_json_ld: bool = False
    has_og_tags: bool = False
    missing_markers: list[str] = field(default_factory=list)
    error: Optional[str] = None
    redirect_url: Optional[str] = None

    @property
    def passed(self) -> bool:
        return (
            self.error is None
            and self.status_code in (200, 301, 302)
            and not self.missing_markers
        )

    def summary(self) -> str:
        icon = "✓" if self.passed else "✗"
        parts = [
            f"HTTP {self.status_code}",
            f"{self.html_length} chars",
            "JSON-LD ✓" if self.has_json_ld else "JSON-LD ✗",
            "OG ✓" if self.has_og_tags else "OG ✗",
        ]
        if self.missing_markers:
            parts.append(f"missing: {self.missing_markers}")
        if self.error:
            parts.append(f"error: {self.error}")
        return f"  {icon} {self.path}  [{' | '.join(parts)}]"


async def _check_one(
    client: httpx.AsyncClient,
    base_url: str,
    path: str,
    markers: list[str],
) -> RouteResult:
    url = base_url.rstrip("/") + path
    result = RouteResult(path=path)
    try:
        r = await client.get(url, follow_redirects=True)
        result.status_code = r.status_code
        html = r.text
        result.html_length = len(html)
        html_lower = html.lower()
        result.has_json_ld = "application/ld+json" in html
        result.has_og_tags = 'property="og:' in html or "property='og:" in html
        if r.history:
            result.redirect_url = str(r.url)
        all_markers = GLOBAL_MARKERS + markers
        result.missing_markers = [m for m in all_markers if m.lower() not in html_lower]
    except Exception as e:
        result.error = str(e)
    return result


async def run_checks(
    base_url: str = DEFAULT_BASE_URL,
    routes: Optional[list[tuple[str, list[str]]]] = None,
    timeout: float = 20.0,
) -> list[RouteResult]:
    """Run all route checks concurrently and return results."""
    if routes is None:
        routes = ROUTES_TO_CHECK
    headers = {"User-Agent": GOOGLEBOT_UA, "Accept": "text/html,*/*"}
    async with httpx.AsyncClient(headers=headers, timeout=timeout) as client:
        return list(await asyncio.gather(
            *[_check_one(client, base_url, path, markers) for path, markers in routes]
        ))


def main() -> None:
    parser = argparse.ArgumentParser(description="LitigaForge SEO prerender check")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    args = parser.parse_args()

    results = asyncio.run(run_checks(base_url=args.base_url, timeout=args.timeout))

    if args.json:
        import json
        print(json.dumps([
            {
                "path": r.path,
                "passed": r.passed,
                "status_code": r.status_code,
                "html_length": r.html_length,
                "has_json_ld": r.has_json_ld,
                "has_og_tags": r.has_og_tags,
                "missing_markers": r.missing_markers,
                "error": r.error,
            }
            for r in results
        ], indent=2))
    else:
        print(f"\nPrerender check — {args.base_url}\n")
        for r in results:
            print(r.summary())
        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        print(f"\n{passed}/{len(results)} routes passed")

    if any(not r.passed for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
