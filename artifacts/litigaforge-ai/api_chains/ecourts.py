"""
eCourts India — Live Partner API Integration
https://webapi.ecourtsindia.com
Bearer token auth via ECOURTS_API_KEY env var.

Endpoints used:
- GET /api/partner/case/{cnr}         — Case detail by CNR
- GET /api/partner/search            — Full-text case search
- POST /api/partner/case/{cnr}/refresh — Refresh case data
"""
import os
import requests

API_BASE = "https://webapi.ecourtsindia.com"


def _headers():
    token = os.getenv("ECOURTS_API_KEY", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _safe_get(path: str, params: dict = None, timeout: int = 20) -> dict:
    url = f"{API_BASE}{path}"
    try:
        resp = requests.get(url, headers=_headers(), params=params, timeout=timeout)
        if resp.status_code == 404:
            return {"success": False, "error": f"Case not found ({path})", "data": None}
        if resp.status_code == 401:
            return {"success": False, "error": "Invalid or expired eCourts API token", "data": None}
        if resp.status_code == 429:
            return {"success": False, "error": "Rate limited by eCourts API", "data": None}
        resp.raise_for_status()
        return {"success": True, "error": None, "data": resp.json()}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "eCourts API timed out", "data": None}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to eCourts API", "data": None}
    except Exception as e:
        return {"success": False, "error": str(e)[:200], "data": None}


def _safe_post(path: str, payload: dict = None, timeout: int = 20) -> dict:
    url = f"{API_BASE}{path}"
    try:
        resp = requests.post(url, headers=_headers(), json=payload or {}, timeout=timeout)
        if resp.status_code == 401:
            return {"success": False, "error": "Invalid or expired eCourts API token", "data": None}
        resp.raise_for_status()
        return {"success": True, "error": None, "data": resp.json()}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "eCourts API timed out", "data": None}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to eCourts API", "data": None}
    except Exception as e:
        return {"success": False, "error": str(e)[:200], "data": None}


def fetch_ecourts(
    party_name: str = None,
    case_number: str = None,
    state_code: str = "TS",
    district_code: str = None,
    cnr: str = None,
    **kwargs,
) -> dict:
    """
    Fetch case data from eCourts India live API.

    Priority:
      1. If CNR is provided → fetch case detail directly
      2. If party_name or case_number → search API
      3. Fallback → mock data with reason
    """
    token = os.getenv("ECOURTS_API_KEY", "")
    if not token:
        return _mock_ecourts(party_name, case_number, cnr, reason="ECOURTS_API_KEY not configured")

    # 1. Direct CNR lookup (most specific)
    if cnr:
        cnr = cnr.strip().upper()
        result = _safe_get(f"/api/partner/case/{cnr}", timeout=25)
        if result["success"]:
            return _format_case_detail(result["data"], cnr=cnr)
        # If case not found, try refreshing then retry once
        if "not found" in (result.get("error") or "").lower():
            _safe_post(f"/api/partner/case/{cnr}/refresh", timeout=15)
            result = _safe_get(f"/api/partner/case/{cnr}", timeout=25)
            if result["success"]:
                return _format_case_detail(result["data"], cnr=cnr)
        return _mock_ecourts(party_name, case_number, cnr, reason=result.get("error"))

    # 2. Search by party name or case number
    if not party_name and not case_number:
        return {"chain": "eCourts", "status": "skipped", "reason": "Provide party_name, case_number, or cnr"}

    params = {"pageSize": 10, "page": 1}
    if party_name:
        params["query"] = party_name
    if case_number:
        params["query"] = case_number
    if state_code:
        params["stateCodes"] = state_code.upper()

    result = _safe_get("/api/partner/search", params=params, timeout=20)
    if result["success"]:
        return _format_search_results(result["data"], query=party_name or case_number)

    return _mock_ecourts(party_name, case_number, cnr, reason=result.get("error"))


def _format_case_detail(raw: dict, cnr: str) -> dict:
    """Format a single case detail response from eCourts API."""
    data = raw.get("data", {})
    court_data = data.get("courtCaseData", {})
    entity = data.get("entityInfo", {})

    # Extract hearing history
    history = court_data.get("historyOfCaseHearings", []) or []
    formatted_history = [
        {
            "date": h.get("businessOnDate", ""),
            "judge": h.get("judge", ""),
            "purpose": h.get("purposeOfListing", ""),
            "next_date": h.get("hearingDate", ""),
        }
        for h in history[:20]
    ]

    # Extract petitioners / respondents
    petitioners = court_data.get("petitioners", []) or []
    respondents = court_data.get("respondents", []) or []

    # Extract orders
    orders = (court_data.get("interimOrders", []) or []) + (court_data.get("judgmentOrders", []) or [])
    formatted_orders = [
        {
            "date": o.get("orderDate", ""),
            "description": o.get("description", ""),
            "url": o.get("orderUrl", ""),
        }
        for o in orders[:10]
    ]

    return {
        "chain": "eCourts",
        "status": "live",
        "cnr": cnr,
        "case_number": court_data.get("caseNumber", ""),
        "case_type": court_data.get("caseType", ""),
        "case_type_description": court_data.get("caseTypeSub", ""),
        "status": court_data.get("caseStatus", ""),
        "filing_date": court_data.get("filingDate", ""),
        "registration_date": court_data.get("registrationDate", ""),
        "first_hearing": court_data.get("firstHearingDate", ""),
        "last_hearing": court_data.get("lastHearingDate", ""),
        "next_hearing": court_data.get("nextHearingDate", ""),
        "decision_date": court_data.get("decisionDate", ""),
        "disposal_type": court_data.get("disposalTypeRaw", ""),
        "contested_status": court_data.get("contestedStatus", ""),
        "purpose": court_data.get("purpose", ""),
        "state": court_data.get("state", ""),
        "district": court_data.get("district", ""),
        "court": court_data.get("courtName", ""),
        "filing_number": court_data.get("filingNumber", ""),
        "registration_number": court_data.get("registrationNumber", ""),
        "petitioners": petitioners,
        "respondents": respondents,
        "petitioner_advocates": court_data.get("petitionerAdvocates", []) or [],
        "respondent_advocates": court_data.get("respondentAdvocates", []) or [],
        "hearing_history": formatted_history,
        "orders": formatted_orders,
        "has_orders": court_data.get("hasOrders", False),
        "has_judgments": court_data.get("hasJudgments", False),
        "order_count": court_data.get("orderCount", 0),
        "hearing_count": court_data.get("hearingCount", 0),
        "ia_count": court_data.get("iaCount", 0),
        "case_duration_days": court_data.get("caseDurationDays", 0),
        "case_category": court_data.get("caseCategoryFacetPath", ""),
        "request_id": raw.get("meta", {}).get("request_id", ""),
    }


def _format_search_results(raw: dict, query: str) -> dict:
    """Format search results from eCourts API."""
    data = raw.get("data", {})
    results = data.get("results", []) or []
    facets = data.get("facets", {})

    formatted = [
        {
            "cnr": r.get("cnr", ""),
            "case_type": r.get("caseType", ""),
            "status": r.get("caseStatus", ""),
            "filing_date": r.get("filingDate", ""),
            "next_hearing": r.get("nextHearingDate", ""),
            "decision_date": r.get("decisionDate", ""),
            "court": r.get("courtCode", ""),
            "judges": r.get("judges", []) or [],
            "petitioners": r.get("petitioners", []) or [],
            "respondents": r.get("respondents", []) or [],
            "petitioner_advocates": r.get("petitionerAdvocates", []) or [],
            "acts": r.get("actsAndSections", []) or [],
            "case_category": r.get("caseCategory", ""),
            "ai_keywords": r.get("aiKeywords", []) or [],
        }
        for r in results[:10]
    ]

    return {
        "chain": "eCourts",
        "status": "live",
        "mode": "search",
        "query": query,
        "total_hits": data.get("totalHits", 0),
        "page": data.get("page", 1),
        "page_size": data.get("pageSize", 20),
        "total_pages": data.get("totalPages", 0),
        "has_next": data.get("hasNextPage", False),
        "cases": formatted,
        "facets": facets,
        "processing_time_ms": data.get("processingTimeMs", 0),
        "request_id": raw.get("meta", {}).get("request_id", ""),
    }


def _mock_ecourts(party_name, case_number, cnr, reason="") -> dict:
    """Fallback mock data when live API fails or is unavailable."""
    return {
        "chain": "eCourts",
        "status": "mock",
        "search_term": party_name or case_number or cnr,
        "cnr": cnr,
        "cases": [
            {
                "case_number": "RC/142/2024",
                "case_type": "CC",
                "filing_date": "2024-03-15",
                "next_hearing": "2026-06-10",
                "status": "PENDING",
                "court": "Principal Junior Civil Judge Court, Hyderabad",
                "petitioners": [party_name or "Landlord"],
                "respondents": ["Tenant / Respondent"],
                "acts": ["Telangana Buildings (Lease, Rent and Eviction) Control Act 1960"],
            },
            {
                "case_number": "GST/078/2025",
                "case_type": "GST",
                "filing_date": "2025-01-08",
                "next_hearing": "2026-07-22",
                "status": "PENDING",
                "court": "GST Appellate Authority, Telangana",
                "petitioners": [party_name or "Applicant"],
                "respondents": ["GST Department"],
                "acts": ["Central Goods and Services Tax Act 2017"],
            },
        ],
        "note": reason or "Mock data — eCourts API unavailable",
    }
