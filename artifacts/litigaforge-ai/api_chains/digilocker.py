"""
DigiLocker document fetch via API Setu.
Retrieves Aadhaar, income certificates, domicile certs, degree certificates.
"""
import os
from .base import api_setu_headers, safe_post, API_SETU_BASE


def fetch_digilocker(aadhaar: str = None, doc_types: list = None, **kwargs) -> dict:
    if not aadhaar:
        return {"chain": "DigiLocker", "status": "skipped", "reason": "No Aadhaar number provided"}

    doc_types = doc_types or ["ADHAR", "INCOME", "DOMICILE"]

    if not os.getenv("API_SETU_KEY"):
        return {
            "chain": "DigiLocker",
            "status": "mock",
            "aadhaar_last4": aadhaar[-4:] if len(aadhaar) >= 4 else "****",
            "documents_found": [
                {"type": "ADHAR", "name": "Aadhaar Card", "verified": True, "issued_by": "UIDAI"},
                {"type": "INCOME", "name": "Income Certificate", "verified": True, "issued_by": "Revenue Dept, Telangana"},
                {"type": "DOMICILE", "name": "Domicile Certificate", "verified": True, "issued_by": "Revenue Dept, Telangana"},
            ],
            "total_docs": 3,
            "note": "Mock data — set API_SETU_KEY for live DigiLocker access",
        }

    url = f"{API_SETU_BASE}/digilocker/documents"
    payload = {"aadhaar_number": aadhaar, "document_types": doc_types}
    result = safe_post(url, api_setu_headers(), payload)

    if not result["success"]:
        return {"chain": "DigiLocker", "status": "error", "detail": result["error"]}

    data = result["data"]
    docs = data.get("documents", [])
    return {
        "chain": "DigiLocker",
        "status": "success",
        "aadhaar_last4": aadhaar[-4:],
        "documents_found": docs,
        "total_docs": len(docs),
        "raw": data,
    }
