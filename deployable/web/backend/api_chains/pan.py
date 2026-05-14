"""
PAN verification via API Setu.
Verifies PAN validity, links to name and date of birth.
"""
import os
from .base import api_setu_headers, safe_post, API_SETU_BASE


def fetch_pan(pan: str = None, name: str = None, dob: str = None, **kwargs) -> dict:
    if not pan:
        return {"chain": "PAN", "status": "skipped", "reason": "No PAN provided"}

    pan = pan.strip().upper()
    if len(pan) != 10:
        return {"chain": "PAN", "status": "error", "reason": f"Invalid PAN format: {pan}"}

    if not os.getenv("API_SETU_KEY"):
        return {
            "chain": "PAN",
            "status": "mock",
            "pan": pan,
            "name_on_pan": name or "RAMESH REDDY",
            "pan_type": "Individual",
            "verified": True,
            "aadhaar_seeded": True,
            "note": "Mock data — set API_SETU_KEY for live lookup",
        }

    url = f"{API_SETU_BASE}/kyc/pan/verify"
    payload = {"pan": pan}
    if name:
        payload["name"] = name
    if dob:
        payload["date_of_birth"] = dob

    result = safe_post(url, api_setu_headers(), payload)
    if not result["success"]:
        return {"chain": "PAN", "status": "error", "pan": pan, "detail": result["error"]}

    data = result["data"]
    return {
        "chain": "PAN",
        "status": "success",
        "pan": pan,
        "name_on_pan": data.get("name", "N/A"),
        "pan_type": data.get("type", "Unknown"),
        "verified": data.get("valid", False),
        "aadhaar_seeded": data.get("aadhaar_seeding_status", False),
        "raw": data,
    }
