"""
VAHAN vehicle registration lookup via API Setu / NIC.
Fetches vehicle owner, RC status, insurance, fitness, and tax validity.
"""
import os
import re
from .base import api_setu_headers, safe_post, API_SETU_BASE


def fetch_vahan(vehicle_number: str = None, **kwargs) -> dict:
    if not vehicle_number:
        return {"chain": "VAHAN", "status": "skipped", "reason": "No vehicle registration number provided"}

    vehicle_number = re.sub(r"\s+", "", vehicle_number).upper()

    if not os.getenv("API_SETU_KEY"):
        return {
            "chain": "VAHAN",
            "status": "mock",
            "vehicle_number": vehicle_number,
            "owner_name": "RAMESH REDDY",
            "vehicle_class": "Motor Car",
            "fuel_type": "Petrol",
            "maker_model": "Maruti Suzuki Swift",
            "registration_date": "2020-05-10",
            "registration_valid_upto": "2035-05-09",
            "insurance_valid_upto": "2026-11-30",
            "fitness_valid_upto": "2035-05-09",
            "tax_valid_upto": "2027-03-31",
            "rc_status": "Active",
            "blacklist_status": "Not Blacklisted",
            "note": "Mock data — set API_SETU_KEY for live VAHAN lookup",
        }

    url = f"{API_SETU_BASE}/vahan/rc/details"
    result = safe_post(url, api_setu_headers(), {"vehicle_registration_number": vehicle_number})

    if not result["success"]:
        return {"chain": "VAHAN", "status": "error", "vehicle_number": vehicle_number, "detail": result["error"]}

    data = result["data"]
    return {
        "chain": "VAHAN",
        "status": "success",
        "vehicle_number": vehicle_number,
        "owner_name": data.get("owner_name", "N/A"),
        "vehicle_class": data.get("vehicle_class_desc", "N/A"),
        "fuel_type": data.get("fuel_desc", "N/A"),
        "maker_model": f"{data.get('maker_desc', '')} {data.get('model_desc', '')}".strip(),
        "registration_date": data.get("registration_date", "N/A"),
        "registration_valid_upto": data.get("reg_valid_upto", "N/A"),
        "insurance_valid_upto": data.get("insurance_upto", "N/A"),
        "rc_status": data.get("rc_status", "Unknown"),
        "blacklist_status": data.get("blacklist_status", "Unknown"),
        "raw": data,
    }
