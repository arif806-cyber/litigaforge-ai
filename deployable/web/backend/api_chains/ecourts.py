"""
eCourts India case lookup.
Searches by party name or case number via eCourts public API.
"""
import os
from .base import safe_post, safe_get

ECOURTS_API_BASE = "https://api.ecourts.gov.in/v1"


def fetch_ecourts(
    party_name: str = None,
    case_number: str = None,
    state_code: str = "TS",
    district_code: str = "01",
    **kwargs,
) -> dict:
    if not party_name and not case_number:
        return {"chain": "eCourts", "status": "skipped", "reason": "Provide party_name or case_number"}

    ecourts_key = os.getenv("ECOURTS_API_KEY", "")
    if not ecourts_key:
        return _mock_ecourts(party_name, case_number, state_code)

    headers = {"x-api-key": ecourts_key, "Content-Type": "application/json"}

    if party_name:
        result = safe_post(
            f"{ECOURTS_API_BASE}/cases/search/party",
            headers,
            {"party_name": party_name, "state_code": state_code, "district_code": district_code},
        )
    else:
        result = safe_get(
            f"{ECOURTS_API_BASE}/cases/{case_number}",
            headers,
            params={"state_code": state_code, "district_code": district_code},
        )

    if not result["success"]:
        return _mock_ecourts(party_name, case_number, state_code, fallback_reason=result["error"])

    data = result["data"]
    cases = data.get("cases", [])
    return {
        "chain": "eCourts",
        "status": "success",
        "search_term": party_name or case_number,
        "state": state_code,
        "total_cases": len(cases),
        "cases": _format_cases(cases),
    }


def _format_cases(cases: list) -> list:
    return [
        {
            "case_number": c.get("case_no", "N/A"),
            "case_type": c.get("case_type", "N/A"),
            "filing_date": c.get("filing_date", "N/A"),
            "next_hearing": c.get("next_hearing_date", "N/A"),
            "status": c.get("case_status", "Pending"),
            "court": c.get("court_name", "N/A"),
            "petitioner": c.get("petitioner_name", "N/A"),
            "respondent": c.get("respondent_name", "N/A"),
            "acts": c.get("acts", []),
        }
        for c in cases[:10]
    ]


def _mock_ecourts(party_name, case_number, state_code, fallback_reason=None) -> dict:
    return {
        "chain": "eCourts",
        "status": "mock",
        "search_term": party_name or case_number,
        "state": state_code,
        "total_cases": 2,
        "cases": [
            {
                "case_number": "RC/142/2024",
                "case_type": "Rent Control",
                "filing_date": "2024-03-15",
                "next_hearing": "2026-06-10",
                "status": "Pending",
                "court": "Principal Junior Civil Judge Court, Hyderabad",
                "petitioner": party_name or "Landlord",
                "respondent": "Tenant / Respondent",
                "acts": ["Telangana Buildings (Lease, Rent and Eviction) Control Act 1960"],
            },
            {
                "case_number": "GST/078/2025",
                "case_type": "GST Dispute",
                "filing_date": "2025-01-08",
                "next_hearing": "2026-07-22",
                "status": "Under Hearing",
                "court": "GST Appellate Authority, Telangana",
                "petitioner": party_name or "Applicant",
                "respondent": "GST Department",
                "acts": ["Central Goods and Services Tax Act 2017"],
            },
        ],
        "note": fallback_reason or "Mock data — set ECOURTS_API_KEY for live case lookup",
    }
