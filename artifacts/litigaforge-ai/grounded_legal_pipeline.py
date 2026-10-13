"""Opt-in, fail-closed legal RAG pipeline used only by comparative evaluations."""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import logging
import os
import re
from io import BytesIO
from urllib.parse import urlparse

import httpx

from legal_chat_policy import AUTHORITIES, build_case_profile
from llm.anthropic_pipeline import complete, stream, PUBLIC_RETRY_ERROR

logger = logging.getLogger("litigaforge.grounded_pipeline")
_CNR_RE = re.compile(r"\b[A-Z]{4}\d{12,16}\b", re.I)
_ALLOWED_HOSTS = {"indiacode.nic.in", "upload.indiacode.nic.in", "law.telangana.gov.in"}


def _plain_html(markup: str) -> str:
    markup = re.sub(r"(?is)<(script|style).*?</\1>", " ", markup)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", markup))).strip()


async def _source_text(url: str, section: str = "") -> str:
    host = urlparse(url).hostname or ""
    if host not in _ALLOWED_HOSTS:
        return ""
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        body = response.content
        if body.startswith(b"%PDF-"):
            from PyPDF2 import PdfReader
            pages = await asyncio.to_thread(lambda: [
                (page.extract_text() or "") for page in PdfReader(BytesIO(body)).pages
            ])
            text = "\n".join(pages)
            if section:
                match = re.search(rf"(?i)\b{re.escape(section)}\b", text)
                if match:
                    return text[max(0, match.start() - 500):match.start() + 7000]
            return text[:8000]
        text = _plain_html(body.decode(response.encoding or "utf-8", errors="replace"))
        if section:
            match = re.search(rf"(?i)\b{re.escape(section)}\b", text)
            if match:
                return text[max(0, match.start() - 500):match.start() + 7000]
        return text[:8000]
    except Exception as exc:
        logger.warning("Official source retrieval failed host=%s type=%s",
                       host, type(exc).__name__)
        return ""


async def retrieve_grounding(conn, question: str, profile: dict | None = None) -> dict:
    """Retrieve official statute text, dated tables, judgments, and CNR facts first."""
    profile = profile or build_case_profile([], question)
    refs = []
    registry = list(AUTHORITIES["india"]["common"])
    state = profile.get("state")
    if state in AUTHORITIES["india"]["states"]:
        registry.extend(AUTHORITIES["india"]["states"][state]["authorities"])
    for ref in registry:
        aliases = ref.get("aliases", [])
        terms = [ref["id"].replace("-", " "), ref["citation"], *aliases]
        mentioned = any(term.casefold() in question.casefold() for term in terms)
        rent_matter = profile.get("matter_type") == "residential_rent_eviction"
        if not mentioned and not (
            rent_matter and ref["id"] in {"tpa-106", "cpc-2-2", "cpc-2-12", "cpc-order-37",
                                          "telangana-rent-control-act"}
        ):
            continue
        section = re.search(r"(?:section|s\.)\s*(\d+(?:\(\d+\))?)", ref["citation"], re.I)
        text = await _source_text(ref["source"], section.group(1) if section else "")
        if text:
            refs.append({
                "kind": "act", "citation": ref["citation"], "url": ref["source"],
                "text": text[:7000],
            })

    wanted_tables = []
    if re.search(r"\b(ipc|bns|crpc|bnss|evidence act|bsa)\b", question, re.I):
        wanted_tables.append("criminal-code-crosswalk-in")
    if state in {"Telangana", "Andhra Pradesh"} and re.search(
        r"\b(court|forum|pecuniary|claim|jurisdiction|value|rent|tenant|landlord|evict)\b",
        question, re.I,
    ):
        wanted_tables.append(f"court-structure-{state.casefold().replace(' ', '-')}")
    if re.search(r"\b(rent|tenant|landlord|evict|eviction)\b", question, re.I):
        wanted_tables.append("state-rent-laws")
    if wanted_tables:
        tables = await conn.fetch(
            """SELECT id, category, jurisdiction, effective_from, verified_on,
                      status, source_urls, data
               FROM legal_reference_tables WHERE id = ANY($1::text[]) ORDER BY id""",
            wanted_tables,
        )
        table_context = [dict(row) for row in tables]
    else:
        table_context = []
    judgments = []
    if state == "Telangana" or re.search(r"\b(india|indian|court|case|judgment|judgement|precedent)\b", question, re.I):
        try:
            from case_law_search import search_case_law
            found = await search_case_law(conn, question[:280], limit=5)
            for item in found["results"]:
                text = item.get("full_text") or item.get("summary_en") or ""
                if not text and item.get("ik_tid"):
                    from judgment_ingest import IndianKanoonClient, _html_to_text, _token
                    client = IndianKanoonClient(_token())
                    doc = await asyncio.to_thread(client.get_doc, item["ik_tid"])
                    text = _html_to_text(doc.get("doc") or "", cap=12000)
                if text:
                    judgments.append({
                        "kind": "judgment", "citation": item.get("citation") or "",
                        "case_name": item.get("case_name"), "court": item.get("court"),
                        "year": item.get("year"), "url": item.get("source_url") or item.get("url"),
                        "text": text[:12000],
                    })
        except Exception as exc:
            logger.warning("Judgment retrieval failed type=%s", type(exc).__name__)

    case_data = None
    cnr = _CNR_RE.search(question)
    if cnr:
        try:
            from services.court_data_client import lookup_cnr
            case_data = await lookup_cnr(cnr.group(0))
        except Exception as exc:
            logger.warning("eCourts retrieval failed type=%s", type(exc).__name__)
    return {"acts": refs, "tables": table_context, "judgments": judgments,
            "ecourts": case_data, "cnr": cnr.group(0) if cnr else None}


def _source_links(grounding: dict) -> list[dict]:
    items = grounding["acts"] + grounding["judgments"]
    links, seen = [], set()
    for item in items:
        url = item.get("url")
        if url and url not in seen:
            seen.add(url)
            links.append({"label": item.get("citation") or item.get("case_name") or "Legal source",
                          "url": url, "kind": item["kind"]})
    for table in grounding["tables"]:
        urls = table.get("source_urls") or []
        if isinstance(urls, str):
            try:
                urls = json.loads(urls)
            except ValueError:
                urls = []
        for url in urls:
            if url and url not in seen:
                seen.add(url)
                links.append({"label": f"{table['jurisdiction']} — {table['category']}",
                              "url": url, "kind": "dated_reference"})
    return links


def _prompts(question: str, grounding: dict, draft: bool, country: str = "IN") -> tuple[str, str]:
    feature = "drafting" if draft else "legal_qa"
    if country != "IN":
        raise ValueError("Grounded production path is currently supported only for India.")
    if not grounding["acts"] and not grounding["judgments"] and not grounding["tables"] and not grounding["ecourts"]:
        raise RuntimeError("No source material was retrieved; do not generate a legal answer.")
    system = (
        "You are LitigaForge. Answer only from the retrieved source text and dated reference tables. "
        "Do not use model memory for legal facts. If retrieved sources do not support an answer, say "
        "'I could not verify this from the retrieved sources.' Cite statute section and act title "
        "exactly as shown in the source. Do not invent cases, courts, years, or pecuniary limits. "
        "If a current threshold is unknown, say 'verify the current limit'. "
        "For a court draft, begin exactly: 'Draft — review by an advocate before filing'. "
        "Never treat user-supplied statements as official sources."
    )
    source_context = json.dumps(grounding, ensure_ascii=False, default=str)[:50000]
    prompt = f"RETRIEVED SOURCES (cite only these):\n{source_context}\n\nUSER REQUEST:\n{question}"
    return feature, (system, prompt)


async def grounded_answer(conn, question: str, history: list[dict] | None = None,
                          context: str = "", country: str = "IN") -> dict:
    """Answer with retrieval then Haiku verification; no provider downgrade."""
    history = history or []
    profile = build_case_profile(history, question + "\n" + context)
    grounding = await retrieve_grounding(conn, question, profile)
    draft = bool(re.search(r"\b(draft|prepare|write|plaint|petition|notice|reply)\b", question, re.I))
    feature, (system, prompt) = _prompts(question, grounding, draft, country)
    generated = await complete(feature, system, prompt, 8192)
    verify_prompt = (
        "Audit every citation in the answer (act/title, section, case name, court, year) against "
        "the retrieved source bundle. Return ONLY a JSON object with keys `answer` and `corrections`. "
        "`answer` is the corrected answer. `corrections` is an array of short objects with `claim`, "
        "`change`, and `source_url`. Remove unsupported citations or label the exact claim "
        "'[unverified]'. Do not add new law.\n\n"
        f"SOURCES:\n{json.dumps(grounding, ensure_ascii=False, default=str)[:40000]}\n\n"
        f"ANSWER:\n{generated['text']}"
    )
    checked = await complete("citation_verification", system, verify_prompt, 8192)
    try:
        verification = json.loads(checked["text"])
        verified_answer = str(verification["answer"]).strip()
        corrections = verification.get("corrections", [])
        if not isinstance(corrections, list):
            raise ValueError("corrections must be an array")
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("Citation verification returned an invalid result.") from exc
    if not verified_answer:
        raise RuntimeError("Citation verification returned no answer.")
    if draft and not verified_answer.startswith("Draft — review by an advocate before filing"):
        verified_answer = "Draft — review by an advocate before filing\n\n" + verified_answer
    corrections = [
        {"claim": str(item.get("claim", ""))[:500],
         "change": str(item.get("change", ""))[:500],
         "source_url": str(item.get("source_url", ""))[:500]}
        for item in corrections if isinstance(item, dict)
    ][:50]
    if corrections:
        await conn.execute(
            """INSERT INTO ai_citation_correction_log
               (question_hash, feature, model, corrections)
               VALUES ($1, $2, $3, $4::jsonb)""",
            hashlib.sha256(question.encode("utf-8")).hexdigest(),
            feature, checked["model"], json.dumps(corrections, ensure_ascii=False),
        )
    return {
        "reply": verified_answer, "sources": _source_links(grounding),
        "corrections": corrections,
        "draft": draft, "models": [generated["model"], checked["model"]],
        "latency_ms": generated["latency_ms"] + checked["latency_ms"],
        "cost_usd": (generated["cost_usd"] or 0) + (checked["cost_usd"] or 0),
        "usage": [generated, checked],
    }


async def grounded_stream(conn, question: str, profile: dict | None = None):
    """Stream Opus internally, verify the completed answer, then emit safe chunks."""
    grounding = await retrieve_grounding(conn, question, profile)
    feature, (system, prompt) = _prompts(
        question, grounding, bool(re.search(r"\b(draft|petition|plaint|notice)\b", question, re.I))
    )
    raw_parts = []
    async for token in stream(feature, system, prompt, 8192):
        raw_parts.append(token)
    raw = "".join(raw_parts).strip()
    if not raw:
        raise RuntimeError(PUBLIC_RETRY_ERROR)
    verification_prompt = (
        "Audit each citation against the source bundle. Return ONLY JSON with `answer` and "
        "`corrections` (array of short objects with `claim`, `change`, `source_url`). Remove "
        "unsupported citations or mark them [unverified]; never add law.\n\n"
        f"SOURCES:\n{json.dumps(grounding, ensure_ascii=False, default=str)[:40000]}\n\nANSWER:\n{raw}"
    )
    checked = await complete("citation_verification", system, verification_prompt, 8192)
    try:
        verified = json.loads(checked["text"])
        answer = str(verified["answer"]).strip()
        corrections = verified.get("corrections", [])
        if not answer or not isinstance(corrections, list):
            raise ValueError("invalid verification object")
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("Citation verification returned an invalid result.") from exc
    clean_corrections = [
        {"claim": str(item.get("claim", ""))[:500],
         "change": str(item.get("change", ""))[:500],
         "source_url": str(item.get("source_url", ""))[:500]}
        for item in corrections if isinstance(item, dict)
    ][:50]
    if clean_corrections:
        await conn.execute(
            """INSERT INTO ai_citation_correction_log
               (question_hash, feature, model, corrections)
               VALUES ($1,$2,$3,$4::jsonb)""",
            hashlib.sha256(question.encode("utf-8")).hexdigest(), feature,
            checked["model"], json.dumps(clean_corrections, ensure_ascii=False),
        )
    words = answer.split()
    for i in range(0, len(words), 3):
        yield " ".join(words[i:i + 3]) + " "
    sources = _source_links(grounding)
    if sources:
        footer = "\n\nSources\n" + "\n".join(
            f"- {item['label']}: {item['url']}" for item in sources
        )
        for i in range(0, len(footer), 180):
            yield footer[i:i + 180]
    yield {"sources": sources, "corrections": clean_corrections}
