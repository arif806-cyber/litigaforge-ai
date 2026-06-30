"""
LitigaForge — NVIDIA NIM embedding helper.

Async helper that calls nvidia/nv-embedqa-e5-v5 via the NIM API to produce
1024-dim dense vector embeddings for semantic similarity search over judgments.

Unlike the reranking endpoint (nim.py), embeddings ARE available on the
free-tier nvapi- key.  Falls back gracefully (returns None) on any error —
callers must handle None and fall through to keyword search.

Env vars (all optional):
  NIM_API_KEY         nvapi-...   (Replit Secret — same key as nim.py)
  NIM_EMBED_MODEL     nvidia/nv-embedqa-e5-v5   (default)
  NIM_EMBED_BASE      https://integrate.api.nvidia.com/v1  (default)
  NIM_EMBED_TIMEOUT   30  (seconds, default)

Asymmetric embedding note
-------------------------
nv-embedqa-e5-v5 uses asymmetric embeddings: set input_type="query" for search
queries and input_type="passage" for documents being indexed.  Cosine similarity
between a query vector and a passage vector is the relevance score.
"""
import logging
import math
import os
from typing import List, Optional

logger = logging.getLogger("litigaforge.nim_embed")

NIM_API_KEY: Optional[str] = os.getenv("NIM_API_KEY")
NIM_EMBED_MODEL: str = os.getenv("NIM_EMBED_MODEL", "nvidia/nv-embedqa-e5-v5")
NIM_EMBED_BASE: str = os.getenv("NIM_EMBED_BASE", "https://integrate.api.nvidia.com/v1").rstrip("/")
NIM_EMBED_TIMEOUT: float = float(os.getenv("NIM_EMBED_TIMEOUT", "30"))

_BATCH_SIZE = 20

_httpx = None


def _http():
    global _httpx
    if _httpx is None:
        import httpx as _h
        _httpx = _h
    return _httpx


def nim_embed_enabled() -> bool:
    """True when an API key is present. Does not validate the key."""
    return bool(NIM_API_KEY)


def vec_to_str(v: List[float]) -> str:
    """Format a float list as a pgvector literal: '[x1,x2,...]'."""
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def _normalize(vec: List[float]) -> List[float]:
    """L2-normalize so cosine similarity == dot product."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0.0:
        return vec
    inv = 1.0 / norm
    return [x * inv for x in vec]


async def _call_embed(texts: List[str], input_type: str) -> Optional[List[Optional[List[float]]]]:
    """Raw NIM embeddings call. input_type: 'query' or 'passage'."""
    results: List[Optional[List[float]]] = [None] * len(texts)
    try:
        httpx = _http()
        async with httpx.AsyncClient(timeout=NIM_EMBED_TIMEOUT) as client:
            for start in range(0, len(texts), _BATCH_SIZE):
                batch = texts[start:start + _BATCH_SIZE]
                resp = await client.post(
                    f"{NIM_EMBED_BASE}/embeddings",
                    headers={
                        "Authorization": f"Bearer {NIM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": NIM_EMBED_MODEL,
                        "input": batch,
                        "input_type": input_type,
                        "encoding_format": "float",
                        "truncate": "END",
                    },
                )
                resp.raise_for_status()
                for item in (resp.json().get("data") or []):
                    idx = item.get("index")
                    emb = item.get("embedding")
                    if idx is not None and isinstance(emb, list) and emb:
                        results[start + idx] = _normalize(emb)
        logger.info(
            "nim.embed: embedded %d texts (type=%s model=%s)",
            len(texts), input_type, NIM_EMBED_MODEL,
        )
        return results
    except Exception as exc:
        logger.warning("nim.embed: failed (type=%s): %s", input_type, exc)
        return None


async def aembed_passages(texts: List[str]) -> Optional[List[Optional[List[float]]]]:
    """
    Embed a list of document passages for indexing.
    Returns a list (one entry per input) of float-lists, or None on failure.
    """
    if not nim_embed_enabled() or not texts:
        return None
    return await _call_embed(texts, "passage")


async def aembed_query(text: str) -> Optional[List[float]]:
    """
    Embed a single search query for retrieval.
    Returns a float-list, or None on failure.
    """
    if not nim_embed_enabled() or not text:
        return None
    results = await _call_embed([text], "query")
    if results is None:
        return None
    return results[0]
