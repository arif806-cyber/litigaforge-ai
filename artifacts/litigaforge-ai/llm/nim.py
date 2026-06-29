"""
LitigaForge — NVIDIA NIM reranker helper.

Adds semantic reranking on top of the deterministic 0-100 lawyer-match score.
The combined score blends 60 % NIM semantic relevance + 40 % deterministic signal,
producing matches that understand the actual *meaning* of the client's legal issue
rather than relying on keyword overlap alone.

Activation:  set NIM_API_KEY=nvapi-... in Replit Secrets.
             NIM_RERANK_MODEL can be changed (default uses the 1B rerankqa model).

Graceful degradation: if the key is missing OR the API call fails for any reason,
rerank() returns the original list unchanged — zero impact on existing behaviour.
"""
import logging
import os
from typing import List, Optional

logger = logging.getLogger("litigaforge.nim")

NIM_API_KEY: Optional[str] = os.getenv("NIM_API_KEY")
NIM_RERANK_MODEL: str = os.getenv(
    "NIM_RERANK_MODEL",
    "nvidia/llama-3.2-nv-rerankqa-1b-v2",
)
NIM_RERANK_BASE = "https://integrate.api.nvidia.com/v1"
NIM_TIMEOUT = float(os.getenv("NIM_TIMEOUT", "15"))

_httpx = None


def _http():
    global _httpx
    if _httpx is None:
        import httpx as _h
        _httpx = _h
    return _httpx


def nim_enabled() -> bool:
    return bool(NIM_API_KEY)


def _build_document(lawyer: dict) -> str:
    """
    Compose a rich text document for each lawyer so the reranker can
    assess semantic fit against the case query string.
    """
    parts = [lawyer.get("name", "")]
    pas = lawyer.get("practice_areas") or []
    if pas:
        parts.append("Specialises in: " + ", ".join(pas))
    dist = lawyer.get("district", "")
    if dist:
        parts.append(f"Based in {dist}")
    exp = lawyer.get("experience_years")
    if exp:
        parts.append(f"{exp} years of legal experience")
    bio = (lawyer.get("bio") or "").strip()
    if bio:
        parts.append(bio[:400])
    return ". ".join(p for p in parts if p)


async def arerank(
    query: str,
    lawyers: List[dict],
    *,
    det_weight: float = 0.40,
    top_n: Optional[int] = None,
) -> List[dict]:
    """
    Async semantic reranking of lawyer candidates.

    Blends NIM semantic score (1 - det_weight) with the existing deterministic
    match_score (det_weight).  Falls back to original order on any error.

    Args:
        query:       Free-text description of the client's legal issue.
        lawyers:     List of lawyer dicts, each already carrying 'match_score'.
        det_weight:  Weight given to deterministic score (0–1).  Default 0.40.
        top_n:       How many results to return (default: all).
    """
    if not nim_enabled() or not lawyers or not query:
        return lawyers

    documents = [_build_document(l) for l in lawyers]

    try:
        httpx = _http()
        async with httpx.AsyncClient(timeout=NIM_TIMEOUT) as client:
            resp = await client.post(
                f"{NIM_RERANK_BASE}/ranking",
                headers={
                    "Authorization": f"Bearer {NIM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": NIM_RERANK_MODEL,
                    "query": {"role": "user", "content": query},
                    "passages": [{"role": "user", "content": d} for d in documents],
                },
            )
            resp.raise_for_status()
            data = resp.json()

        rankings = data.get("rankings") or []
        if not rankings:
            logger.warning("nim.rerank: empty rankings response")
            return lawyers

        sem_weight = 1.0 - det_weight

        ranked = sorted(lawyers, key=lambda _: 0)
        blended = []
        for r in rankings:
            idx = r.get("index")
            nim_score = float(r.get("logit", 0.0))
            if idx is None or idx >= len(lawyers):
                continue
            lawyer = dict(lawyers[idx])
            det_norm = lawyer.get("match_score", 0) / 100.0
            nim_norm = min(max((nim_score + 10) / 20.0, 0.0), 1.0)
            combined = det_weight * det_norm + sem_weight * nim_norm
            lawyer["_nim_logit"] = round(nim_score, 4)
            lawyer["_combined_score"] = round(combined * 100, 1)
            lawyer["match_score"] = round(combined * 100)
            blended.append(lawyer)

        blended.sort(key=lambda x: x["_combined_score"], reverse=True)
        logger.info(
            "nim.rerank: reranked %d lawyers (model=%s)", len(blended), NIM_RERANK_MODEL
        )
        return blended[: top_n] if top_n else blended

    except Exception as exc:
        logger.warning("nim.rerank: failed (%s) — using deterministic order", exc)
        return lawyers
