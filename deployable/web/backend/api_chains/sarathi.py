"""
SARATHI driving licence lookup via API Setu / NIC.
Fetches licence holder details, validity, and vehicle classes.
"""
import os
from .base import api_setu_headers, safe_post, API_SETU_BASE


def fetch_sarathi(dl_number: str = None, dob: str = None, **kwargs) -> dict:
    if not dl_number:
        return {"chain": "SARATHI", "status": "skipped", "reason": "No driving licence number provided"}

    dl_number = dl_number.strip().upper()

    if not os.getenv("API_SETU_KEY"):
        return {
            "chain": "SARATHI",
            "status": "mock",
            "dl_number": dl_number,
            "holder_name": "RAMESH REDDY",
            "dob": dob or "1985-06-15",
            "issue_date": "2010-08-20",
            "valid_from": "2010-08-20",
            "valid_to": "2030-08-19",
            "vehicle_classes": ["LMV", "MCWG"],
            "issuing_rto": "HYDERABAD WEST RTO",
            "dl_status": "Valid",
            "blood_group": "B+",
            "note": "Mock data — set API_SETU_KEY for live SARATHI lookup",
        }

    url = f"{API_SETU_BASE}/sarathi/dl/details"
    payload = {"dl_number": dl_number}
    if dob:
        payload["date_of_birth"] = dob

    result = safe_post(url, api_setu_headers(), payload)
    if not result["success"]:
        return {"chain": "SARATHI", "status": "error", "dl_number": dl_number, "detail": result["error"]}

    data = result["data"]
    return {
        "chain": "SARATHI",
        "status": "success",
        "dl_number": dl_number,
        "holder_name": data.get("name", "N/A"),
        "dob": data.get("dob", "N/A"),
        "valid_from": data.get("valid_from", "N/A"),
        "valid_to": data.get("valid_to", "N/A"),
        "vehicle_classes": data.get("vehicle_classes", []),
        "issuing_rto": data.get("rto_name", "N/A"),
        "dl_status": data.get("dl_status", "Unknown"),
        "blood_group": data.get("blood_group", "N/A"),
        "raw": data,
    }
