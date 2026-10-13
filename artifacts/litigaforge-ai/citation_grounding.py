"""Shared fail-closed helpers for retrieved case-law citations."""
import re


def retrieved_authority_block(judgments: list[dict]) -> str:
    if not judgments:
        return (
            "VERIFIED JUDGMENTS: none were retrieved. Do not name or cite any case; "
            "state that no verified case authority was found."
        )
    lines = ["VERIFIED JUDGMENTS (the only cases that may be cited):"]
    for index, item in enumerate(judgments, 1):
        title = (item.get("case_name") or item.get("title") or "").strip()
        if not title:
            continue
        citation = (item.get("citation") or "").strip()
        court = (item.get("court") or item.get("docsource") or "").strip()
        year = str(item.get("year") or "")
        url = (item.get("source_url") or item.get("url") or "").strip()
        lines.append(f"{index}. {title} | {citation} | {court} {year} | {url}")
        paragraphs = item.get("grounding_paragraphs") or []
        for paragraph in paragraphs[:8]:
            label = str(paragraph.get("label") or "judgment paragraph")
            text = str(paragraph.get("text") or "").strip()
            if text:
                lines.append(f"   [{label}] {text[:1600]}")
        if not paragraphs:
            full_text = str(item.get("full_text") or "").strip()
            fallback = full_text or str(item.get("summary_en") or "").strip()
            if fallback:
                lines.append(f"   [verified judgment text] {fallback[:5000]}")
    if len(lines) == 1:
        return retrieved_authority_block([])
    lines.append("Do not cite any judgment outside this retrieved list.")
    return "\n".join(lines)


def strip_unretrieved_judgment_citations(text: str, judgments: list[dict]) -> str:
    """Replace unsupported case-name and reporter citations after generation."""
    from citation_extractor import extract_citations_sync

    normalize = lambda value: re.sub(r"[^a-z0-9]", "", str(value).lower())
    allowed_names = [
        normalize(item.get("case_name") or item.get("title") or "")
        for item in judgments
    ]
    allowed_citations = [normalize(item.get("citation") or "") for item in judgments]
    title_word = r"(?:[A-Z][A-Za-z0-9&'()\-]*|of|the|and|for|in|on|to|by)"
    case_name = re.compile(
        rf"\b[A-Z][A-Za-z0-9&'()\-]*(?:\s+{title_word}){{0,7}}"
        rf"\s+v(?:s\.?|\.?)\s+[A-Z][A-Za-z0-9&'()\-]*(?:\s+{title_word}){{0,7}}"
    )
    marker = "[Unverified judgment reference removed.]"

    def replace_case(match):
        name = normalize(match.group(0))
        if any(name and (name in title or title in name) for title in allowed_names if title):
            return match.group(0)
        return marker

    cleaned = case_name.sub(replace_case, text)
    for citation in extract_citations_sync(cleaned):
        normalized = normalize(citation["normalized"])
        if not any(
            normalized == allowed or normalized in allowed or allowed in normalized
            for allowed in allowed_citations if allowed
        ):
            cleaned = cleaned.replace(citation["raw"], marker)
    return cleaned


def scrub_unretrieved_citations(value, judgments: list[dict]):
    """Recursively scrub model-generated prose in JSON-like analysis results."""
    if isinstance(value, str):
        return strip_unretrieved_judgment_citations(value, judgments)
    if isinstance(value, list):
        return [scrub_unretrieved_citations(item, judgments) for item in value]
    if isinstance(value, dict):
        return {
            key: scrub_unretrieved_citations(item, judgments)
            for key, item in value.items()
        }
    return value
