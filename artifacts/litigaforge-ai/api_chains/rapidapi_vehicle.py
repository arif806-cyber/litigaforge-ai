"""
RapidAPI — RTO Vehicle Information India  (Eccentric Labs)
  Host    : rto-vehicle-information-india.p.rapidapi.com
  RC Info : POST /getVehicleInfo
  Challans: POST /getVehicleChallan

Body format:
  {
    "vehicle_no":   "TS13EZ9523",
    "consent":      "Y",
    "consent_text": "I hereby give my consent for Eccentric Labs API to fetch my information"
  }

Free tier — subscribe at:
  https://rapidapi.com/streamifyworld/api/rto-vehicle-information-india
Data source: VAHAN (Ministry of Road Transport & Highways) — all India coverage.
"""
import os
import logging
import requests

logger = logging.getLogger("litigaforge.chain.rapidapi_vehicle")

RAPIDAPI_HOST    = "rto-vehicle-information-india.p.rapidapi.com"
RC_URL           = f"https://{RAPIDAPI_HOST}/getVehicleInfo"
CHALLAN_URL      = f"https://{RAPIDAPI_HOST}/getVehicleChallan"
CONSENT_TEXT     = "I hereby give my consent for Eccentric Labs API to fetch my information"


def _headers() -> dict:
    return {
        "x-rapidapi-key":  os.getenv("RAPIDAPI_KEY", ""),
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type":    "application/json",
    }


def _body(vehicle_no: str) -> dict:
    return {
        "vehicle_no":   vehicle_no.upper().replace(" ", "").replace("-", ""),
        "consent":      "Y",
        "consent_text": CONSENT_TEXT,
    }


def _get(*keys, d: dict):
    for k in keys:
        v = d.get(k)
        if v not in (None, "", "NA", "N/A", "null", 0):
            return v
    return "—"


def _parse_rc(data: dict, reg_no: str) -> dict:
    d = data.get("result") or data.get("data") or data
    if isinstance(d, list) and d:
        d = d[0]
    return {
        "chain":               "VEHICLE_RC",
        "status":              "success",
        "data_source":         "RapidAPI / Eccentric Labs / VAHAN",
        "registration_number": _get("regNo", "reg_no", "vehicleNo", "vehicle_no", d=d) or reg_no,
        "owner_name":          _get("ownerName", "owner_name", "owner", d=d),
        "father_name":         _get("fatherName", "father_name", d=d),
        "address":             _get("presentAddress", "permanentAddress", "address", d=d),
        "maker_model":         (
            str(_get("maker", "make", "vehicleMakerName", d=d)) + " / " +
            str(_get("makerModal", "model", "vehicleModel", "vehicleModelName", d=d))
        ).strip("— /"),
        "vehicle_class":       _get("vehicleClass", "vehicle_class", "vehicleClassDesc", d=d),
        "body_type":           _get("bodyType", "body_type", d=d),
        "fuel_type":           _get("fuelType", "fuel_type", "fuelDesc", d=d),
        "colour":              _get("vehicleColor", "colour", "color", d=d),
        "seating_capacity":    _get("passengerCapacity", "seating_capacity", "seatingCapacity", d=d),
        "manufacturing_year":  _get("manufacturingYear", "mfg_year", "manufacturedYear", d=d),
        "chassis_number":      _get("chassisNo", "chassis_no", "chassisNumber", d=d),
        "engine_number":       _get("engineNo", "engine_no", "engineNumber", d=d),
        "registration_date":   _get("regDate", "reg_date", "registrationDate", d=d),
        "registration_upto":   _get("regUpto", "reg_upto", "regValidUpto", d=d),
        "fitness_upto":        _get("fitnessUpto", "fitness_upto", "fitnessValidUpto", d=d),
        "tax_upto":            _get("taxUpto", "tax_upto", d=d),
        "insurance_company":   _get("insCompany", "insurance_company", "insuranceCompany", d=d),
        "insurance_upto":      _get("insUpto", "insurance_upto", "insuranceValidUpto", d=d),
        "hypothecation":       _get("financier", "hypothecation", d=d) or None,
        "blacklist_status":    _get("blacklistStatus", "blacklist", d=d) or "Not Blacklisted",
        "noc_details":         _get("nocDetails", d=d) or None,
        "rto":                 _get("rto", "rtoName", "rtoCode", "officeName", d=d),
        "state":               _get("state", "stateCode", d=d),
        "rc_status":           _get("viStatus", "rcStatus", "status", d=d) or "ACTIVE",
        "emission_norms":      _get("fuelNorms", "emission_norms", "emissionNorms", d=d),
        "raw":                 d,
        "legal_relevance": {
            "ownership_verified": True,
            "insurance_valid":    _get("insUpto", "insurance_upto", d=d) != "—",
            "fitness_valid":      _get("fitnessUpto", "fitness_upto", d=d) != "—",
            "has_hypothecation":  bool(_get("financier", "hypothecation", d=d) not in ("—", None)),
            "notes": (
                "RC verified via VAHAN / Ministry of Road Transport & Highways. "
                "Proves vehicle ownership in accident claims (MACT), loan/finance disputes, "
                "attachment proceedings, and stolen vehicle recovery. "
                "Insurance validity critical for third-party liability (MV Act S.146)."
            ),
        },
    }


def _parse_challans(data: dict, reg_no: str) -> dict:
    d    = data.get("result") or data.get("data") or data
    rows = d if isinstance(d, list) else d.get("challans") or d.get("pending_challans") or []
    return {
        "chain":               "VEHICLE_CHALLANS",
        "status":              "success",
        "data_source":         "RapidAPI / Eccentric Labs / VAHAN",
        "registration_number": reg_no,
        "total_challans":      len(rows),
        "pending_amount":      sum(
            float(str(c.get("amount") or c.get("challan_amount") or 0).replace(",", ""))
            for c in rows if isinstance(c, dict)
        ),
        "challans":            rows,
        "raw":                 d,
        "legal_relevance": {
            "has_pending_challans": bool(rows),
            "notes": (
                "Pending traffic challans from VAHAN. Relevant in accident claims (MACT), "
                "vehicle attachment orders, and criminal traffic offence cases."
            ),
        },
    }


def _call(url: str, vehicle_no: str, parser) -> dict:
    reg_no = vehicle_no.upper().replace(" ", "").replace("-", "")
    api_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not api_key:
        return {
            "chain":               "VEHICLE_RC",
            "status":              "no_api_key",
            "registration_number": reg_no,
            "error":               "RAPIDAPI_KEY not set",
            "note": (
                "Add RAPIDAPI_KEY to Replit Secrets. "
                "Subscribe free at: rapidapi.com → search 'RTO Vehicle Information India' (Eccentric Labs) → Subscribe."
            ),
        }

    logger.info(f"[RAPIDAPI_VEHICLE] POST {url} for {reg_no}")
    try:
        resp = requests.post(url, headers=_headers(), json=_body(reg_no), timeout=15)
        logger.info(f"[RAPIDAPI_VEHICLE] HTTP {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            if data.get("success") is False or data.get("status") == 0:
                return {
                    "chain":               "VEHICLE_RC",
                    "status":              "not_found",
                    "registration_number": reg_no,
                    "error":               data.get("message") or "Vehicle not found in VAHAN",
                    "note":                "Check number format — e.g. TS13EZ9523 (no spaces or hyphens).",
                }
            return parser(data, reg_no)

        if resp.status_code in (401, 403):
            try:
                msg = resp.json().get("message", "")
            except Exception:
                msg = resp.text[:80]
            return {
                "chain":               "VEHICLE_RC",
                "status":              "auth_failed",
                "registration_number": reg_no,
                "error":               f"HTTP {resp.status_code} — {msg}",
                "note": (
                    "Key is invalid OR not yet subscribed to this API. "
                    "Go to rapidapi.com → search 'RTO Vehicle Information India' (Eccentric Labs) → click Subscribe."
                ),
            }

        if resp.status_code == 429:
            return {
                "chain":               "VEHICLE_RC",
                "status":              "rate_limited",
                "registration_number": reg_no,
                "error":               "Free tier rate limit reached",
                "note":                "Wait a moment and retry, or upgrade plan at rapidapi.com.",
            }

        if resp.status_code == 502:
            return {
                "chain":               "VEHICLE_RC",
                "status":              "provider_down",
                "registration_number": reg_no,
                "error":               "Eccentric Labs backend server is temporarily down (HTTP 502)",
                "note":                "This is a temporary outage on the RapidAPI provider side. Retry in a few hours.",
            }

        return {
            "chain":               "VEHICLE_RC",
            "status":              "api_error",
            "registration_number": reg_no,
            "error":               f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    except requests.exceptions.Timeout:
        return {"chain": "VEHICLE_RC", "status": "timeout", "registration_number": vehicle_no, "error": "Request timed out"}
    except Exception as e:
        logger.error(f"[RAPIDAPI_VEHICLE] Exception: {e}")
        return {"chain": "VEHICLE_RC", "status": "error", "registration_number": vehicle_no, "error": str(e)}


def lookup_vehicle_rc(vehicle_no: str) -> dict:
    """Fetch real RC details from VAHAN via Eccentric Labs / RapidAPI."""
    return _call(RC_URL, vehicle_no, _parse_rc)


def lookup_vehicle_challans(vehicle_no: str) -> dict:
    """Fetch pending traffic challans from VAHAN via Eccentric Labs / RapidAPI."""
    return _call(CHALLAN_URL, vehicle_no, _parse_challans)
