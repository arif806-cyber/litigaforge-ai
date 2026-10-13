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

_REPORTERS = r"(?:SCC|AIR|SCR|CRI\.?\s*L\.?\s*J\.?|ALL\s*ER|DLT|MAD\s*LJ|BOM\s*CR)"


def _citation_tokens(text: Any) -> dict | None:
    value = str(text or "")
    reporter = re.search(_REPORTERS, value, re.I)
    years = list(re.finditer(r"\b(?:18|19|20)\d{2}\b", value))
    if not reporter or not years:
        return None
    year = min(years, key=lambda match: abs(match.start() - reporter.start()))
    left_numbers = [(m.group(), m.start()) for m in re.finditer(r"\d+", value[:reporter.start()])
                    if not (m.start() <= year.start() < m.end())]
    right_numbers = [(m.group(), m.start() + reporter.end())
                     for m in re.finditer(r"\d+", value[reporter.end():])
                     if not (reporter.end() + m.start() <= year.start() < reporter.end() + m.end())]
    volume = left_numbers[-1][0] if left_numbers else None
    page = right_numbers[0][0] if right_numbers else (left_numbers[-1][0] if len(left_numbers) > 1 else None)
    reporter_key = re.sub(r"\W", "", reporter.group()).casefold()
    return {
        "year": year.group(),
        "reporter": reporter_key,
        "volume": volume,
        "page": page,
    }


def _case_key(text: Any) -> str:
    value = str(text or "")
    value = re.sub(r"\b(?:on|dated)\s+\d{1,2}\s+\w+\s+\d{4}\b.*$", "", value, flags=re.I)
    value = re.sub(r"\(?\b(?:18|19|20)\d{2}\b\)?\s*.*$", "", value)
    value = re.sub(_REPORTERS + r".*$", "", value, flags=re.I)
    value = re.sub(r"\bvs?\.?\b", "versus", value, flags=re.I)
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


def _compare_citation(query: str, *, title: Any = "", citation: Any = "",
                      court: Any = "", year: Any = None) -> tuple[str, list[str]]:
    candidate_text = " ".join(str(v or "") for v in (title, citation, year))
    input_tokens = _citation_tokens(query)
    candidate_tokens = _citation_tokens(candidate_text)
    name_matches = bool(_case_key(query) and _case_key(query) == _case_key(title))
    differences = []
    if input_tokens and candidate_tokens:
        for key, label in (("year", "year"), ("reporter", "reporter"),
                           ("volume", "volume"), ("page", "page")):
            left, right = input_tokens.get(key), candidate_tokens.get(key)
            if left and right and left != right:
                differences.append(f"{label} {left} vs {right}")
    if court:
        court_aliases = {
            "sc": "supreme court", "supreme court": "supreme court",
            "hc": "high court", "high court": "high court",
            "del": "delhi", "delhi": "delhi", "bom": "bombay", "bombay": "bombay",
            "mad": "madras", "madras": "madras",
        }
        input_court = next((v for k, v in court_aliases.items()
                            if re.search(rf"\b{re.escape(k)}\b", query, re.I)), None)
        candidate_court = next((v for k, v in court_aliases.items()
                                if k in str(court).casefold()), None)
        if input_court and candidate_court and input_court != candidate_court:
            differences.append("court differs")
    if input_tokens and candidate_tokens and input_tokens == candidate_tokens and not differences:
        return "exact", []
    if name_matches:
        if differences:
            return "likely", differences
        if input_tokens and candidate_tokens and input_tokens != candidate_tokens:
            return "likely", differences
        if input_tokens and not candidate_tokens:
            candidate_year = re.search(r"\b(?:18|19|20)\d{2}\b", candidate_text)
            if candidate_year and candidate_year.group() != input_tokens["year"]:
                differences.append(f"year {input_tokens['year']} vs {candidate_year.group()}")
            else:
                differences.append("citation details unavailable")
            return "likely", differences
        return "exact", []
    return "no_match", differences


def _extract_references(draft: str) -> list[dict]:
    act_pattern = r"(?:I\.?\s*P\.?\s*C\.?|Cr\.?\s*P\.?\s*C\.?|Evidence\s+Act)"
    refs = []
    patterns = (
        re.compile(rf"\b(?:sections?|u\s*/\s*s|s\.?)\s*(?P<sections>\d+[A-Z]?(?:\s*(?:,|and)\s*\d+[A-Z]?(?:-\w+)?)*)\s*(?:of\s+the\s+)?(?P<code>{act_pattern})\b", re.I),
        re.compile(rf"\b(?P<section>\d+[A-Z]?(?:-\w+)?)\s+(?P<code>{act_pattern})\b", re.I),
    )
    for pattern in patterns:
        for match in pattern.finditer(draft):
            code = re.sub(r"[.\s]", "", match.group("code")).casefold()
            if code.startswith("ipc"):
                code = "ipc"
            elif code.startswith("crpc"):
                code = "crpc"
            else:
                code = "evidence act"
            section_group = match.groupdict().get("sections") or match.groupdict().get("section") or ""
            for number in re.finditer(r"\d+[A-Z]?(?:-\w+)?", section_group, re.I):
                start = match.start("sections") + number.start() if "sections" in match.groupdict() and match.group("sections") else match.start("section") + number.start()
                refs.append({"code": code, "section": number.group(), "position": {"start": start, "end": start + len(number.group())}})
    refs.sort(key=lambda ref: ref["position"]["start"])
    seen = set()
    return [r for r in refs if not ((r["code"], r["section"], r["position"]["start"]) in seen or seen.add((r["code"], r["section"], r["position"]["start"])))]


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
        ORDER BY judgment_date DESC NULLS LAST LIMIT 20
    """, pattern)
    matches = []
    for row in local:
        candidate = dict(row)
        status, differences = _compare_citation(
            citation, title=candidate.get("case_name"), citation=candidate.get("citation"),
            court=candidate.get("court"), year=candidate.get("year"),
        )
        if status != "no_match":
            candidate["match_status"] = status
            candidate["differences"] = differences
            matches.append(candidate)
    exact_local = next((row for row in matches if row["match_status"] == "exact"), None)
    local_best = exact_local or next((row for row in matches if row["match_status"] == "likely"), None)
    item: dict[str, Any] = {
        "citation": citation,
        "local_matches": matches[:3],
        "exact_local_match": bool(exact_local),
        "match_status": local_best["match_status"] if local_best else "no_match",
        "differences": local_best.get("differences", []) if local_best else [],
        "indian_kanoon_verified": False,
        "fragments": [],
        "treatment": "not determinable from available source metadata",
    }
    ik_enabled = os.getenv("IK_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
    if not ik_enabled:
        item["indian_kanoon"] = "disabled by IK_ENABLED"
        item["status"] = item["match_status"] if matches else _NOT_FOUND
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
        comparisons = []
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            status, differences = _compare_citation(
                citation, title=doc.get("title"),
                citation=doc.get("citation") or doc.get("docsource"),
                court=doc.get("court") or doc.get("docsource"),
                year=doc.get("year") or doc.get("publishdate"),
            )
            comparisons.append((doc, status, differences))
        exact = next((entry for entry in comparisons if entry[1] == "exact"), None)
        likely = next((entry for entry in comparisons if entry[1] == "likely"), None)
        best = exact or likely
        candidate = best[0] if best else None
        if best:
            item["match_status"] = best[1]
            item["differences"] = best[2]
        elif exact_local:
            item["match_status"] = "exact"
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
        item["indian_kanoon_verified"] = bool(tid and item["match_status"] == "exact")
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
        item["status"] = item["match_status"] if item["match_status"] != "no_match" else _NOT_FOUND
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
    machine_fields = [
        (record.get("match_status", "no_match"), record.get("differences", []),
         record.get("status", _NOT_FOUND))
        for record in records
    ]
    estimated_cost = 0.0
    if os.getenv("IK_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}:
        from case_law_search import ik_endpoint_price_inr
        per_citation = ik_endpoint_price_inr("/search") + ik_endpoint_price_inr("/doc/0/")
        if include and proposition:
            per_citation += ik_endpoint_price_inr("/docfragment/0/")
        estimated_cost = float(per_citation) * len(values)
    result = _result({"citations": records, "metadata": {
        "estimated_cost_inr": round(estimated_cost, 2),
        "citation_count": len(values),
        "estimated_cost_basis": "uncached Indian Kanoon requests; cache hits may reduce actual spend",
    }}, source="LitigaForge judgment index and Indian Kanoon",
                     url="https://indiankanoon.org/", identifier="citation-verification",
                     untrusted=True)
    # Keep the contract's machine-readable status exact while all citation
    # source strings remain fenced as untrusted source material.
    for record, (match_status, differences, status) in zip(result["data"]["citations"], machine_fields):
        record["match_status"] = match_status
        record["differences"] = differences
        record["status"] = status
        treatment = record.get("treatment")
        if isinstance(treatment, str) and "not determinable from available source metadata" in treatment:
            record["treatment"] = "not determinable from available source metadata"
    return result


def _update_draft(args: dict) -> dict:
    draft = args.get("draft")
    refs = args.get("references")
    if not isinstance(draft, str) or len(draft) > 30000:
        raise ValueError("draft must be a string of at most 30000 characters")
    if refs is None:
        refs = _extract_references(draft)
    if not isinstance(refs, list) or len(refs) > 100:
        raise ValueError("references must contain at most 100 section references")
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
            roots = {str(section).split("(")[0] for section in mapped}
            merged_sources = set()
            for old_section, values in reverse.items():
                vals = values if isinstance(values, list) else [values]
                if any(str(value).split("(")[0] in roots for value in vals):
                    merged_sources.add(str(old_section))
            merged = len(merged_sources) > 1
            state = "split" if len(mapped) > 1 else "merged" if merged else "changed" if mapped[0] != section else "same-number mapping"
        result = {"code": ref["code"], "section": section, "status": state,
                  "new_code": new_code, "suggested_sections": mapped,
                  "legacy_note": legacy_note, "requires_advocate_review": True}
        if isinstance(ref.get("position"), dict):
            result["position"] = ref["position"]
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


async def _reviewer_hearing_brief(args: dict, user: dict) -> dict:
    """Return a factual brief using only the fictional reviewer fixtures."""
    cnr = str(args.get("cnr") or "").replace(" ", "").upper()
    if not cnr or len(cnr) > 20:
        raise ValueError("A valid demo CNR is required")
    row = await fetchrow("""
        SELECT cnr,case_type,court_name,status,next_date,stage,sample_order
        FROM mcp_reviewer_demo_cases WHERE user_id=$1 AND cnr=$2
    """, int(user["id"]), cnr)
    if not row:
        raise ValueError("Reviewer hearing briefs are limited to the supplied fictional demo matters")
    data = {
        "case": {
            "cnr": row["cnr"], "case_type": row["case_type"], "court": row["court_name"],
            "status": row["status"], "next_date": str(row["next_date"]) if row["next_date"] else None,
            "stage": row["stage"], "fictional_demo": True,
        },
        "last_three_orders": [{"date": None, "title": "Fictional sample order",
                              "text": row["sample_order"], "fictional_demo": True}],
        "notes": [], "judge_bench_view": {"status": "unavailable", "judgments": []},
        "stage_checklist_suggestion": _checklist(str(row["stage"])),
        "no_predictions_or_judge_scoring": True,
        "fictional_demo": True,
    }
    return _result(data, source="LitigaForge fictional Reviewer demo data", url=None,
                   identifier=f"hearing-brief:{cnr}", untrusted=True)


async def call_legal_tool(name: str, args: dict, user: dict) -> dict:
    if name == "verify_citation":
        return await _verify_citation(args)
    if name == "update_draft_sections":
        return _update_draft(args)
    if name == "hearing_brief":
        if user.get("mcp_plan") == "reviewer":
            return await _reviewer_hearing_brief(args, user)
        if user.get("mcp_plan") not in {"advocate_addon", "firm"}:
            raise PermissionError("hearing_brief requires the Advocate MCP add-on or Firm plan")
        return await _hearing_brief(args, user)
    raise LookupError(f"unknown legal MCP tool: {name}")
