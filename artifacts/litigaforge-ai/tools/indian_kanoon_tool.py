"""
Reusable synchronous wrapper for the IndianKanoon official API.

Used by the Research Agent pre-fetch and available as a standalone tool
for scripts, future LangGraph tool nodes, or CLI tests.

Env vars:
  INDIANKANOON_API_TOKEN   — required (official paid API token)
  INDIAN_KANOON_API_KEY    — alias accepted for compatibility with user docs
  INDIAN_KANOON_BASE_URL   — override base URL (default: https://api.indiankanoon.org)
"""
import os
import re
from typing import Dict, List, Optional

import requests

_TOKEN = (
    os.getenv("INDIANKANOON_API_TOKEN")
    or os.getenv("INDIAN_KANOON_API_KEY")
    or ""
).strip()

BASE_URL = os.getenv("INDIAN_KANOON_BASE_URL", "https://api.indiankanoon.org").rstrip("/")

_TIMEOUT = 15


def _headers() -> dict:
    return {
        "Authorization": f"Token {_TOKEN}",
        "Content-Type": "application/json",
    }


def search_indian_kanoon(
    query: str,
    max_results: int = 5,
    doctype: Optional[str] = None,
) -> List[Dict]:
    """
    Search IndianKanoon for case laws and judgments.

    Returns a list of result dicts with keys:
      title, tid, docsource, publishdate, headline, numciting, citation
    On failure returns a single-element list with an "error" key.

    Args:
        query:       Free-text search (e.g. "motor accident compensation Telangana").
        max_results: Maximum number of results to return (default 5).
        doctype:     Optional document type filter (e.g. "judgments").
    """
    if not _TOKEN:
        return [{"error": "IndianKanoon API token not set (INDIANKANOON_API_TOKEN env var missing)"}]

    params: dict = {"formInput": query, "pagenum": 0}
    if doctype:
        params["doctype"] = doctype

    try:
        resp = requests.post(
            f"{BASE_URL}/search/",
            headers=_headers(),
            data=params,
            timeout=_TIMEOUT,
        )
        if resp.status_code == 401:
            return [{"error": "IndianKanoon auth failed — check INDIANKANOON_API_TOKEN"}]
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("docs", [])
        return docs[:max_results]
    except requests.RequestException as exc:
        return [{"error": f"IndianKanoon request failed: {exc}"}]
    except Exception as exc:
        return [{"error": f"Unexpected error calling IndianKanoon: {exc}"}]


def get_case_details(case_id: str) -> Dict:
    """
    Fetch full details of a specific case by its IndianKanoon tid.

    Returns a dict with full case metadata and judgment text.
    On failure returns a dict with an "error" key.

    Args:
        case_id: The IndianKanoon document ID (tid / docid).
    """
    if not _TOKEN:
        return {"error": "IndianKanoon API token not set (INDIANKANOON_API_TOKEN env var missing)"}

    try:
        resp = requests.get(
            f"{BASE_URL}/doc/{case_id}/",
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        if resp.status_code == 401:
            return {"error": "IndianKanoon auth failed — check INDIANKANOON_API_TOKEN"}
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        return {"error": f"IndianKanoon request failed: {exc}"}
    except Exception as exc:
        return {"error": f"Unexpected error: {exc}"}


def strip_html(text: str) -> str:
    """Remove HTML tags from an IK headline/snippet."""
    return re.sub(r"<[^>]+>", "", text or "").strip()


# ── Tool descriptors (LangChain-compatible) ────────────────────────────────────

TOOLS = [
    {
        "name": "search_indian_kanoon",
        "description": (
            "Search IndianKanoon for relevant Supreme Court, High Court, or Tribunal judgments. "
            "Use this when you need latest or specific case references for an Indian legal matter. "
            "Always cite the case name, court, and year from results."
        ),
        "function": search_indian_kanoon,
    },
    {
        "name": "get_case_details",
        "description": (
            "Get full details of a specific Indian case using its IndianKanoon document ID (tid). "
            "Use after search_indian_kanoon to retrieve the full judgment text."
        ),
        "function": get_case_details,
    },
]
