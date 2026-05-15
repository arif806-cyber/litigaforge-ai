"""
Department: Pincode / Address Verification
API: Free India Post Pincode API — no key required
     https://api.postalpincode.in/pincode/{pincode}

Returns all post offices, districts, and divisions for a pincode.

Legal use cases:
  • Address verification in property disputes
  • Jurisdiction confirmation (which court has territorial jurisdiction)
  • Service of summons / notice verification
  • Tenant / landlord address in eviction cases
  • Accused address in criminal matters
"""
import re
import time
import logging
import requests

logger = logging.getLogger("litigaforge.chain.pincode")

PINCODE_URL = "https://api.postalpincode.in/pincode/{pin}"


def fetch_pincode(
    pincode: str = None,
    address: str = None,
    **kwargs,
) -> dict:
    """
    Verify an Indian PIN code and get full address details.

    Args:
        pincode : 6-digit India Post pincode
        address : Raw address string — pincode extracted from it if pincode arg missing
    """
    code = pincode
    if not code and address:
        m = re.search(r'\b[1-9]\d{5}\b', address)
        if m:
            code = m.group()

    if not code:
        return {"chain": "PINCODE", "status": "skipped", "reason": "No 6-digit pincode found in case facts"}

    code = str(code).strip()
    logger.info(f"[PINCODE] Looking up pincode: {code}")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; LitigaForge/1.0)",
        "Accept": "application/json",
    })
    adapter = requests.adapters.HTTPAdapter(max_retries=3)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    last_err = None
    for attempt in range(3):
        try:
            r = session.get(PINCODE_URL.format(pin=code), timeout=15)
            break
        except Exception as e:
            last_err = e
            if attempt < 2:
                time.sleep(2)
    else:
        logger.error(f"[PINCODE] All retries failed: {last_err}")
        return {"chain": "PINCODE", "status": "error", "pincode": code, "error": str(last_err)}

    try:
        if r.status_code != 200:
            return {"chain": "PINCODE", "status": "api_error", "pincode": code, "error": f"HTTP {r.status_code}"}

        data = r.json()
        if not data or data[0].get("Status") == "Error":
            return {
                "chain":   "PINCODE",
                "status":  "not_found",
                "pincode": code,
                "error":   "Pincode not found in India Post database",
            }

        record  = data[0]
        offices = record.get("PostOffice") or []
        sample  = offices[0] if offices else {}

        return {
            "chain":       "PINCODE",
            "status":      "success",
            "data_source": "India Post Pincode API (free, no key)",
            "pincode":     code,
            "district":    sample.get("District", "—"),
            "division":    sample.get("Division", "—"),
            "region":      sample.get("Region", "—"),
            "state":       sample.get("State", "—"),
            "country":     sample.get("Country", "India"),
            "post_offices": [
                {
                    "name":            o.get("Name"),
                    "branch_type":     o.get("BranchType"),
                    "delivery_status": o.get("DeliveryStatus"),
                    "taluk":           o.get("Taluk"),
                    "district":        o.get("District"),
                }
                for o in offices[:10]
            ],
            "total_offices": len(offices),
            "legal_relevance": {
                "jurisdiction_state":    sample.get("State", "—"),
                "jurisdiction_district": sample.get("District", "—"),
                "notes": (
                    f"Pincode {code} → {sample.get('District', '')}, {sample.get('State', '')}. "
                    "Used to establish territorial jurisdiction (CPC S.20), "
                    "verify address for summons service, and confirm landlord/tenant location in eviction cases."
                ),
            },
        }

    except Exception as e:
        logger.error(f"[PINCODE] Exception: {e}")
        return {"chain": "PINCODE", "status": "error", "pincode": code, "error": str(e)}
