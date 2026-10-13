"""Metered, cached tools backed by the shared official Indian Kanoon client."""
import re
from typing import Dict, List, Optional

async def search_indian_kanoon(
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
    params: dict = {"formInput": query[:300], "pagenum": "0",
                    "maxpages": str(max(1, min(5, (max_results + 9) // 10)))}
    if doctype:
        params["doctypes"] = doctype[:120]
    try:
        from case_law_search import ik_cached_search
        from database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            data, _ = await ik_cached_search(conn, params, feature="research_tool")
        return (data.get("docs") or [])[:max_results]
    except Exception as exc:
        return [{"error": f"Metered Indian Kanoon request failed: {type(exc).__name__}"}]


async def get_case_details(case_id: str) -> Dict:
    """
    Fetch full details of a specific case by its IndianKanoon tid.

    Returns a dict with full case metadata and judgment text.
    On failure returns a dict with an "error" key.

    Args:
        case_id: The IndianKanoon document ID (tid / docid).
    """
    try:
        if not case_id.isdigit():
            return {"error": "case_id must be a numeric Indian Kanoon document ID"}
        from case_law_search import get_ik_document
        from database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            return await get_ik_document(conn, case_id[:40], feature="research_tool")
    except Exception as exc:
        return {"error": f"Metered Indian Kanoon request failed: {type(exc).__name__}"}


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
