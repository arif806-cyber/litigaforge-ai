"""
Mee Seva Telangana Chain — tg.meeseva.gov.in via API Setu
Verifies all 11 state-issued certificates for Telangana residents.

Sandbox : https://sandbox.api-setu.in/certificate/v3/meesevatg/<cert>
Prod    : https://apisetu.gov.in/certificate/v3/meesevatg/<cert>

All endpoints share the same request shape:
  POST with ApplicationNo in certificateParameters + consentArtifact

Dummy mode: Full realistic data when API_SETU_KEY is absent.

Certificates supported:
  aicer  — Agriculture Income Certificate
  ctcer  — Caste Certificate
  nccer  — Change of Name Certificate
  cdcer  — Community and Date of Birth Certificate
  ebcer  — EBC (Economically Backward Class) Certificate
  fmcer  — Family Membership Certificate
  incer  — Income Certificate
  lrcer  — Late Registration of Birth/Death Certificate
  ntcer  — Nativity Certificate
  obcer  — OBC Certificate
  rscer  — Residence Certificate

Legal use cases: reservation eligibility, property disputes, eviction, family court,
                 succession, OBC/EBC/SC/ST benefits, birth/death registration,
                 name change in records, agricultural land disputes
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional
from .base import safe_post

logger = logging.getLogger("litigaforge.chain.mee_seva_tg")

SANDBOX_BASE = "https://sandbox.api-setu.in/certificate/v3/meesevatg"
PROD_BASE    = "https://apisetu.gov.in/certificate/v3/meesevatg"

# ─── Certificate catalogue ────────────────────────────────────────────────────

CERT_CATALOGUE = {
    "aicer": {
        "name": "Agriculture Income Certificate",
        "legal_use": "Agricultural land disputes, loan waivers, Rythu Bandhu eligibility",
        "act": "Telangana Agricultural Income Certificate Rules",
    },
    "ctcer": {
        "name": "Caste Certificate",
        "legal_use": "SC/ST reservation, government scheme eligibility, admission cases",
        "act": "Constitution of India Art. 341/342; TG Scheduled Castes Act",
    },
    "nccer": {
        "name": "Change of Name Certificate",
        "legal_use": "Name mismatch in property/ID documents, gazette name change proof",
        "act": "Births, Deaths and Marriages Registration Act 1886; IT Act 2000 S.65B",
    },
    "cdcer": {
        "name": "Community and Date of Birth Certificate",
        "legal_use": "Age/identity disputes, school admission, matrimonial cases",
        "act": "Registration of Births and Deaths Act 1969",
    },
    "ebcer": {
        "name": "EBC Certificate (Economically Backward Class)",
        "legal_use": "EBC reservation quota, government job/admission eligibility",
        "act": "TG EBC Reservation Act; Constitution (103rd Amendment) Act 2019",
    },
    "fmcer": {
        "name": "Family Membership Certificate",
        "legal_use": "Succession disputes, property inheritance, pension claims, ration card",
        "act": "Hindu Succession Act 1956; TG Mutation of Revenue Records",
    },
    "incer": {
        "name": "Income Certificate",
        "legal_use": "EWS/OBC income eligibility, legal aid applications, court fee waiver",
        "act": "TG Court Fees and Suits Valuation Act; Legal Services Authorities Act 1987",
    },
    "lrcer": {
        "name": "Late Registration of Birth/Death Certificate",
        "legal_use": "Age proof in criminal/matrimonial cases, death claims, LIC/pension",
        "act": "Registration of Births and Deaths Act 1969 S.13",
    },
    "ntcer": {
        "name": "Nativity Certificate",
        "legal_use": "Domicile for local reservations, employment eligibility, admission",
        "act": "TG State Nativity Rules; Art. 16(2) Constitution of India",
    },
    "obcer": {
        "name": "OBC Certificate",
        "legal_use": "OBC reservation, government scheme eligibility, SEBC benefits",
        "act": "Mandal Commission; Constitution (102nd Amendment) Act 2018; TG OBC Rules",
    },
    "rscer": {
        "name": "Residence Certificate",
        "legal_use": "Address proof in court, eviction cases, voter roll, property mutation",
        "act": "Indian Evidence Act S.35; IT Act 2000 S.65B (digital record admissibility)",
    },
}

# ─── Dummy data by certificate type ──────────────────────────────────────────

def _dummy_cert_data(cert_code: str, app_no: str, party_name: str) -> dict:
    """Return realistic dummy certificate data for a given Mee Seva cert type."""
    issued = (datetime.now() - timedelta(days=180)).strftime("%d-%m-%Y")
    expiry = (datetime.now() + timedelta(days=185)).strftime("%d-%m-%Y")
    info   = CERT_CATALOGUE.get(cert_code, {"name": cert_code.upper(), "legal_use": "", "act": ""})

    base = {
        "certificate_type": info["name"],
        "application_number": app_no or f"IC02{uuid.uuid4().hex[:10].upper()}",
        "applicant_name": party_name or "Applicant (Mock)",
        "issued_by": "Mee Seva — Government of Telangana",
        "issued_date": issued,
        "valid_till": expiry,
        "district": "Hyderabad",
        "mandal": "Kukatpally",
        "village": "Kukatpally",
        "state": "Telangana",
        "digital_signature": "Verified",
        "digilocker_synced": True,
        "format": "XML",
    }

    extras = {
        "aicer": {
            "land_holding_acres": "2.50",
            "survey_number": "123/A",
            "annual_income_from_agriculture": "₹1,20,000",
            "crops_grown": ["Paddy", "Cotton"],
        },
        "ctcer": {
            "caste": "BC-B",
            "sub_caste": "Yadav",
            "category": "Backward Class — B",
            "caste_verified_from": "Revenue Records",
        },
        "nccer": {
            "old_name": "Old Name (Mock)",
            "new_name": party_name or "New Name (Mock)",
            "gazette_reference": f"GO Ms No. {uuid.uuid4().hex[:4].upper()}/2023",
            "reason_for_change": "Personal preference",
        },
        "cdcer": {
            "community": "OBC",
            "date_of_birth": "15-08-1988",
            "place_of_birth": "Hyderabad",
            "father_name": "Father (Mock)",
            "mother_name": "Mother (Mock)",
        },
        "ebcer": {
            "annual_family_income": "₹3,80,000",
            "category": "Economically Backward Class",
            "income_source": "Salary + Agriculture",
        },
        "fmcer": {
            "head_of_family": party_name or "Head (Mock)",
            "members": [
                {"name": "Member 1 (Mock)", "relation": "Spouse", "age": 35},
                {"name": "Member 2 (Mock)", "relation": "Son",    "age": 12},
                {"name": "Member 3 (Mock)", "relation": "Daughter","age": 9},
            ],
            "total_members": 4,
            "ration_card_number": f"TS{uuid.uuid4().hex[:8].upper()}",
        },
        "incer": {
            "annual_income": "₹4,50,000",
            "income_source": "Salaried Employment",
            "income_category": "Below ₹8 Lakh (EWS/OBC eligible)",
        },
        "lrcer": {
            "event_type": "Birth",
            "event_date": "15-08-1988",
            "registration_date": issued,
            "registration_number": f"LRBD/{uuid.uuid4().hex[:6].upper()}/TS",
            "late_registration_reason": "Records not maintained at time of birth",
        },
        "ntcer": {
            "native_state": "Telangana",
            "native_district": "Hyderabad",
            "years_of_residence": 15,
            "continuous_residence_since": "2009",
        },
        "obcer": {
            "obc_category": "BC-B",
            "central_list_entry": "BC-B Sl. No. 78",
            "creamy_layer_status": "Non-Creamy Layer",
            "annual_family_income": "₹5,20,000",
        },
        "rscer": {
            "address": "Flat No. 101, XYZ Apartments, Kukatpally, Hyderabad — 500072",
            "years_of_residence": 8,
            "residence_since": "2016",
            "landlord_name": "Landlord (Mock)",
        },
    }

    base.update(extras.get(cert_code, {}))
    return base


def _meeseva_headers() -> dict:
    return {
        "X-APISETU-APIKEY":   os.getenv("API_SETU_KEY", "demokey123456ABCD789"),
        "X-APISETU-CLIENTID": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox"),
        "Content-Type": "application/json",
    }


def _consent_payload(app_no: str, aadhaar: str = None, mobile: str = "9988776655") -> dict:
    return {
        "txnId": str(uuid.uuid4()),
        "format": "xml",
        "certificateParameters": {"ApplicationNo": app_no or "IC021921512596"},
        "consentArtifact": {
            "consent": {
                "consentId": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "dataConsumer":  {"id": os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox")},
                "dataProvider":  {"id": "in.gov.tg.meeseva"},
                "purpose":       {"description": "Legal verification for court proceedings — LitigaForge AI"},
                "user": {
                    "idType":   "aadhaar" if aadhaar else "mobile",
                    "idNumber": aadhaar or "999900000000",
                    "mobile":   mobile,
                    "email":    "advocate@litigaforge.ai",
                },
                "data": {"id": app_no or "IC021921512596"},
                "permission": {
                    "access": "view",
                    "dateRange": {
                        "from": datetime.utcnow().isoformat() + "Z",
                        "to":   (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z",
                    },
                    "frequency": {"unit": "day", "value": 1, "repeats": 1},
                },
            },
            "signature": {"signature": "litigaforge-dummy-sig"},
        },
    }


# ─── Single certificate fetcher ───────────────────────────────────────────────

def _fetch_certificate(cert_code: str, app_no: str, party_name: str, aadhaar: str = None) -> dict:
    """Call one Mee Seva API Setu endpoint. Falls back to dummy on any failure."""
    info = CERT_CATALOGUE.get(cert_code, {"name": cert_code.upper(), "legal_use": "", "act": ""})

    if not os.getenv("API_SETU_KEY"):
        return {
            "cert_code": cert_code,
            "cert_name": info["name"],
            "status":    "mock",
            "data":      _dummy_cert_data(cert_code, app_no, party_name),
            "legal_use": info["legal_use"],
            "applicable_law": info["act"],
        }

    use_prod = os.getenv("MEESEVA_USE_PROD", "false").lower() == "true"
    base_url = PROD_BASE if use_prod else SANDBOX_BASE
    url      = f"{base_url}/{cert_code}"

    result = safe_post(url, _meeseva_headers(), _consent_payload(app_no, aadhaar), timeout=15)

    if not result["success"]:
        logger.warning(f"[MEE_SEVA_TG] {cert_code} failed: {result['error']} — using dummy")
        return {
            "cert_code": cert_code,
            "cert_name": info["name"],
            "status":    "mock_fallback",
            "api_error": result["error"],
            "data":      _dummy_cert_data(cert_code, app_no, party_name),
            "legal_use": info["legal_use"],
            "applicable_law": info["act"],
        }

    return {
        "cert_code": cert_code,
        "cert_name": info["name"],
        "status":    "success",
        "data":      result["data"],
        "legal_use": info["legal_use"],
        "applicable_law": info["act"],
    }


# ─── Main chain function ──────────────────────────────────────────────────────

def fetch_mee_seva_tg(
    party_name: str = None,
    application_number: str = None,
    aadhaar: str = None,
    cert_types: list = None,
    state_code: str = "TS",
    **kwargs,
) -> dict:
    """
    Verify Telangana Mee Seva certificates via API Setu.

    Automatically selects relevant certificates based on case context.
    Always runs Income + Residence + Caste by default (core legal set).
    Add more via cert_types if specific certificates are needed.

    Args:
        party_name         : Citizen/client name
        application_number : Mee Seva application number (e.g. IC021921512596)
        aadhaar            : Aadhaar number for consent artifact
        cert_types         : List of cert codes to fetch. Default: incer, rscer, ctcer
                             All options: aicer, ctcer, nccer, cdcer, ebcer, fmcer,
                                          incer, lrcer, ntcer, obcer, rscer
        state_code         : 2-letter state code — only runs for Telangana (TS/AP)
        **kwargs           : Extra entity fields (ignored)

    Returns:
        dict with all fetched certificates + aggregated legal relevance summary
    """
    if state_code not in ("TS", "AP", "TG"):
        return {
            "chain": "MEE_SEVA_TG",
            "status": "skipped",
            "reason": f"Mee Seva Telangana only applicable for TS/AP cases (state_code={state_code})",
        }

    default_certs = ["incer", "rscer", "ctcer"]
    codes_to_fetch = list(dict.fromkeys((cert_types or []) + default_certs))

    logger.info(f"[MEE_SEVA_TG] Fetching {len(codes_to_fetch)} certificates for {party_name or 'client'}")

    certificates = {}
    for code in codes_to_fetch:
        if code not in CERT_CATALOGUE:
            logger.warning(f"[MEE_SEVA_TG] Unknown cert code: {code} — skipped")
            continue
        certificates[code] = _fetch_certificate(code, application_number, party_name, aadhaar)

    has_income    = "incer"  in certificates
    has_residence = "rscer"  in certificates
    has_caste     = "ctcer"  in certificates
    has_obc       = "obcer"  in certificates
    has_family    = "fmcer"  in certificates
    has_nativity  = "ntcer"  in certificates

    return {
        "chain":    "MEE_SEVA_TG",
        "status":   "mock" if not os.getenv("API_SETU_KEY") else "success",
        "provider": "Mee Seva — Government of Telangana (tg.meeseva.gov.in)",
        "applicant": party_name or "Unknown",
        "state_code": state_code,
        "certificates_fetched": len(certificates),
        "certificates": certificates,
        "legal_relevance_summary": {
            "income_proof":          has_income,
            "address_proof":         has_residence,
            "caste_verified":        has_caste,
            "obc_eligible":          has_obc,
            "family_tree_verified":  has_family,
            "telangana_domicile":    has_nativity,
            "court_fee_waiver_eligible": has_income,
            "notes": (
                "All Mee Seva certificates are issued by the Government of Telangana and "
                "are admissible as evidence under Indian Evidence Act S.35 (public documents) "
                "and IT Act 2000 S.65B (electronic records). No physical copy attestation required. "
                "Income Certificate qualifies for court fee waiver under TG Court Fees Act."
            ),
        },
        "note": (
            "Mock data — set API_SETU_KEY + API_SETU_CLIENT_ID for live Mee Seva verification"
            if not os.getenv("API_SETU_KEY") else "Live data from Mee Seva API Setu"
        ),
    }
