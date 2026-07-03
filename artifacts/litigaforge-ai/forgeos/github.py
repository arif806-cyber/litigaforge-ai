"""
ForgeOS GitHub integration — real PR queue + recent CI/deployment runs for
the dashboard's Deployments widget. Pulls straight from the GitHub REST API
using the same no-expiry PAT the rest of the project already uses to push
(GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE — see replit.md). Server-side only:
the token never reaches the frontend, only the derived summary does.

In-memory cache (~60s TTL) so the dashboard/SSE stream doesn't hammer
GitHub's API on every poll/reconnect. Fails soft — a GitHub outage or a
missing/expired token degrades to an explicit "unavailable" status rather
than crashing the whole dashboard aggregation.
"""
import os
import time

import httpx

from logger import get_logger

logger = get_logger("litigaforge.forgeos")

GITHUB_REPO = os.getenv("FORGEOS_GITHUB_REPO", "arif806-cyber/litigaforge-ai")
GITHUB_BRANCH = os.getenv("FORGEOS_GITHUB_BRANCH", "feature/arifbase")
_CACHE_TTL_SECONDS = 60
_cache: dict = {"data": None, "fetched_at": 0.0}


def _token() -> str:
    return os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE", "")


async def _fetch_live() -> dict:
    token = _token()
    if not token:
        return {"available": False, "reason": "GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE not set",
                "pull_requests": [], "workflow_runs": []}

    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    base = f"https://api.github.com/repos/{GITHUB_REPO}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            prs_resp, runs_resp = await client.get(f"{base}/pulls?state=open&per_page=10", headers=headers), None
            runs_resp = await client.get(f"{base}/actions/runs?per_page=10&branch={GITHUB_BRANCH}", headers=headers)

        if prs_resp.status_code != 200 or runs_resp.status_code != 200:
            logger.warning("forgeos: GitHub API returned %s/%s for %s",
                            prs_resp.status_code, runs_resp.status_code, GITHUB_REPO)
            return {"available": False,
                    "reason": f"GitHub API error (PRs={prs_resp.status_code}, runs={runs_resp.status_code})",
                    "pull_requests": [], "workflow_runs": []}

        prs = [
            {
                "number": pr["number"], "title": pr["title"], "author": pr["user"]["login"],
                "url": pr["html_url"], "created_at": pr["created_at"], "updated_at": pr["updated_at"],
                "draft": pr.get("draft", False),
            }
            for pr in prs_resp.json()
        ]
        runs = [
            {
                "id": run["id"], "name": run["name"], "status": run["status"],
                "conclusion": run.get("conclusion"), "event": run["event"],
                "url": run["html_url"], "created_at": run["created_at"], "updated_at": run["updated_at"],
            }
            for run in runs_resp.json().get("workflow_runs", [])
        ]
        return {"available": True, "reason": "", "pull_requests": prs, "workflow_runs": runs}
    except Exception as e:
        logger.error("forgeos: GitHub API fetch failed: %s", e, exc_info=True)
        return {"available": False, "reason": str(e), "pull_requests": [], "workflow_runs": []}


async def get_deployment_status(force_refresh: bool = False) -> dict:
    """Cached (~60s) GitHub PR + Actions-run summary. `force_refresh=True`
    bypasses the cache — used sparingly (e.g. a manual dashboard refresh
    button), not on every SSE tick."""
    now = time.time()
    if not force_refresh and _cache["data"] is not None and (now - _cache["fetched_at"]) < _CACHE_TTL_SECONDS:
        return _cache["data"]

    data = await _fetch_live()
    _cache["data"] = data
    _cache["fetched_at"] = now
    return data
