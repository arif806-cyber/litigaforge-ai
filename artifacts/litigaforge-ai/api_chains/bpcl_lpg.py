"""
BPCL LPG Subscription Voucher chain — Ministry of Petroleum and Natural Gas.
Verifies LPG connection & eSubscription Voucher via API Setu DigiLocker.

Real endpoint: POST https://sandbox.api-setu.in/certificate/v3/bharatpetroleum/lpgsv
Dummy mode   : Returns realistic mock data when API_SETU_KEY is not set.

Required entity inputs  : lpg_id (12-digit LPG consumer number)
Optional entity inputs  : svid (Subscription Voucher ID), aadhaar (for consent)
Legal use cases         : LPG subsidy disputes, landlord/tenant utility claims,
                          address proof in eviction cases, Ujjwala Yojana matters
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from .base import safe_post

logger = logging.getLogger("litigaforge.chain.bpcl_lpg")

BPCL_SANDBOX_URL = "https://sandbox.api-setu.in/certificate/v3/bharatpetroleum/lpgsv"
BPCL_PROD_URL    = "https://apisetu.gov.in/certificate/v3/bharatpetroleum/lpgsv"


def _bpcl_headers() -> dict:
    return {
        "X-APISETU-APIKEY":   os.getenv("API_SETU_KEY", "demokey123456ABCD789"),
        "X-APISETU-CLIENTID": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox"),
        "Content-Type": "application/json",
    }


def _mock_response(lpg_id: str, svid: str) -> dict:
    """Realistic dummy BPCL LPG data — used when API_SETU_KEY is absent."""
    registered_date = (datetime.now() - timedelta(days=1200)).strftime("%Y-%m-%d")
    last_booking    = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")
    next_due        = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")

    return {
        "chain": "BPCL_LPG",
        "status": "mock",
        "lpg_id": lpg_id,
        "svid": svid or "SV-DUMMY-001",
        "consumer_details": {
            "name": "Consumer (Mock)",
            "lpg_consumer_number": lpg_id,
            "connection_type": "Domestic",
            "cylinder_capacity": "14.2 kg",
            "distributor": "BPCL Distributor, Hyderabad",
            "distributor_code": "HYD-BPC-042",
            "state": "Telangana",
            "registration_date": registered_date,
            "scheme": "Pradhan Mantri Ujjwala Yojana (PMUY)",
        },
        "subscription_voucher": {
            "voucher_id": svid or "SV-DUMMY-001",
            "status": "Active",
            "valid_from": registered_date,
            "valid_to": (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d"),
            "subsidy_amount": "₹0.00 (Non-subsidised)",
            "last_booking_date": last_booking,
            "next_due_date": next_due,
            "bookings_this_year": 8,
        },
        "digilocker_document": {
            "document_type": "LPG Subscription Voucher",
            "issued_by": "Ministry of Petroleum and Natural Gas",
            "is_machine_readable": True,
            "format": "PDF",
            "verified": True,
        },
        "legal_relevance": {
            "address_proof": True,
            "utility_ownership_proof": True,
            "subsidy_claim_eligible": False,
            "notes": (
                "This LPG voucher serves as valid address + utility proof under Indian Evidence Act. "
                "Useful in rent eviction, property, and family court matters as government-verified residence document."
            ),
        },
        "note": "Mock data — set API_SETU_KEY + API_SETU_CLIENT_ID for live BPCL verification",
    }


def fetch_bpcl_lpg(lpg_id: str = None, svid: str = None, aadhaar: str = None, **kwargs) -> dict:
    """
    Fetch and verify BPCL LPG Subscription Voucher.

    Args:
        lpg_id  : 12-digit LPG consumer number (LPGID)
        svid    : Subscription Voucher ID (optional)
        aadhaar : Aadhaar number for consent artifact (optional)
        **kwargs: Extra entity fields (ignored)

    Returns:
        dict with chain result — always succeeds (falls back to mock)
    """
    if not lpg_id:
        return {
            "chain": "BPCL_LPG",
            "status": "skipped",
            "reason": "No LPG consumer number (lpg_id) provided in prompt",
        }

    logger.info(f"[BPCL_LPG] Verifying LPG ID: {lpg_id[:6]}***")

    if not os.getenv("API_SETU_KEY"):
        logger.info("[BPCL_LPG] No API_SETU_KEY — returning mock data")
        return _mock_response(lpg_id, svid)

    use_prod = os.getenv("BPCL_USE_PROD", "false").lower() == "true"
    url = BPCL_PROD_URL if use_prod else BPCL_SANDBOX_URL

    payload = {
        "txnId": str(uuid.uuid4()),
        "format": "pdf",
        "certificateParameters": {
            "SVID":  svid or "000001",
            "LPGID": lpg_id,
        },
        "consentArtifact": {
            "consent": {
                "consentId": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "dataConsumer":  {"id": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox")},
                "dataProvider":  {"id": "in.gov.bharatpetroleum"},
                "purpose":       {"description": "Legal verification for court proceedings"},
                "user": {
                    "idType": "aadhaar",
                    "idNumber": aadhaar or "999900000000",
                    "mobile": "9999999999",
                    "email":  "advocate@litigaforge.ai",
                },
                "data":       {"id": lpg_id},
                "permission": {"access": "view"},
            }
        },
    }

    result = safe_post(url, _bpcl_headers(), payload, timeout=15)

    if not result["success"]:
        logger.warning(f"[BPCL_LPG] API call failed: {result['error']} — falling back to mock")
        fallback = _mock_response(lpg_id, svid)
        fallback["status"] = "mock_fallback"
        fallback["api_error"] = result["error"]
        return fallback

    data = result["data"]
    return {
        "chain": "BPCL_LPG",
        "status": "success",
        "lpg_id": lpg_id,
        "svid": svid,
        "raw": data,
        "legal_relevance": {
            "address_proof": True,
            "utility_ownership_proof": True,
            "notes": "BPCL LPG voucher verified via Ministry of Petroleum — admissible as address proof.",
        },
    }
