"""
GSTIN lookup via API Setu.
Fetches GST registration status, filing history, and business details.
"""
import os
from .base import api_setu_headers, safe_post, API_SETU_BASE


def fetch_gstin(gstin: str = None, **kwargs) -> dict:
    if not gstin:
        return {"chain": "GSTIN", "status": "skipped", "reason": "No GSTIN provided"}

    gstin = gstin.strip().upper()
    if len(gstin) != 15:
        return {"chain": "GSTIN", "status": "error", "reason": f"Invalid GSTIN format: {gstin}"}

    if not os.getenv("API_SETU_KEY"):
        return {
            "chain": "GSTIN",
            "status": "mock",
            "gstin": gstin,
            "legal_name": "SAMPLE BUSINESS PVT LTD",
            "trade_name": "SampleBiz",
            "registration_status": "Active",
            "taxpayer_type": "Regular",
            "state": "Telangana",
            "last_return_filed": "March 2026",
            "pending_returns": 0,
            "note": "Mock data — set API_SETU_KEY for live lookup",
        }

    url = f"{API_SETU_BASE}/gst/search"
    result = safe_post(url, api_setu_headers(), {"gstin": gstin})

    if not result["success"]:
        return {"chain": "GSTIN", "status": "error", "gstin": gstin, "detail": result["error"]}

    data = result["data"]
    return {
        "chain": "GSTIN",
        "status": "success",
        "gstin": gstin,
        "legal_name": data.get("lgnm", "N/A"),
        "trade_name": data.get("tradeNam", "N/A"),
        "registration_status": data.get("sts", "Unknown"),
        "taxpayer_type": data.get("dty", "Unknown"),
        "state": data.get("stj", "Unknown"),
        "registration_date": data.get("rgdt", "Unknown"),
        "last_return_filed": data.get("lstupdt", "Unknown"),
        "raw": data,
    }
