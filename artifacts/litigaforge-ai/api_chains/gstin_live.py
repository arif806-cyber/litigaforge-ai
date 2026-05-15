"""
Department: GST / GSTIN — Live Lookup
API 1 (RapidAPI, free): gst-return-status.p.rapidapi.com
  GET /gst/{gstin}  — returns business name, status, PAN, filing history

API 2 (fallback): API Setu GST endpoint (if API_SETU_KEY set)

Legal use cases:
  • GST fraud — evasion, fake invoicing, bogus ITC claims
  • Attachment proceedings — verify active business before attachment
  • Cheque bounce — company's GST filing as proof of business activity
  • Insolvency — check last return filed date
  • NPA / DRT — verify active GST registration of debtor company
"""
import os
import logging
import requests

logger = logging.getLogger("litigaforge.chain.gstin_live")

RAPIDAPI_HOST = "gst-return-status.p.rapidapi.com"


def _rapidapi_headers() -> dict:
    return {
        "x-rapidapi-key":  os.getenv("RAPIDAPI_KEY", ""),
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type":    "application/json",
    }


def _parse_rapidapi(data: dict, gstin: str) -> dict:
    d = data.get("data") or data
    returns = d.get("returns") or d.get("filingHistory") or []
    last_return = returns[0] if returns else {}
    return {
        "chain":               "GSTIN",
        "status":              "success",
        "data_source":         "RapidAPI / GST Return Status (NIC/GSTN)",
        "gstin":               gstin,
        "legal_name":          d.get("lgnm") or d.get("legal_name") or "—",
        "trade_name":          d.get("tradeNam") or d.get("trade_name") or "—",
        "pan":                 d.get("pan") or d.get("PAN") or gstin[2:12],
        "registration_status": d.get("sts") or d.get("status") or "—",
        "taxpayer_type":       d.get("dty") or d.get("taxpayer_type") or "—",
        "state_jurisdiction":  d.get("stj") or d.get("state") or "—",
        "centre_jurisdiction": d.get("ctj") or "—",
        "registration_date":   d.get("rgdt") or d.get("registration_date") or "—",
        "last_updated":        d.get("lstupdt") or "—",
        "last_return_type":    last_return.get("rtntype") or last_return.get("return_type") or "—",
        "last_return_period":  last_return.get("taxp") or last_return.get("period") or "—",
        "last_return_status":  last_return.get("status") or "—",
        "last_return_date":    last_return.get("dof") or last_return.get("date_of_filing") or "—",
        "pending_returns":     sum(1 for r in returns if r.get("status", "").upper() != "FILED"),
        "total_returns":       len(returns),
        "raw":                 d,
        "legal_relevance": {
            "active_business":    (d.get("sts") or "").upper() in ("ACTIVE", "ACT"),
            "returns_compliant":  len([r for r in returns if r.get("status", "").upper() == "FILED"]) > 0,
            "notes": (
                f"GSTIN {gstin} verified against GSTN via NIC. "
                "Registration status and filing history are admissible evidence in GST fraud cases (CGST Act 2017 S.132). "
                "Non-filing or suspended GSTIN is evidence of business irregularity in NPA/DRT and insolvency proceedings."
            ),
        },
    }


def fetch_gstin_live(
    gstin: str = None,
    **kwargs,
) -> dict:
    """
    Live GSTIN lookup. Priority: RapidAPI → clear error (no fake data).

    Args:
        gstin : 15-character GSTIN (e.g. 36AAAAA0000A1ZA)
    """
    if not gstin:
        return {"chain": "GSTIN", "status": "skipped", "reason": "No GSTIN found in case facts"}

    gstin = gstin.strip().upper()
    if len(gstin) != 15:
        return {"chain": "GSTIN", "status": "error", "gstin": gstin, "reason": f"Invalid GSTIN length ({len(gstin)} chars, need 15)"}

    rapidapi_key = os.getenv("RAPIDAPI_KEY", "").strip()

    # ── RapidAPI GST Return Status ─────────────────────────────────────────────
    if rapidapi_key:
        logger.info(f"[GSTIN_LIVE] RapidAPI lookup for {gstin}")
        try:
            url = f"https://{RAPIDAPI_HOST}/gst/{gstin}"
            r = requests.get(url, headers=_rapidapi_headers(), timeout=15)
            logger.info(f"[GSTIN_LIVE] HTTP {r.status_code}")

            if r.status_code == 200:
                data = r.json()
                if data.get("success") is False or data.get("error"):
                    return {
                        "chain":  "GSTIN",
                        "status": "not_found",
                        "gstin":  gstin,
                        "error":  data.get("message") or "GSTIN not found in GSTN",
                        "note":   "Verify the GSTIN format — 15 chars, e.g. 36AAAAA0000A1ZA",
                    }
                return _parse_rapidapi(data, gstin)

            if r.status_code in (401, 403):
                return {
                    "chain":  "GSTIN",
                    "status": "auth_failed",
                    "gstin":  gstin,
                    "error":  f"HTTP {r.status_code} — Subscribe to 'GST Return Status' on rapidapi.com first",
                }
            if r.status_code == 429:
                return {"chain": "GSTIN", "status": "rate_limited", "gstin": gstin, "error": "RapidAPI rate limit — retry shortly"}

            return {"chain": "GSTIN", "status": "api_error", "gstin": gstin, "error": f"HTTP {r.status_code}: {r.text[:150]}"}

        except Exception as e:
            logger.error(f"[GSTIN_LIVE] RapidAPI exception: {e}")
            return {"chain": "GSTIN", "status": "error", "gstin": gstin, "error": str(e)}

    # ── No key ─────────────────────────────────────────────────────────────────
    return {
        "chain":  "GSTIN",
        "status": "no_api_key",
        "gstin":  gstin,
        "note":   (
            "Add RAPIDAPI_KEY and subscribe to 'GST Return Status' on rapidapi.com "
            "for live GSTIN lookup. Free tier available."
        ),
    }
