"""
Department: IFSC / Bank Verification
API: Free public RBI IFSC API — no key required
     https://ifsc.razorpay.com/{IFSC}   (Razorpay's free IFSC lookup, no auth)

Also supports: bank name, branch, address, MICR, RTGS, NEFT, IMPS flags.

Legal use cases:
  • Cheque bounce (NI Act S.138) — verify drawee bank and branch
  • Bank fraud — confirm if IFSC is valid and branch exists
  • Money laundering — trace transaction routing
  • Loan / mortgage — verify financier bank details
  • Execution petitions — locate bank branch for attachment
"""
import logging
import requests

logger = logging.getLogger("litigaforge.chain.ifsc")

IFSC_URL = "https://ifsc.razorpay.com/{ifsc}"


def fetch_ifsc(
    ifsc_code: str = None,
    **kwargs,
) -> dict:
    """
    Verify an IFSC code and fetch complete bank branch details.

    Args:
        ifsc_code : 11-character IFSC (e.g. SBIN0000001)
    """
    if not ifsc_code:
        return {"chain": "IFSC", "status": "skipped", "reason": "No IFSC code found in case facts"}

    ifsc_code = ifsc_code.strip().upper()
    if len(ifsc_code) != 11:
        return {"chain": "IFSC", "status": "error", "reason": f"Invalid IFSC length: {ifsc_code} ({len(ifsc_code)} chars, need 11)"}

    logger.info(f"[IFSC] Verifying IFSC: {ifsc_code}")
    try:
        r = requests.get(IFSC_URL.format(ifsc=ifsc_code), timeout=10)

        if r.status_code == 200:
            d = r.json()
            return {
                "chain":         "IFSC",
                "status":        "success",
                "data_source":   "RBI IFSC Registry via Razorpay (free, no key)",
                "ifsc_code":     ifsc_code,
                "bank_name":     d.get("BANK", "—"),
                "branch":        d.get("BRANCH", "—"),
                "address":       d.get("ADDRESS", "—"),
                "city":          d.get("CITY", "—"),
                "district":      d.get("DISTRICT", "—"),
                "state":         d.get("STATE", "—"),
                "contact":       d.get("CONTACT", "—"),
                "micr_code":     d.get("MICR", "—"),
                "rtgs_enabled":  d.get("RTGS", False),
                "neft_enabled":  d.get("NEFT", False),
                "imps_enabled":  d.get("IMPS", False),
                "upi_enabled":   d.get("UPI", False),
                "swift_code":    d.get("SWIFT", "—"),
                "raw":           d,
                "legal_relevance": {
                    "bank_verified": True,
                    "notes": (
                        f"IFSC {ifsc_code} verified against RBI registry. "
                        "Critical in cheque bounce cases (NI Act S.138) to establish drawee bank. "
                        "Use for attachment orders (CPC Order XXI), fraud tracing, and loan disputes."
                    ),
                },
            }

        if r.status_code == 404:
            return {
                "chain":     "IFSC",
                "status":    "not_found",
                "ifsc_code": ifsc_code,
                "error":     "IFSC not found in RBI registry — may be closed/merged branch",
                "note":      "Verify the IFSC code from the cheque leaf or bank passbook.",
            }

        return {
            "chain":     "IFSC",
            "status":    "api_error",
            "ifsc_code": ifsc_code,
            "error":     f"HTTP {r.status_code}: {r.text[:100]}",
        }

    except Exception as e:
        logger.error(f"[IFSC] Exception: {e}")
        return {"chain": "IFSC", "status": "error", "ifsc_code": ifsc_code, "error": str(e)}
