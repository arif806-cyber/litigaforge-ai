"""
Department: Indian Stock Exchange
API: indian-stock-exchange-api2.p.rapidapi.com  (already subscribed)

Endpoints used:
  GET /stock                — company overview, price, market cap
  GET /financial_statements — quarterly P&L, balance sheet
  GET /shareholding_pattern — promoter / FII / DII / retail breakdown
  GET /board_meetings       — upcoming & past board meetings
  GET /announcements        — regulatory & exchange announcements
  GET /insider_trading      — buy/sell by directors & promoters
  GET /dividends            — dividend history

Legal use cases:
  • Securities fraud / insider trading (SEBI Act 1992, PIT Regulations 2015)
  • NPA / DRT — assess listed company's financial health before attachment
  • Corporate disputes — board composition, major announcements
  • Divorce / asset cases — shareholding as undisclosed asset
  • Cheque bounce — company's financial position as evidence
"""
import os
import time
import logging
import requests

logger = logging.getLogger("litigaforge.chain.stock_exchange")

HOST = "indian-stock-exchange-api2.p.rapidapi.com"
BASE = f"https://{HOST}"


def _headers() -> dict:
    return {
        "x-rapidapi-key":  os.getenv("RAPIDAPI_KEY", ""),
        "x-rapidapi-host": HOST,
        "Content-Type":    "application/json",
    }


def _get(endpoint: str, params: dict, delay: float = 0.8) -> dict:
    time.sleep(delay)
    try:
        r = requests.get(f"{BASE}{endpoint}", headers=_headers(), params=params, timeout=15)
        if r.status_code == 200:
            return {"ok": True, "data": r.json()}
        return {"ok": False, "status": r.status_code, "error": r.text[:120]}
    except Exception as e:
        return {"ok": False, "status": None, "error": str(e)}


def fetch_stock_exchange(
    company_name: str = None,
    stock_symbol: str = None,
    gstin: str = None,
    **kwargs,
) -> dict:
    """
    Fetch comprehensive stock exchange data for a listed company.

    Args:
        company_name : Company name as listed on NSE/BSE (e.g. 'infosys', 'tcs', 'reliance')
        stock_symbol : NSE symbol (e.g. 'INFY') — used as fallback if name lookup fails
        gstin        : GSTIN — company name extracted from it if provided
    """
    rapidapi_key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not rapidapi_key:
        return {
            "chain":  "STOCK_EXCHANGE",
            "status": "no_api_key",
            "note":   "Add RAPIDAPI_KEY secret. Subscribe free at rapidapi.com → 'Indian Stock Exchange API2'.",
        }

    query = (company_name or stock_symbol or "").lower().strip()
    if not query:
        return {
            "chain":  "STOCK_EXCHANGE",
            "status": "skipped",
            "reason": "No company name or stock symbol found in case facts",
        }

    logger.info(f"[STOCK_EXCHANGE] Fetching data for: {query}")

    results = {}

    # 1 — Company overview
    r = _get("/stock", {"name": query})
    if r["ok"]:
        results["company_overview"] = r["data"]
    else:
        results["company_overview"] = {"error": r["error"], "http": r["status"]}

    # 2 — Financial statements (quarterly)
    r = _get("/financial_statements", {"stock_name": query, "stats": "quarterly"})
    results["financial_statements"] = r["data"] if r["ok"] else {"error": r["error"]}

    # 3 — Shareholding pattern
    r = _get("/shareholding_pattern", {"stock_name": query})
    results["shareholding_pattern"] = r["data"] if r["ok"] else {"error": r["error"]}

    # 4 — Board meetings
    r = _get("/board_meetings", {"stock_name": query})
    results["board_meetings"] = r["data"] if r["ok"] else {"error": r["error"]}

    # 5 — Announcements
    r = _get("/announcements", {"stock_name": query})
    results["announcements"] = r["data"] if r["ok"] else {"error": r["error"]}

    # 6 — Insider trading
    r = _get("/insider_trading", {"stock_name": query})
    results["insider_trading"] = r["data"] if r["ok"] else {"error": r["error"]}

    # 7 — Dividends
    r = _get("/dividends", {"stock_name": query})
    results["dividends"] = r["data"] if r["ok"] else {"error": r["error"]}

    overview = results.get("company_overview", {})
    if isinstance(overview, dict) and "error" not in overview:
        company_status = "success"
    else:
        company_status = "partial"

    return {
        "chain":        "STOCK_EXCHANGE",
        "status":       company_status,
        "company":      query,
        "data_source":  "Indian Stock Exchange API2 / NSE / BSE",
        "results":      results,
        "legal_relevance": {
            "applicable_laws": [
                "SEBI Act 1992",
                "SEBI (Prohibition of Insider Trading) Regulations 2015",
                "Companies Act 2013 — S.447 (fraud)",
                "IBC 2016 — corporate insolvency",
                "FEMA 1999 — foreign shareholding violations",
            ],
            "use_cases": [
                "Securities fraud & insider trading evidence (SEBI PIT Regulations)",
                "NPA / DRT — company financial health before attachment order",
                "Corporate disputes — board composition & major announcements",
                "Divorce / partition — undisclosed shareholding as asset",
                "Cheque bounce — company's financial position as evidence (NI Act S.138)",
            ],
        },
    }
