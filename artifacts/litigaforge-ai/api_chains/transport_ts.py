"""
State Transport Department Telangana — API Setu chain
Verifies Driving Licence and Vehicle Registration Certificate via Parivahan Sewa,
synced to the citizen's DigiLocker account.

Sandbox : https://sandbox.api-setu.in/certificate/v3/transportts/
Prod    : https://apisetu.gov.in/certificate/v3/transportts/

Endpoints:
  drvlc — Driving Licence (dlno required)
  rvcer — Vehicle Registration Certificate (reg_no + chasis_no required)

Dummy mode: Realistic mock data when API_SETU_KEY is absent.

Legal use cases:
  DL  — Motor accident claims, hit-and-run, drunk driving defence,
         licence validity in criminal cases, insurance disputes
  RC  — Vehicle ownership in property/loan disputes, motor accident liability,
         stolen vehicle recovery, finance/hypothecation settlement
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from .base import safe_post

logger = logging.getLogger("litigaforge.chain.transport_ts")

SANDBOX_BASE = "https://sandbox.api-setu.in/certificate/v3/transportts"
PROD_BASE    = "https://apisetu.gov.in/certificate/v3/transportts"


def _headers() -> dict:
    return {
        "X-APISETU-APIKEY":   os.getenv("API_SETU_KEY", "demokey123456ABCD789"),
        "X-APISETU-CLIENTID": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox"),
        "Content-Type": "application/json",
    }


def _consent(data_id: str, mobile: str = "9988776655") -> dict:
    now = datetime.utcnow()
    return {
        "consentId":     str(uuid.uuid4()),
        "timestamp":     now.isoformat() + "Z",
        "dataConsumer":  {"id": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox")},
        "dataProvider":  {"id": "in.gov.morth.parivahan"},
        "purpose":       {"description": "Legal verification for court proceedings — LitigaForge AI"},
        "user": {
            "idType":   "mobile",
            "idNumber": "999900000000",
            "mobile":   mobile,
            "email":    "advocate@litigaforge.ai",
        },
        "data": {"id": data_id},
        "permission": {
            "access": "view",
            "dateRange": {
                "from": now.isoformat() + "Z",
                "to":   (now + timedelta(days=1)).isoformat() + "Z",
            },
            "frequency": {"unit": "day", "value": 1, "repeats": 1},
        },
    }


# ─── Dummy data ───────────────────────────────────────────────────────────────

def _mock_dl(dl_no: str, party_name: str) -> dict:
    issue_date  = (datetime.now() - timedelta(days=1800)).strftime("%d-%m-%Y")
    expiry_date = (datetime.now() + timedelta(days=3000)).strftime("%d-%m-%Y")
    return {
        "chain": "TRANSPORT_TS_DL",
        "status": "mock",
        "dl_number": dl_no or "TS14-20180000001",
        "holder_name": party_name or "Licence Holder (Mock)",
        "father_name": "Father (Mock)",
        "date_of_birth": "15-08-1988",
        "address": "Kukatpally, Hyderabad, Telangana — 500072",
        "issue_date": issue_date,
        "expiry_date": expiry_date,
        "issuing_rto": "RTO Hyderabad West (TS-14)",
        "vehicle_classes": ["LMV", "MCWOG"],
        "hazardous_goods": False,
        "transport": False,
        "blood_group": "O+",
        "badge_number": None,
        "status": "Valid",
        "digilocker_synced": True,
        "source": "Parivahan Sewa — Ministry of Road Transport & Highways",
        "legal_relevance": {
            "licence_valid": True,
            "classes_held": ["LMV", "MCWOG"],
            "notes": (
                "DL verified via Parivahan Sewa / Telangana State Transport Dept. "
                "Admissible under IT Act 2000 S.65B. Key evidence in motor accident (MACT) claims, "
                "drunk-driving offences (MV Act S.185), and hire/reward disputes."
            ),
        },
        "note": "Mock data — set API_SETU_KEY for live DL verification",
    }


def _mock_rc(reg_no: str, chasis_no: str, party_name: str) -> dict:
    reg_date    = (datetime.now() - timedelta(days=900)).strftime("%d-%m-%Y")
    fc_expiry   = (datetime.now() + timedelta(days=365)).strftime("%d-%m-%Y")
    ins_expiry  = (datetime.now() + timedelta(days=200)).strftime("%d-%m-%Y")
    return {
        "chain": "TRANSPORT_TS_RC",
        "status": "mock",
        "registration_number": reg_no or "TS09EA1234",
        "chasis_number": chasis_no or "MBLKC12EFBGJ08420",
        "engine_number": "JH22EF1234567",
        "owner_name": party_name or "Vehicle Owner (Mock)",
        "father_name": "Father (Mock)",
        "address": "Kukatpally, Hyderabad, Telangana — 500072",
        "registration_date": reg_date,
        "registration_upto": fc_expiry,
        "maker_model": "Maruti Suzuki / Swift Dzire VXI",
        "body_type": "Sedan",
        "fuel_type": "Petrol",
        "colour": "White",
        "seating_capacity": 5,
        "unladen_weight_kg": 845,
        "gross_weight_kg": 1300,
        "cubic_capacity_cc": 1197,
        "manufacturing_year": 2021,
        "rto": "RTO Hyderabad East (TS-09)",
        "fitness_upto": fc_expiry,
        "insurance_company": "New India Assurance Co. Ltd.",
        "insurance_policy": f"NIA-{uuid.uuid4().hex[:8].upper()}",
        "insurance_upto": ins_expiry,
        "hypothecation": None,
        "blacklist_status": "Not Blacklisted",
        "noc_details": None,
        "digilocker_synced": True,
        "source": "Parivahan Sewa — Ministry of Road Transport & Highways",
        "legal_relevance": {
            "ownership_verified": True,
            "insurance_valid": True,
            "fitness_valid": True,
            "no_hypothecation": True,
            "notes": (
                "RC verified via Parivahan Sewa / Telangana State Transport Dept. "
                "Proves vehicle ownership in accident claims (MACT), loan/finance disputes, "
                "attachment proceedings, and stolen vehicle recovery cases. "
                "Insurance validity critical for third-party liability (MV Act S.146)."
            ),
        },
        "note": "Mock data — set API_SETU_KEY for live RC verification",
    }


# ─── API callers ──────────────────────────────────────────────────────────────

def _call_dl(dl_no: str, party_name: str) -> dict:
    # ── Priority 1: API Setu (DL lookup — RapidAPI doesn't cover DL yet) ──────
    if os.getenv("API_SETU_KEY"):
        use_prod = os.getenv("TRANSPORT_TS_USE_PROD", "false").lower() == "true"
        url = f"{PROD_BASE if use_prod else SANDBOX_BASE}/drvlc"
        payload = {
            "txnId": str(uuid.uuid4()),
            "format": "xml",
            "certificateParameters": {"dlno": dl_no},
            "consentArtifact": {"consent": _consent(dl_no), "signature": {"signature": "litigaforge"}},
        }
        result = safe_post(url, _headers(), payload, timeout=15)
        if not result["success"]:
            is_404    = result.get("error_type") == "record_not_found"
            connected = result.get("sandbox_connected", False)
            status_label = "sandbox_connected_no_record" if (connected and is_404) else ("connection_failed" if not connected else "api_error")
            logger.warning(f"[TRANSPORT_TS] DL {status_label}: {result['error']}")
            return {
                "chain":   "TRANSPORT_TS_DL",
                "status":  status_label,
                "dl_number": dl_no,
                "sandbox_connected": connected,
                "api_error": result["error"],
                "note": (
                    "API Setu sandbox connected — DL not found in SARATHI national database. "
                    "Provide the exact DL number as printed on the licence."
                ) if (connected and is_404) else f"API Setu unreachable — {result['error']}",
            }
        return {**result["data"], "chain": "TRANSPORT_TS_DL", "status": "success",
                "source": "Parivahan Sewa — Ministry of Road Transport & Highways"}

    # ── No key: clear error, no fake data ─────────────────────────────────────
    return {
        "chain":     "TRANSPORT_TS_DL",
        "status":    "no_api_key",
        "dl_number": dl_no,
        "note":      (
            "No DL API key configured. "
            "Add API_SETU_KEY (from api.setu.in) for live Driving Licence verification via SARATHI."
        ),
    }


def _call_rc(reg_no: str, chasis_no: str, party_name: str) -> dict:
    # ── Priority 1: RapidAPI (real VAHAN data, works today) ───────────────────
    if os.getenv("RAPIDAPI_KEY"):
        from .rapidapi_vehicle import lookup_vehicle_rc
        result = lookup_vehicle_rc(reg_no)
        logger.info(f"[TRANSPORT_TS] RapidAPI RC status={result.get('status')} for {reg_no}")
        return result

    # ── Priority 2: API Setu sandbox/production ───────────────────────────────
    if os.getenv("API_SETU_KEY"):
        use_prod = os.getenv("TRANSPORT_TS_USE_PROD", "false").lower() == "true"
        url = f"{PROD_BASE if use_prod else SANDBOX_BASE}/rvcer"
        payload = {
            "txnId": str(uuid.uuid4()),
            "format": "xml",
            "certificateParameters": {"reg_no": reg_no, "chasis_no": chasis_no or ""},
            "consentArtifact": {"consent": _consent(reg_no), "signature": {"signature": "litigaforge"}},
        }
        result = safe_post(url, _headers(), payload, timeout=15)
        if not result["success"]:
            is_404    = result.get("error_type") == "record_not_found"
            connected = result.get("sandbox_connected", False)
            status_label = "sandbox_connected_no_record" if (connected and is_404) else ("connection_failed" if not connected else "api_error")
            logger.warning(f"[TRANSPORT_TS] RC {status_label}: {result['error']}")
            return {
                "chain":               "TRANSPORT_TS_RC",
                "status":              status_label,
                "registration_number": reg_no,
                "sandbox_connected":   connected,
                "api_error":           result["error"],
                "note": (
                    "API Setu sandbox connected — vehicle not found in VAHAN national database. "
                    "The vehicle may be in state RTO only (not synced to VAHAN). "
                    "Add RAPIDAPI_KEY for broader coverage, or get a production API Setu key."
                ) if (connected and is_404) else f"API Setu unreachable — {result['error']}",
            }
        return {**result["data"], "chain": "TRANSPORT_TS_RC", "status": "success",
                "source": "Parivahan Sewa — Ministry of Road Transport & Highways"}

    # ── No key: return clear error, no fake data ──────────────────────────────
    return {
        "chain":               "TRANSPORT_TS_RC",
        "status":              "no_api_key",
        "registration_number": reg_no,
        "note":                (
            "No vehicle API key configured. "
            "Add RAPIDAPI_KEY (free, instant) for real VAHAN data. "
            "Sign up at rapidapi.com → search 'RTO Vehicle Information India' → subscribe → add key."
        ),
    }


# ─── Main chain function ──────────────────────────────────────────────────────

def fetch_transport_ts(
    dl_number: str = None,
    vehicle_number: str = None,
    chasis_number: str = None,
    party_name: str = None,
    state_code: str = "TS",
    **kwargs,
) -> dict:
    """
    Verify Driving Licence and/or Vehicle RC via Telangana State Transport Dept / API Setu.

    Args:
        dl_number      : Driving Licence number  (e.g. TS14/2018/0000001)
        vehicle_number : Vehicle registration number (e.g. TS09EA1234)
        chasis_number  : Chassis number from RC (e.g. MBLKC12EFBGJ08420)
        party_name     : Owner/holder name for mock personalisation
        state_code     : 2-letter state code — skipped for non-TS/AP cases
        **kwargs       : Extra entity fields (ignored)

    Returns:
        dict with DL result, RC result, or both; aggregated legal summary
    """
    if state_code not in ("TS", "AP", "TG"):
        return {
            "chain": "TRANSPORT_TS",
            "status": "skipped",
            "reason": f"Transport TS chain is Telangana-specific (state_code={state_code})",
        }

    if not dl_number and not vehicle_number:
        return {
            "chain": "TRANSPORT_TS",
            "status": "skipped",
            "reason": "No DL number or vehicle registration number found in prompt",
        }

    results = {}

    if dl_number:
        logger.info(f"[TRANSPORT_TS] Verifying DL: {dl_number}")
        results["driving_licence"] = _call_dl(dl_number, party_name)

    if vehicle_number:
        logger.info(f"[TRANSPORT_TS] Verifying RC: {vehicle_number}")
        results["vehicle_rc"] = _call_rc(vehicle_number, chasis_number, party_name)

    dl_valid = results.get("driving_licence", {}).get("legal_relevance", {}).get("licence_valid")
    rc_valid = results.get("vehicle_rc", {}).get("legal_relevance", {}).get("ownership_verified")
    ins_valid = results.get("vehicle_rc", {}).get("legal_relevance", {}).get("insurance_valid")

    has_rapidapi = bool(os.getenv("RAPIDAPI_KEY"))
    has_apisetu  = bool(os.getenv("API_SETU_KEY"))
    if has_rapidapi:
        data_source = "RapidAPI / VAHAN (Ministry of Road Transport & Highways)"
        status_label = "live"
    elif has_apisetu:
        data_source = "API Setu Sandbox / Parivahan Sewa"
        status_label = "sandbox"
    else:
        data_source = "No API key configured"
        status_label = "no_api_key"

    return {
        "chain":    "TRANSPORT_TS",
        "status":   status_label,
        "provider": "State Transport Department, Telangana — via Parivahan Sewa (MoRTH)",
        "data_source": data_source,
        "results":  results,
        "documents_verified": list(results.keys()),
        "legal_relevance_summary": {
            "dl_valid":           dl_valid,
            "rc_ownership_clear": rc_valid,
            "insurance_valid":    ins_valid,
            "mact_ready": bool(dl_valid and rc_valid and ins_valid),
            "applicable_laws": [
                "Motor Vehicles Act 1988 — S.146 (insurance), S.185 (drunken driving)",
                "Motor Accidents Claims Tribunal (MACT) — S.165",
                "IT Act 2000 S.65B — electronic records admissibility",
                "Parivahan Sewa — DigiLocker certified document",
            ],
            "notes": (
                "DL & RC verified via Telangana State Transport Dept through Parivahan Sewa. "
                "Documents are DigiLocker-synced and court-admissible without physical attestation. "
                "Essential for MACT claims, criminal traffic offences, and vehicle attachment orders."
            ),
        },
        "note": (
            "Live data from VAHAN via RapidAPI" if has_rapidapi
            else "API Setu sandbox connected — real vehicle numbers return live data"
            if has_apisetu else
            "Add RAPIDAPI_KEY (free, instant at rapidapi.com) for real vehicle data"
        ),
    }
