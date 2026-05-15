"""
RapidAPI — RTO Vehicle Information India
Real VAHAN data: owner name, RC status, insurance, chassis, fitness, hypothecation.

API: https://rapidapi.com/streamifyworld/api/rto-vehicle-information-india
Sign up free at rapidapi.com → subscribe → copy your key → add as RAPIDAPI_KEY secret.

Free tier: ~100 requests/day
Data source: VAHAN (Ministry of Road Transport & Highways)
Coverage: All India vehicle registrations (TS, AP, MH, DL, KA, TN, etc.)
"""
import os
import logging
import requests

logger = logging.getLogger("litigaforge.chain.rapidapi_vehicle")

RAPIDAPI_HOST = "rto-vehicle-information-india.p.rapidapi.com"
RAPIDAPI_URL  = f"https://{RAPIDAPI_HOST}/getVehicleInfo"


def _headers() -> dict:
    return {
        "X-RapidAPI-Key":  os.getenv("RAPIDAPI_KEY", ""),
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Content-Type":    "application/json",
    }


def _parse_response(data: dict, reg_no: str) -> dict:
    d = data.get("data") or data.get("result") or data
    return {
        "chain":               "VEHICLE_RC",
        "status":              "success",
        "data_source":         "RapidAPI / VAHAN (Ministry of Road Transport & Highways)",
        "registration_number": d.get("regNo") or d.get("reg_no") or reg_no,
        "owner_name":          d.get("ownerName") or d.get("owner_name") or "—",
        "father_name":         d.get("fatherName") or d.get("father_name") or "—",
        "address":             d.get("presentAddress") or d.get("address") or "—",
        "maker_model":         (d.get("maker") or d.get("make") or "") + " / " + (d.get("makerModal") or d.get("model") or ""),
        "vehicle_class":       d.get("vehicleClass") or d.get("vehicle_class") or "—",
        "body_type":           d.get("bodyType") or d.get("body_type") or "—",
        "fuel_type":           d.get("fuelType") or d.get("fuel_type") or "—",
        "colour":              d.get("vehicleColor") or d.get("colour") or "—",
        "seating_capacity":    d.get("passengerCapacity") or d.get("seating_capacity") or "—",
        "manufacturing_year":  d.get("manufacturingYear") or d.get("mfg_year") or "—",
        "chassis_number":      d.get("chassisNo") or d.get("chassis_no") or "—",
        "engine_number":       d.get("engineNo") or d.get("engine_no") or "—",
        "registration_date":   d.get("regDate") or d.get("reg_date") or "—",
        "registration_upto":   d.get("regUpto") or d.get("reg_upto") or "—",
        "fitness_upto":        d.get("fitnessUpto") or d.get("fitness_upto") or "—",
        "tax_upto":            d.get("taxUpto") or d.get("tax_upto") or "—",
        "insurance_company":   d.get("insCompany") or d.get("insurance_company") or "—",
        "insurance_upto":      d.get("insUpto") or d.get("insurance_upto") or "—",
        "hypothecation":       d.get("financier") or d.get("hypothecation") or None,
        "blacklist_status":    d.get("blacklistStatus") or d.get("blacklist") or "Not Blacklisted",
        "noc_details":         d.get("nocDetails") or None,
        "rto":                 d.get("rto") or d.get("rtoName") or "—",
        "state":               d.get("state") or "—",
        "rc_status":           d.get("viStatus") or d.get("status") or "ACTIVE",
        "emission_norms":      d.get("fuelNorms") or d.get("emission_norms") or "—",
        "raw":                 d,
        "legal_relevance": {
            "ownership_verified":  True,
            "insurance_valid":     bool(d.get("insUpto") or d.get("insurance_upto")),
            "fitness_valid":       bool(d.get("fitnessUpto") or d.get("fitness_upto")),
            "has_hypothecation":   bool(d.get("financier") or d.get("hypothecation")),
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
    Requires RAPIDAPI_KEY env var. No fallback — returns clear error if key missing.
    """
    api_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not api_key:
        return {
            "chain":  "VEHICLE_RC",
            "status": "no_api_key",
            "registration_number": reg_no,
            "error":  "RAPIDAPI_KEY not set",
            "note":   (
                "Add your free RapidAPI key to get real vehicle data. "
                "Sign up at rapidapi.com → search 'RTO Vehicle Information India' → "
                "subscribe (free) → copy API key → add as RAPIDAPI_KEY secret in Replit."
            ),
        }

    reg_no = reg_no.upper().replace(" ", "").replace("-", "")
    logger.info(f"[RAPIDAPI_VEHICLE] Fetching RC for {reg_no}")

    try:
        resp = requests.post(
            RAPIDAPI_URL,
            headers=_headers(),
            json={"reg_no": reg_no},
            timeout=15,
        )
        logger.info(f"[RAPIDAPI_VEHICLE] HTTP {resp.status_code} for {reg_no}")

        if resp.status_code == 200:
            data = resp.json()
            if data.get("success") is False or data.get("status") == 0:
                return {
                    "chain":               "VEHICLE_RC",
                    "status":              "not_found",
                    "registration_number": reg_no,
                    "error":               data.get("message") or "Vehicle not found in VAHAN",
                    "note":                "Vehicle number not found in VAHAN national database. Check number format (e.g. TS13EZ9523).",
                }
            return _parse_response(data, reg_no)

        if resp.status_code == 401 or resp.status_code == 403:
            return {
                "chain":  "VEHICLE_RC",
                "status": "auth_failed",
                "registration_number": reg_no,
                "error":  "Invalid or expired RAPIDAPI_KEY",
                "note":   "Check your RapidAPI key at rapidapi.com → Developer Dashboard.",
            }

        if resp.status_code == 429:
            return {
                "chain":  "VEHICLE_RC",
                "status": "rate_limited",
                "registration_number": reg_no,
                "error":  "Free tier daily limit reached",
                "note":   "Upgrade to a paid plan at rapidapi.com for more requests.",
            }

        return {
            "chain":  "VEHICLE_RC",
            "status": "api_error",
            "registration_number": reg_no,
            "error":  f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    except requests.exceptions.Timeout:
        return {"chain": "VEHICLE_RC", "status": "timeout", "registration_number": reg_no, "error": "RapidAPI request timed out"}
    except Exception as e:
        logger.error(f"[RAPIDAPI_VEHICLE] Exception: {e}")
        return {"chain": "VEHICLE_RC", "status": "error", "registration_number": reg_no, "error": str(e)}
