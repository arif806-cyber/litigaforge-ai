"""
LitigaForge — NVIDIA NIM Vision helper for scanned document analysis.

Calls microsoft/phi-3-vision-128k-instruct via the NIM API.  The model reads
the raw image (PNG/JPG/WEBP) directly — understanding stamps, handwriting,
tables, and multi-column layouts that pytesseract misses — and returns the
legal analysis JSON in a single LLM call, eliminating the separate OCR step.

Falls back gracefully: callers receive None on any error and should fall through
to the existing pytesseract → Claude pipeline.

Env vars:
  NIM_API_KEY          nvapi-...  (Replit Secret — same key used by nim.py / nim_embed.py)
  NIM_VISION_MODEL     microsoft/phi-3-vision-128k-instruct   (default)
  NIM_VISION_BASE      https://integrate.api.nvidia.com/v1    (default)
  NIM_VISION_TIMEOUT   60  (seconds — vision calls are slower than text, default 60)
"""
import base64
import logging
import os
from typing import Optional

logger = logging.getLogger("litigaforge.nim_vision")

NIM_API_KEY: Optional[str] = os.getenv("NIM_API_KEY")
NIM_VISION_MODEL: str = os.getenv(
    "NIM_VISION_MODEL", "microsoft/phi-3-vision-128k-instruct"
)
NIM_VISION_BASE: str = os.getenv(
    "NIM_VISION_BASE", "https://integrate.api.nvidia.com/v1"
).rstrip("/")
NIM_VISION_TIMEOUT: float = float(os.getenv("NIM_VISION_TIMEOUT", "60"))

_httpx = None


def _http():
    global _httpx
    if _httpx is None:
        import httpx as _h
        _httpx = _h
    return _httpx


def nim_vision_enabled() -> bool:
    """True when an API key is present. Does not validate the key."""
    return bool(NIM_API_KEY)


def _mime_from_content_type(content_type: str) -> str:
    """Map a full MIME type to the subset accepted by the NIM vision API."""
    ct = content_type.lower()
    if "png" in ct:
        return "image/png"
    if "webp" in ct:
        return "image/webp"
    return "image/jpeg"  # jpg / jpeg / fallback


async def analyze_image(
    image_bytes: bytes,
    content_type: str,
    document_type: str = "legal document",
    jurisdiction: str = "India",
    context: str = "",
) -> Optional[dict]:
    """
    Send an image to NIM Vision and receive a structured legal analysis.

    The model extracts text AND produces the analysis in a single call.
    Returns the analysis dict on success, or None on any error (missing key,
    API failure, timeout, unexpected response format).

    Parameters
    ----------
    image_bytes:   Raw image bytes (PNG / JPG / WEBP).
    content_type:  MIME type of the image (e.g. "image/png").
    document_type: Hint for the analysis prompt (e.g. "sale deed").
    jurisdiction:  Jurisdiction name for the analysis prompt.
    context:       Optional free-text context from the user.
    """
    if not nim_vision_enabled():
        return None

    mime = _mime_from_content_type(content_type)
    b64 = base64.b64encode(image_bytes).decode("ascii")
    image_url = f"data:{mime};base64,{b64}"

    context_block = (
        f"\n\nAdditional context from the user:\n{context}\n" if context else ""
    )

    prompt = f"""You are an expert legal analyst specialising in {jurisdiction} law.
You are analyzing a scanned {document_type}.{context_block}

Please:
1. Read ALL text visible in the image carefully, including stamps, handwritten annotations,
   table entries, headers, footers, and any multi-column layout.
2. Based on the full document content, produce a legal risk analysis.

Return ONLY a valid JSON object with this exact structure — no markdown, no extra text:

{{
  "risk_score": <integer 0-100>,
  "missing_clauses": [<list of strings — clauses that should be present but are absent>],
  "red_flags": [<list of strings — problematic terms, ambiguities, or unfair clauses>],
  "recommendations": [<list of strings — specific actions the client should take>],
  "compliance_notes": "<string — how the document stands under {jurisdiction} law>",
  "summary": "<string — plain-English summary of the document and its key risks>"
}}"""

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": image_url},
                },
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
        }
    ]

    try:
        httpx = _http()
        async with httpx.AsyncClient(timeout=NIM_VISION_TIMEOUT) as client:
            resp = await client.post(
                f"{NIM_VISION_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {NIM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": NIM_VISION_MODEL,
                    "messages": messages,
                    "max_tokens": 2000,
                    "temperature": 0.2,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        raw_text = ""
        try:
            raw_text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            logger.warning("nim.vision: unexpected response shape: %s", str(data)[:200])
            return None

        # Strip markdown code fences if present before JSON parsing.
        import re
        clean = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
        clean = re.sub(r"\s*```$", "", clean.strip())

        import json
        result = json.loads(clean)

        # Validate the required keys are present and risk_score is numeric.
        required = {"risk_score", "missing_clauses", "red_flags", "recommendations",
                    "compliance_notes", "summary"}
        if not required.issubset(result.keys()):
            missing = required - result.keys()
            logger.warning("nim.vision: response missing keys %s — retrying without", missing)
            return None

        result["risk_score"] = int(result.get("risk_score") or 50)
        for list_key in ("missing_clauses", "red_flags", "recommendations"):
            if not isinstance(result.get(list_key), list):
                result[list_key] = []

        logger.info(
            "nim.vision: analyzed %s (%.1f KB, model=%s, risk_score=%s)",
            document_type, len(image_bytes) / 1024, NIM_VISION_MODEL,
            result["risk_score"],
        )
        return result

    except Exception as exc:
        logger.warning(
            "nim.vision: failed for %s (%.1f KB): %s",
            document_type, len(image_bytes) / 1024, exc,
        )
        return None
