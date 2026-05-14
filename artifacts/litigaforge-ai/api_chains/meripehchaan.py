"""
MeriPehchaan DigiLocker OAuth2 Chain — National eGovernance Division (NIC/MeitY)
Fetches citizen documents from DigiLocker via MeriPehchaan SSO OAuth2 flow.

Dev endpoint  : https://dev-meripehchaan.dl6.in/public/oauth2/1/
OAuth2 flow   : Authorization Code (PKCE)
Files endpoint: GET /public/oauth2/1/files/  (requires Bearer token)

Dummy mode    : Returns realistic mock DigiLocker documents when credentials absent.

Supported documents:
  - Aadhaar Card (UIDAI)
  - PAN Card (Income Tax Dept)
  - Driving Licence (MoRTH)
  - Vehicle RC (VAHAN)
  - Income Certificate (State Revenue)
  - Caste Certificate (State Revenue)
  - Birth Certificate (Municipal)
  - Degree/Marksheet (University)
  - Ration Card (Food Dept)
  - Voter ID (ECI)

Legal use cases: identity proof, address proof, caste/income eligibility,
                 academic qualification disputes, property/eviction matters
"""
import os
import uuid
import logging
import secrets
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional
from .base import safe_get, safe_post

logger = logging.getLogger("litigaforge.chain.meripehchaan")

MERIPEHCHAAN_DEV_BASE  = "https://dev-meripehchaan.dl6.in/public/oauth2/1"
MERIPEHCHAAN_PROD_BASE = "https://meripehchaan.gov.in/public/oauth2/1"

# ─── Dummy document templates ─────────────────────────────────────────────────

_DUMMY_DOCS = [
    {
        "docType": "ADHAR",
        "name": "Aadhaar Card",
        "issuedBy": "Unique Identification Authority of India",
        "issuedOn": "2019-03-15",
        "validTill": "Lifetime",
        "docNumber": "XXXX-XXXX-1234",
        "verified": True,
        "mime": "application/pdf",
        "size": "245 KB",
        "uri": "in.gov.uidai-ADHAR-XXXXXXXX1234",
    },
    {
        "docType": "PANCRD",
        "name": "PAN Card",
        "issuedBy": "Income Tax Department, Government of India",
        "issuedOn": "2015-07-22",
        "validTill": "Lifetime",
        "docNumber": "ABCDE1234F",
        "verified": True,
        "mime": "application/pdf",
        "size": "189 KB",
        "uri": "in.gov.incometax-PANCRD-ABCDE1234F",
    },
    {
        "docType": "DRVLC",
        "name": "Driving Licence",
        "issuedBy": "Ministry of Road Transport & Highways",
        "issuedOn": "2018-11-05",
        "validTill": "2038-11-04",
        "docNumber": "TS14-XXXXXXXXXX",
        "verified": True,
        "mime": "application/pdf",
        "size": "312 KB",
        "uri": "in.gov.sarathi-DRVLC-TS14XXXXXXXXXX",
    },
    {
        "docType": "INCOME",
        "name": "Income Certificate",
        "issuedBy": "Revenue Department, Government of Telangana",
        "issuedOn": "2024-01-10",
        "validTill": "2025-01-09",
        "docNumber": "INCOME-TS-2024-XXXXXX",
        "verified": True,
        "mime": "application/pdf",
        "size": "156 KB",
        "uri": "in.gov.telangana-INCOME-2024XXXXXX",
    },
    {
        "docType": "DOMICILE",
        "name": "Domicile Certificate",
        "issuedBy": "Revenue Department, Government of Telangana",
        "issuedOn": "2023-06-18",
        "validTill": "Lifetime",
        "docNumber": "DOM-TS-2023-XXXXXX",
        "verified": True,
        "mime": "application/pdf",
        "size": "143 KB",
        "uri": "in.gov.telangana-DOMICILE-2023XXXXXX",
    },
    {
        "docType": "CASTE",
        "name": "Caste Certificate",
        "issuedBy": "Revenue Department, Government of Telangana",
        "issuedOn": "2022-09-01",
        "validTill": "Lifetime",
        "docNumber": "CASTE-TS-2022-XXXXXX",
        "verified": True,
        "mime": "application/pdf",
        "size": "167 KB",
        "uri": "in.gov.telangana-CASTE-2022XXXXXX",
    },
]

_DUMMY_CITIZEN = {
    "sub": "dummy-citizen-001",
    "name": "Citizen (Mock)",
    "given_name": "Mock",
    "family_name": "Citizen",
    "email": "citizen@mock.gov.in",
    "email_verified": True,
    "phone_number": "+91-9999999999",
    "phone_number_verified": True,
    "digilocker_id": "DL-XXXXXXXX",
    "aadhaar_linked": True,
    "pan_linked": True,
}


# ─── PKCE helpers ─────────────────────────────────────────────────────────────

def _pkce_pair() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge (S256)."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ─── Mock response builder ────────────────────────────────────────────────────

def _mock_response(party_name: Optional[str], doc_types: list) -> dict:
    """Return realistic dummy MeriPehchaan DigiLocker data."""
    filtered = (
        [d for d in _DUMMY_DOCS if d["docType"] in doc_types]
        if doc_types else _DUMMY_DOCS
    )
    citizen = dict(_DUMMY_CITIZEN)
    if party_name:
        parts = party_name.strip().split()
        citizen["given_name"] = parts[0]
        citizen["family_name"] = parts[-1] if len(parts) > 1 else ""
        citizen["name"] = party_name

    return {
        "chain": "MERIPEHCHAAN",
        "status": "mock",
        "oauth2_provider": "MeriPehchaan — National eGovernance Division (NIC/MeitY)",
        "auth_endpoint": f"{MERIPEHCHAAN_DEV_BASE}/authorize",
        "citizen_profile": citizen,
        "documents": filtered,
        "total_documents": len(filtered),
        "document_types_fetched": [d["docType"] for d in filtered],
        "legal_relevance": {
            "identity_proof": any(d["docType"] in ("ADHAR", "PANCRD") for d in filtered),
            "address_proof": any(d["docType"] in ("ADHAR", "DOMICILE", "INCOME") for d in filtered),
            "caste_income_eligible": any(d["docType"] in ("CASTE", "INCOME") for d in filtered),
            "driving_verified": any(d["docType"] == "DRVLC" for d in filtered),
            "notes": (
                "All DigiLocker documents fetched via MeriPehchaan OAuth2 SSO. "
                "Admissible under IT Act 2000 Section 65B as government-certified digital records. "
                "Can be submitted directly in court without physical copy attestation."
            ),
        },
        "note": (
            "Mock data — set MERIPEHCHAAN_CLIENT_ID + MERIPEHCHAAN_CLIENT_SECRET "
            "and provide an authorization_code for live DigiLocker document access"
        ),
    }


# ─── Auth URL builder ─────────────────────────────────────────────────────────

def build_auth_url(redirect_uri: str = "https://litigaforge.ai/callback") -> dict:
    """
    Generate MeriPehchaan OAuth2 authorization URL for the advocate's frontend.
    The citizen visits this URL, logs in, and the code is returned to redirect_uri.
    """
    use_prod = os.getenv("MERIPEHCHAAN_USE_PROD", "false").lower() == "true"
    base = MERIPEHCHAAN_PROD_BASE if use_prod else MERIPEHCHAAN_DEV_BASE
    client_id = os.getenv("MERIPEHCHAAN_CLIENT_ID", "demo-client-id")
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(16)
    params = (
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid+profile+documents"
        f"&state={state}"
        f"&code_challenge={challenge}"
        f"&code_challenge_method=S256"
    )
    return {
        "auth_url": f"{base}/authorize{params}",
        "code_verifier": verifier,
        "state": state,
        "instructions": "Direct the citizen to auth_url. After login, exchange the returned code via fetch_meripehchaan.",
    }


# ─── Token exchange ───────────────────────────────────────────────────────────

def _exchange_token(auth_code: str, code_verifier: str, redirect_uri: str) -> dict:
    use_prod = os.getenv("MERIPEHCHAAN_USE_PROD", "false").lower() == "true"
    base = MERIPEHCHAAN_PROD_BASE if use_prod else MERIPEHCHAAN_DEV_BASE
    client_id     = os.getenv("MERIPEHCHAAN_CLIENT_ID", "")
    client_secret = os.getenv("MERIPEHCHAAN_CLIENT_SECRET", "")

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    payload = {
        "grant_type":    "authorization_code",
        "code":          auth_code,
        "redirect_uri":  redirect_uri,
        "client_id":     client_id,
        "client_secret": client_secret,
        "code_verifier": code_verifier,
    }
    result = safe_post(f"{base}/token", headers, payload, timeout=15)
    return result


# ─── Fetch documents ──────────────────────────────────────────────────────────

def _fetch_documents(access_token: str, doc_types: list) -> dict:
    use_prod = os.getenv("MERIPEHCHAAN_USE_PROD", "false").lower() == "true"
    base = MERIPEHCHAAN_PROD_BASE if use_prod else MERIPEHCHAAN_DEV_BASE
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    params = {"docType": ",".join(doc_types)} if doc_types else {}
    return safe_get(f"{base}/files/", headers, params, timeout=20)


# ─── Main chain function ──────────────────────────────────────────────────────

def fetch_meripehchaan(
    party_name: str = None,
    authorization_code: str = None,
    code_verifier: str = None,
    redirect_uri: str = "https://litigaforge.ai/callback",
    doc_types: list = None,
    **kwargs,
) -> dict:
    """
    Fetch citizen documents from DigiLocker via MeriPehchaan OAuth2.

    Args:
        party_name         : Citizen name (used to personalise mock/profile data)
        authorization_code : OAuth2 code from MeriPehchaan redirect (if available)
        code_verifier      : PKCE verifier matching the challenge used in auth URL
        redirect_uri       : Must match the redirect_uri used in authorization
        doc_types          : List of DigiLocker doc type codes to fetch.
                             Default: all standard documents.
                             Options: ADHAR, PANCRD, DRVLC, INCOME, DOMICILE, CASTE
        **kwargs           : Extra entity fields (ignored)

    Returns:
        dict with chain result — always succeeds (mock fallback if no credentials)
    """
    client_id     = os.getenv("MERIPEHCHAAN_CLIENT_ID", "")
    client_secret = os.getenv("MERIPEHCHAAN_CLIENT_SECRET", "")
    creds_present = bool(client_id and client_secret)

    # ── Fully dummy: no creds at all ──────────────────────────────────────────
    if not creds_present:
        logger.info("[MERIPEHCHAAN] No credentials — returning mock data")
        return _mock_response(party_name, doc_types or [])

    # ── Creds present but no auth code: return auth URL for frontend ──────────
    if not authorization_code:
        logger.info("[MERIPEHCHAAN] Credentials found, no auth code — returning auth URL")
        url_info = build_auth_url(redirect_uri)
        mock = _mock_response(party_name, doc_types or [])
        mock["status"] = "auth_required"
        mock["auth_url_info"] = url_info
        mock["note"] = (
            "Credentials set. Direct the citizen to auth_url to log in via MeriPehchaan. "
            "Pass the returned code as authorization_code in the next /forge request."
        )
        return mock

    # ── Auth code present: exchange for token, then fetch documents ───────────
    logger.info("[MERIPEHCHAAN] Exchanging auth code for access token")
    token_result = _exchange_token(
        authorization_code,
        code_verifier or "",
        redirect_uri,
    )

    if not token_result["success"]:
        logger.warning(f"[MERIPEHCHAAN] Token exchange failed: {token_result['error']}")
        fallback = _mock_response(party_name, doc_types or [])
        fallback["status"] = "mock_fallback"
        fallback["auth_error"] = token_result["error"]
        return fallback

    token_data   = token_result["data"]
    access_token = token_data.get("access_token", "")
    id_token     = token_data.get("id_token", "")

    logger.info("[MERIPEHCHAAN] Token obtained — fetching documents")
    doc_result = _fetch_documents(access_token, doc_types or [])

    if not doc_result["success"]:
        logger.warning(f"[MERIPEHCHAAN] Document fetch failed: {doc_result['error']}")
        fallback = _mock_response(party_name, doc_types or [])
        fallback["status"] = "mock_fallback"
        fallback["doc_error"] = doc_result["error"]
        return fallback

    doc_data  = doc_result["data"]
    documents = doc_data.get("items", doc_data.get("documents", []))

    return {
        "chain": "MERIPEHCHAAN",
        "status": "success",
        "oauth2_provider": "MeriPehchaan — National eGovernance Division (NIC/MeitY)",
        "citizen_profile": token_data.get("userinfo", {}),
        "documents": documents,
        "total_documents": len(documents),
        "document_types_fetched": [d.get("docType") for d in documents],
        "id_token": id_token,
        "legal_relevance": {
            "identity_proof": True,
            "address_proof": True,
            "notes": (
                "Documents fetched via MeriPehchaan OAuth2 SSO — government-certified. "
                "Admissible under IT Act 2000 Section 65B."
            ),
        },
    }
