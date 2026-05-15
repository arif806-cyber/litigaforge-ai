"""
RapidAPI — RTO Vehicle Details  (rto-vehicle-details.p.rapidapi.com)
Real VAHAN data: owner name, RC status, insurance, chassis, fitness, hypothecation.

API listing : https://rapidapi.com/flashbomberapp/api/rto-vehicle-details
Endpoint    : POST /api4
Body        : {"reg": "TS13EZ9523"}
Headers     : x-rapidapi-key, x-rapidapi-host

Free tier: subscribe at rapidapi.com (free plan) — key works immediately after subscribe.
Data source: VAHAN (Ministry of Road Transport & Highways)
Coverage   : All India — TS, AP, MH, DL, KA, TN, etc.
"""
import os
import logging
import requests

logger = logging.getLogger("litigaforge.chain.rapidapi_vehicle")

RAPIDAPI_HOST = "rto-vehicle-details.p.rapidapi.com"
RAPIDAPI_URL  = f"https://{RAPIDAPI_HOST}/api4"


def _headers() -> dict:
    return {
        "x-rapidapi-key":  os.getenv("RAPIDAPI_KEY", ""),
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type":    "application/json",
    }


def _parse_response(data: dict, reg_no: str) -> dict:
    """Normalise whatever the API returns into our standard chain schema."""
    d = data if isinstance(data, dict) else {}

    def _get(*keys):
        for k in keys:
            if d.get(k) not in (None, "", "NA", "N/A"):
                return d[k]
        return "—"

    return {
        "chain":               "VEHICLE_RC",
        "status":              "success",
        "data_source":         "RapidAPI / VAHAN (Ministry of Road Transport & Highways)",
        "registration_number": _get("regNo", "reg_no", "vehicleNo") or reg_no,
        "owner_name":          _get("ownerName", "owner_name", "owner"),
        "father_name":         _get("fatherName", "father_name"),
        "address":             _get("presentAddress", "permanentAddress", "address"),
        "maker_model":         (_get("maker", "make") + " / " + _get("makerModal", "model", "vehicleModel")).strip(" /"),
        "vehicle_class":       _get("vehicleClass", "vehicle_class", "class"),
        "body_type":           _get("bodyType", "body_type"),
        "fuel_type":           _get("fuelType", "fuel_type"),
        "colour":              _get("vehicleColor", "colour", "color"),
        "seating_capacity":    _get("passengerCapacity", "seating_capacity", "seatingCapacity"),
        "manufacturing_year":  _get("manufacturingYear", "mfg_year", "manufacturedYear"),
        "chassis_number":      _get("chassisNo", "chassis_no", "chassisNumber"),
        "engine_number":       _get("engineNo", "engine_no", "engineNumber"),
        "registration_date":   _get("regDate", "reg_date", "registrationDate"),
        "registration_upto":   _get("regUpto", "reg_upto", "regValidUpto"),
        "fitness_upto":        _get("fitnessUpto", "fitness_upto", "fitnessValidUpto"),
        "tax_upto":            _get("taxUpto", "tax_upto"),
        "insurance_company":   _get("insCompany", "insurance_company", "insuranceCompany"),
        "insurance_upto":      _get("insUpto", "insurance_upto", "insuranceValidUpto"),
        "hypothecation":       _get("financier", "hypothecation") or None,
        "blacklist_status":    _get("blacklistStatus", "blacklist") or "Not Blacklisted",
        "noc_details":         _get("nocDetails") or None,
        "rto":                 _get("rto", "rtoName", "rtoCode"),
        "state":               _get("state", "stateCode"),
        "rc_status":           _get("viStatus", "rcStatus", "status") or "ACTIVE",
        "emission_norms":      _get("fuelNorms", "emission_norms", "emissionNorms"),
        "raw":                 d,
        "legal_relevance": {
            "ownership_verified": True,
            "insurance_valid":    _get("insUpto", "insurance_upto") != "—",
            "fitness_valid":      _get("fitnessUpto", "fitness_upto") != "—",
            "has_hypothecation":  _get("financier", "hypothecation") != "—",
            "notes": (
                "RC verified via VAHAN / Ministry of Road Transport & Highways. "
                "Proves vehicle ownership in accident claims (MACT), loan/finance disputes, "
                "attachment proceedings, and stolen vehicle recovery. "
                "Insurance validity is critical for third-party liability (MV Act S.146)."
            ),
        },
    }


def lookup_vehicle_rc(reg_no: str) -> dict:
    """
    Look up a real vehicle RC from VAHAN via RapidAPI.
    Requires RAPIDAPI_KEY env var. Returns a clear error dict if key is missing.
    """
    api_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not api_key:
        return {
            "chain":               "VEHICLE_RC",
            "status":              "no_api_key",
            "registration_number": reg_no,
            "error":               "RAPIDAPI_KEY not set",
            "note": (
                "Add your free RapidAPI key to get real vehicle data. "
                "Go to rapidapi.com → search 'RTO Vehicle Details' → "
                "subscribe (free) → copy API key → add as RAPIDAPI_KEY secret in Replit."
            ),
        }

    reg_no_clean = reg_no.upper().replace(" ", "").replace("-", "")
    logger.info(f"[RAPIDAPI_VEHICLE] Fetching RC for {reg_no_clean}")

    try:
        resp = requests.post(
            RAPIDAPI_URL,
            headers=_headers(),
            json={"reg": reg_no_clean},
            timeout=15,
        )
        logger.info(f"[RAPIDAPI_VEHICLE] HTTP {resp.status_code} for {reg_no_clean}")

        if resp.status_code == 200:
            data = resp.json()
            if data.get("success") is False or data.get("status") == 0 or data.get("message"):
                return {
                    "chain":               "VEHICLE_RC",
                    "status":              "not_found",
                    "registration_number": reg_no_clean,
                    "error":               data.get("message") or "Vehicle not found in VAHAN",
                    "note":                "Check the registration number format (e.g. TS13EZ9523).",
                }
            return _parse_response(data, reg_no_clean)

        if resp.status_code in (401, 403):
            return {
                "chain":               "VEHICLE_RC",
                "status":              "auth_failed",
                "registration_number": reg_no_clean,
                "error":               f"HTTP {resp.status_code} — {resp.json().get('message', 'Auth failed')}",
                "note": (
                    "Either the key is wrong, or you haven't subscribed to 'RTO Vehicle Details' on RapidAPI yet. "
                    "Go to rapidapi.com → search 'RTO Vehicle Details' (flashbomberapp) → click Subscribe."
                ),
            }

        if resp.status_code == 429:
            return {
                "chain":               "VEHICLE_RC",
                "status":              "rate_limited",
                "registration_number": reg_no_clean,
                "error":               "Free tier daily/minute limit reached",
                "note":                "Wait a moment and retry, or upgrade plan at rapidapi.com.",
            }

        return {
            "chain":               "VEHICLE_RC",
            "status":              "api_error",
            "registration_number": reg_no_clean,
            "error":               f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    except requests.exceptions.Timeout:
        return {"chain": "VEHICLE_RC", "status": "timeout", "registration_number": reg_no, "error": "RapidAPI request timed out"}
    except Exception as e:
        logger.error(f"[RAPIDAPI_VEHICLE] Exception: {e}")
        return {"chain": "VEHICLE_RC", "status": "error", "registration_number": reg_no, "error": str(e)}
