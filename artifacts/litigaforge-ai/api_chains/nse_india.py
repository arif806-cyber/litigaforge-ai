"""
Department: NSE India — Live Stock Market Data
API: NSE India public API — completely FREE, no key required
     https://www.nseindia.com/api/

Endpoints used:
  GET /api/quote-equity?symbol=INFY          — live price, OHLC, delivery %
  GET /api/equity-stockIndices?index=NIFTY50 — full index snapshot
  GET /api/company-corporates?symbol=INFY&issuer=announcement — announcements
  GET /api/corporates-financial-data?symbol=INFY&financial=annual — financials

Legal use cases:
  • Securities fraud / insider trading (SEBI PIT Regulations 2015)
  • NPA / DRT — listed company's live market value for attachment
  • Divorce / asset valuation — share price at date of separation
  • Cheque bounce — company's current market standing as evidence
  • Contempt of court — verify if suspended trading resumes
"""
import time
import logging
import requests

logger = logging.getLogger("litigaforge.chain.nse_india")

BASE = "https://www.nseindia.com"
NSE_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.nseindia.com/",
    "Connection":      "keep-alive",
}

# Symbol aliases — common legal references vs NSE symbols
SYMBOL_MAP = {
    "infosys": "INFY", "tcs": "TCS", "reliance": "RELIANCE",
    "wipro": "WIPRO", "hdfc": "HDFCBANK", "hdfc bank": "HDFCBANK",
    "icici": "ICICIBANK", "icici bank": "ICICIBANK", "sbi": "SBIN",
    "state bank": "SBIN", "bajaj": "BAJFINANCE", "bajaj finance": "BAJFINANCE",
    "adani": "ADANIENT", "ongc": "ONGC", "ntpc": "NTPC",
    "coal india": "COALINDIA", "hindalco": "HINDALCO",
    "mahindra": "M&M", "maruti": "MARUTI", "itc": "ITC",
    "bharti airtel": "BHARTIARTL", "airtel": "BHARTIARTL",
    "sun pharma": "SUNPHARMA", "dr reddy": "DRREDDY", "cipla": "CIPLA",
    "hero motocorp": "HEROMOTOCO", "axis bank": "AXISBANK",
    "kotak": "KOTAKBANK", "kotak mahindra": "KOTAKBANK",
    "l&t": "LT", "larsen": "LT", "ultratech": "ULTRACEMCO",
    "asian paints": "ASIANPAINT", "hul": "HINDUNILVR",
    "hindustan unilever": "HINDUNILVR", "nestle": "NESTLEIND",
    "titan": "TITAN", "bajaj auto": "BAJAJ-AUTO",
}


def _get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(NSE_HEADERS)
    # Warm up session with homepage to get cookies
    try:
        s.get(BASE, timeout=8)
    except Exception:
        pass
    return s


def _safe_get(session, url: str, params: dict = None) -> dict:
    time.sleep(0.5)
    try:
        r = session.get(url, params=params, timeout=12)
        if r.status_code == 200:
            return {"ok": True, "data": r.json()}
        return {"ok": False, "status": r.status_code, "error": r.text[:120]}
    except Exception as e:
        return {"ok": False, "status": None, "error": str(e)}


def _resolve_symbol(company_name: str) -> str:
    """Convert company name to NSE symbol."""
    low = company_name.lower().strip()
    if low in SYMBOL_MAP:
        return SYMBOL_MAP[low]
    # Try partial match
    for key, sym in SYMBOL_MAP.items():
        if key in low or low in key:
            return sym
    # Assume it's already a symbol (uppercase it)
    return low.upper().replace(" ", "")


def fetch_nse_india(
    company_name: str = None,
    stock_symbol: str = None,
    **kwargs,
) -> dict:
    """
    Fetch live NSE data for a listed company — free, no API key.

    Args:
        company_name : Company name (e.g. 'Infosys', 'TCS', 'Reliance')
        stock_symbol : NSE symbol directly (e.g. 'INFY', 'TCS')
    """
    raw = stock_symbol or company_name or ""
    if not raw:
        return {"chain": "NSE_INDIA", "status": "skipped", "reason": "No company name or NSE symbol in case facts"}

    symbol = _resolve_symbol(raw) if not stock_symbol else raw.strip().upper()
    logger.info(f"[NSE_INDIA] Fetching: {symbol} (from '{raw}')")

    session = _get_session()
    results = {}

    # 1 — Live quote
    r = _safe_get(session, f"{BASE}/api/quote-equity", {"symbol": symbol})
    if r["ok"]:
        d = r["data"]
        pd = d.get("priceInfo", {})
        i = d.get("info", {})
        md = d.get("metadata", {})
        results["live_quote"] = {
            "symbol":           symbol,
            "company":         i.get("companyName", "—"),
            "isin":            i.get("isin", "—"),
            "industry":        i.get("industry", "—"),
            "series":          md.get("series", "—"),
            "last_price":      pd.get("lastPrice"),
            "open":            pd.get("open"),
            "high":            pd.get("intraDayHighLow", {}).get("max"),
            "low":             pd.get("intraDayHighLow", {}).get("min"),
            "close_prev":      pd.get("previousClose"),
            "change":          pd.get("change"),
            "pct_change":      pd.get("pChange"),
            "week_52_high":    pd.get("weekHighLow", {}).get("max"),
            "week_52_low":     pd.get("weekHighLow", {}).get("min"),
            "market_cap":      md.get("totalTradedValue"),
            "face_value":      md.get("faceValue"),
            "listing_date":    i.get("listingDate"),
        }
    else:
        results["live_quote"] = {"error": r["error"], "http": r.get("status")}

    # 2 — Index membership (is it in Nifty 50, Nifty 500?)
    r2 = _safe_get(session, f"{BASE}/api/equity-stockIndices", {"index": "NIFTY 50"})
    if r2["ok"]:
        nifty50_symbols = [x.get("symbol") for x in r2["data"].get("data", [])]
        results["nifty50_member"] = symbol in nifty50_symbols

    # 3 — Company announcements (recent regulatory events)
    r3 = _safe_get(session, f"{BASE}/api/company-corporates", {"symbol": symbol, "issuer": "announcement"})
    if r3["ok"] and isinstance(r3["data"], list):
        results["recent_announcements"] = r3["data"][:5]

    # 4 — Financial results
    r4 = _safe_get(session, f"{BASE}/api/corporates-financial-data", {"symbol": symbol, "financial": "annual"})
    if r4["ok"]:
        results["financial_results"] = r4["data"]

    quote = results.get("live_quote", {})
    status = "success" if "last_price" in quote else "partial"

    return {
        "chain":       "NSE_INDIA",
        "status":      status,
        "symbol":      symbol,
        "data_source": "NSE India (National Stock Exchange) — live public API, no key",
        "results":     results,
        "legal_relevance": {
            "applicable_laws": [
                "SEBI Act 1992 — securities fraud, market manipulation",
                "SEBI (Prohibition of Insider Trading) Regulations 2015",
                "Companies Act 2013 S.447 — fraud in listed companies",
                "IBC 2016 — market value for corporate insolvency proceedings",
                "FEMA 1999 — FII/FPI shareholding limits",
            ],
            "use_cases": [
                "Live share price for court-ordered asset valuation (divorce, partition)",
                "Price history for insider trading investigation (SEBI PIT)",
                "52-week range for NPA attachment — current market value",
                "Announcements for corporate fraud evidence",
                "Nifty 50 membership — credibility of company in proceedings",
            ],
        },
    }


def fetch_nse_index(index_name: str = "NIFTY 50") -> dict:
    """Fetch full index snapshot — all constituent stocks with live prices."""
    session = _get_session()
    r = _safe_get(session, f"{BASE}/api/equity-stockIndices", {"index": index_name})
    if not r["ok"]:
        return {"chain": "NSE_INDEX", "status": "error", "error": r["error"]}
    d = r["data"]
    return {
        "chain":       "NSE_INDEX",
        "status":      "success",
        "data_source": "NSE India — free public API",
        "index":       index_name,
        "timestamp":   d.get("timestamp"),
        "advances":    d.get("advance", {}).get("advances"),
        "declines":    d.get("advance", {}).get("declines"),
        "unchanged":   d.get("advance", {}).get("unchanged"),
        "constituents": d.get("data", [])[:10],
    }
