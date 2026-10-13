"""Read-only MCP legal tools with bounded inputs and no draft-text persistence."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from datetime import datetime
from typing import Any

from database import fetch, fetchrow, get_pool

_NOTICE = "Lead for advocate verification, not legal advice."
_NOT_FOUND = "NOT FOUND — do not cite without checking the original"
_CODES = {
    "ipc": ("IPC_to_BNS", "BNS", "pre-1 July 2024 offences may continue under the old code"),
    "crpc": ("CrPC_to_BNSS", "BNSS", "pre-1 July 2024 offences may continue under the old code"),
    "evidence act": ("Evidence_Act_to_BSA", "BSA", "pre-1 July 2024 offences may continue under the old code"),
    "evidence": ("Evidence_Act_to_BSA", "BSA", "pre-1 July 2024 offences may continue under the old code"),
}


def _result(data: Any, *, source: str, url: str | None, identifier: str,
            untrusted: bool = False) -> dict:
    from routers.mcp_v2 import public_result
    result = public_result(data, source=source, source_url=url, identifier=identifier,
                           untrusted_text=untrusted)
    result["notice"] = _NOTICE
    return result


def _json_object(value: Any) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return {}
    return value if isinstance(value, dict) else {}


async def _verify_one(citation: str, proposition: str, include_fragments: bool) -> dict:
    citation = " ".join(citation.split())[:240]
    if not citation:
        raise ValueError("Each citation must contain text")
    pattern = f"%{citation}%"
    local = await fetch("""
        SELECT case_name,court,court_slug,bench,judgment_date,year,slug,citation,
               source_url,LEFT(COALESCE(full_text,''),12000) AS excerpt
        FROM judgments
        WHERE status='published' AND
          (citation ILIKE $1 OR case_name ILIKE $1 OR source_url ILIKE $1)
        ORDER BY judgment_date DESC NULLS LAST LIMIT 5
    """, pattern)
    matches = [dict(row) for row in local]
    exact_local = next((row for row in matches
                        if re.sub(r"\W", "", str(row.get("citation") or "")).casefold()
                        == re.sub(r"\W", "", citation).casefold()), None)
    item: dict[str, Any] = {
        "citation": citation,
        "local_matches": matches[:3],
        "exact_local_match": bool(exact_local),
        "fragments": [],
        "treatment": "not determinable from available source metadata",
    }
    ik_enabled = os.getenv("IK_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
    if not ik_enabled:
        item["indian_kanoon"] = "disabled by IK_ENABLED"
        if not matches:
            item["status"] = _NOT_FOUND
        return item
    query_type = "cite" if re.search(r"\b\d{4}\b|AIR|SCC|SCR|Cri\.?L\.?J", citation, re.I) else "title"
    query = f'{query_type}:"{citation}"'
    pool = await get_pool()
    async with pool.acquire() as conn:
        from case_law_search import ik_cached_search, get_ik_document, ik_cached_request
        found, _cached = await ik_cached_search(
            conn, {"formInput": query, "pagenum": "0", "maxpages": "1"},
            feature="mcp_verify_citation", ttl_hours=24,
        )
        docs = found.get("docs", []) if isinstance(found, dict) else []
        candidate = docs[0] if docs else None
        tid = str((candidate or {}).get("tid") or "")
        if not tid.isdigit():
            tid = ""
        if not tid and exact_local:
            match = re.search(r"/doc/(\d+)", str(exact_local.get("source_url") or ""))
            tid = match.group(1) if match else ""
        item["indian_kanoon_matches"] = [
            {k: d.get(k) for k in ("title", "docsource", "publishdate", "tid")}
            for d in docs[:3] if isinstance(d, dict)
        ]
        item["indian_kanoon_verified"] = bool(tid)
        if tid:
            document = await get_ik_document(conn, tid, feature="mcp_verify_citation")
            # Missing treatment fields are deliberately not interpreted as negative treatment.
            treatment = document.get("treatment")
            treatment_text = json.dumps(treatment, ensure_ascii=False).casefold()
            negative_treatment = ("overruled", "reversed", "disapproved", "not followed")
            if treatment is not None and any(term in treatment_text for term in negative_treatment):
                item["treatment"] = {"explicit_negative_treatment": treatment}
            if include_fragments and proposition:
                fragment_data = await ik_cached_request(
                    conn, f"/docfragment/{tid}/", {"formInput": proposition[:500]},
                    feature="mcp_verify_citation", ttl_hours=24,
                )
                fragments = fragment_data.get("fragments", []) if isinstance(fragment_data, dict) else []
                if isinstance(fragments, list):
                    item["fragments"] = fragments[:3]
        item["status"] = "candidate found; verify citation details against the original" if (matches or docs) else _NOT_FOUND
    return item


async def _verify_citation(args: dict) -> dict:
    single = args.get("citation")
    citations = args.get("citations")
    if (single is None) == (citations is None):
        raise ValueError("Provide exactly one of citation or citations")
    values = [single] if single is not None else citations
    if not isinstance(values, list) or not 1 <= len(values) <= 10 or any(not isinstance(v, str) for v in values):
        raise ValueError("Provide one citation or an array of 1-10 citation strings")
    proposition = args.get("proposition", "")
    if not isinstance(proposition, str) or len(proposition) > 500:
        raise ValueError("proposition must be at most 500 characters")
    include = bool(args.get("include_fragments", False))
    records = [await _verify_one(value, proposition, include) for value in values]
    result = _result({"citations": records}, source="LitigaForge judgment index and Indian Kanoon",
                     url="https://indiankanoon.org/", identifier="citation-verification",
                     untrusted=True)
    # Keep the contract's machine-readable status exact while all citation
    # source strings remain fenced as untrusted source material.
    for record in result["data"]["citations"]:
        status = record.get("status", "")
        if _NOT_FOUND in status:
            record["status"] = _NOT_FOUND
        elif "candidate found" in status:
            record["status"] = "candidate found; verify citation details against the original"
        treatment = record.get("treatment")
        if isinstance(treatment, str) and "not determinable from available source metadata" in treatment:
            record["treatment"] = "not determinable from available source metadata"
    return result


def _update_draft(args: dict) -> dict:
    draft = args.get("draft")
    refs = args.get("references")
    if not isinstance(draft, str) or len(draft) > 30000:
        raise ValueError("draft must be a string of at most 30000 characters")
    if not isinstance(refs, list) or not 1 <= len(refs) <= 100:
        raise ValueError("references must contain 1-100 section references")
    path = Path(__file__).parents[1] / "data" / "bare_acts_upload" / "crosswalks.json"
    crosswalks = json.loads(path.read_text(encoding="utf-8"))
    results = []
    suggestions = []
    suggested_draft = draft
    for ref in refs:
        if not isinstance(ref, dict) or not isinstance(ref.get("code"), str) or not isinstance(ref.get("section"), str):
            raise ValueError("Each reference needs string code and section fields")
        code, section = ref["code"].strip().casefold(), ref["section"].strip()
        mapping = _CODES.get(code)
        if not mapping:
            raise ValueError(f"Unsupported code: {ref['code']}")
        key, new_code, legacy_note = mapping
        row = crosswalks.get(key, {}).get("mapping", {}).get(section)
        if row is None:
            state, mapped = "no equivalent in crosswalk", []
        else:
            mapped = row if isinstance(row, list) else [str(row)]
            reverse = crosswalks.get(key, {}).get("mapping", {})
            merged = sum(1 for values in reverse.values()
                         if any(str(v) in [str(x) for x in mapped] for v in (values if isinstance(values, list) else [values]))) > 1
            state = "split" if len(mapped) > 1 else "merged" if merged else "changed" if mapped[0] != section else "same-number mapping"
        result = {"code": ref["code"], "section": section, "status": state,
                  "new_code": new_code, "suggested_sections": mapped,
                  "legacy_note": legacy_note, "requires_advocate_review": True}
        results.append(result)
        if mapped:
            replacement = ", ".join(map(str, mapped))
            suggestions.append(f"{ref['code']} {section} → {new_code} {replacement} [suggested; verify]")
            # Only alter a suggestion copy when explicitly requested, and only
            # replace section mentions adjacent to the supplied code label.
            if args.get("include_suggestions", False):
                code_pattern = re.escape(ref["code"])
                section_pattern = re.escape(section)
                suggested_draft = re.sub(
                    rf"(?i)\b({code_pattern})\s+(?:section\s+)?{section_pattern}\b",
                    f"{new_code} {replacement}", suggested_draft,
                )
    data = {"references": results, "input_char_count": len(draft),
            "draft_text_stored": False, "draft_text_sent_to_external_services": False,
            "suggestions": suggestions if args.get("include_suggestions", False) else [],
            "suggested_draft": suggested_draft if args.get("include_suggestions", False) else None,
            "notice": "Crosswalks are indicative; verify the applicable commencement and transition provisions."}
    return _result(data, source="LitigaForge local criminal-code crosswalk", url=None,
                   identifier="criminal-code-draft-update")


def _pick(data: dict, *keys: str) -> Any:
    return next((data[k] for k in keys if data.get(k) not in (None, "")), None)


def _order_sort_key(order: dict) -> str:
    value = str(_pick(order, "order_date", "date", "orderDate") or "")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return value


def _checklist(stage: str) -> list[str]:
    text = stage.casefold()
    if any(word in text for word in ("evidence", "trial", "witness")):
        return ["Confirm witness and evidence schedule", "Check exhibit and filing status", "Review prior directions and deadlines"]
    if any(word in text for word in ("argument", "hearing", "final")):
        return ["Confirm hearing listing and appearance requirements", "Check filed pleadings and authorities", "Review the latest order for directions and deadlines"]
    if any(word in text for word in ("service", "notice", "summon")):
        return ["Check service and proof of service", "Confirm response deadlines", "Review any pending applications"]
    return ["Confirm the listed purpose and appearance requirements", "Review the latest order and pending directions", "Check filings, service, and upcoming deadlines"]


async def _hearing_brief(args: dict, user: dict) -> dict:
    from services import court_data_client
    cnr = court_data_client.normalize_cnr(args.get("cnr", ""))
    tracked = await fetchrow(
        "SELECT * FROM tracked_cases WHERE user_id=$1 AND cnr=$2 AND is_active=true",
        int(user["id"]), cnr,
    )
    if not tracked:
        raise ValueError("hearing_brief is limited to a CNR in your own tracked cases")
    note_rows = await fetch("""
        SELECT d.notes
        FROM lawyer_documents d
        JOIN lawyer_cases c ON c.id=d.case_id
        WHERE c.lawyer_id=$1 AND c.cnr_number=$2
          AND COALESCE(d.notes,'') <> ''
        ORDER BY d.created_at DESC LIMIT 10
    """, int(user["id"]), cnr)
    details = await court_data_client.lookup_cnr(cnr)
    orders = await court_data_client.get_case_orders(cnr)
    stage = str(_pick(details, "stage", "currentStage", "caseStage") or tracked.get("stage") or "Not available")
    judge = str(_pick(details, "judge", "judgeName", "presidingJudge") or "")
    bench = str(_pick(details, "bench", "benchName", "coram") or "")
    brief_orders = []
    most_recent_orders = sorted((orders or []), key=_order_sort_key, reverse=True)[:3]
    for order in most_recent_orders:
        brief_orders.append({
            "date": _pick(order, "order_date", "date", "orderDate"),
            "title": _pick(order, "title", "order_title", "description"),
            "filename": _pick(order, "filename", "order_file", "fileName"),
            "url": _pick(order, "url", "link", "order_url"),
        })
    judge_view = {"status": "unavailable", "judgments": []}
    if judge and os.getenv("IK_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}:
        try:
            from routers.workspace import hearing_prep_judge_view
            judge_view = await hearing_prep_judge_view(
                judge=judge, bench=bench, topic=str(args.get("topic") or ""),
                user=user,
            )
        except Exception:
            judge_view = {"status": "unavailable", "judgments": []}
    case_metadata = {
        "cnr": cnr,
        "case_type": _pick(details, "case_type", "caseType") or tracked.get("case_type"),
        "court": _pick(details, "court", "court_name", "courtName") or tracked.get("court_name"),
        "parties": _pick(details, "parties", "petitioner", "petitionerName"),
        "filing_date": _pick(details, "filing_date", "filingDate"),
        "next_date": _pick(details, "next_date", "nextDate", "nextHearingDate"),
        "stage": stage,
        "judge": judge or None,
        "bench": bench or None,
    }
    data = {"case": case_metadata, "last_three_orders": brief_orders,
            "notes": [str(row.get("notes") or "")[:2000] for row in note_rows],
            "judge_bench_view": judge_view, "stage_checklist_suggestion": _checklist(stage),
            "no_predictions_or_judge_scoring": True}
    return _result(data, source="eCourtsIndia tracked-case data and cached Indian Kanoon judge view",
                   url="https://ecourts.gov.in", identifier=f"hearing-brief:{cnr}",
                   untrusted=True)


async def call_legal_tool(name: str, args: dict, user: dict) -> dict:
    if name == "verify_citation":
        return await _verify_citation(args)
    if name == "update_draft_sections":
        return _update_draft(args)
    if name == "hearing_brief":
        if user.get("mcp_plan") not in {"advocate_addon", "firm"}:
            raise PermissionError("hearing_brief requires the Advocate MCP add-on or Firm plan")
        return await _hearing_brief(args, user)
    raise LookupError(f"unknown legal MCP tool: {name}")
