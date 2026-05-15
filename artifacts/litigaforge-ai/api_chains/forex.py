"""
Department: Forex / Currency Conversion
APIs (all free, no key required):
  1. Frankfurter — https://api.frankfurter.app/latest?from=INR
     ECB (European Central Bank) rates, daily update, very reliable
  2. ExchangeRate-API — https://open.er-api.com/v6/latest/INR
     Open API, no key for latest rates

Legal use cases:
  • Foreign asset valuation — converting overseas property/deposits to INR
  • FEMA violations — quantifying forex transaction amounts in INR
  • NRI divorce — converting overseas assets to INR for partition
  • Customs / import fraud — invoice value conversion
  • Money laundering — tracing foreign remittances in INR equivalent
  • Foreign investment disputes — FEMA 1999, RBI guidelines
"""
import logging
import requests

logger = logging.getLogger("litigaforge.chain.forex")

FRANKFURTER = "https://api.frankfurter.app"
EXCHANGERATE = "https://open.er-api.com/v6/latest"

LEGAL_CURRENCIES = {
    "USD": "US Dollar — Foreign investment, FEMA, NRI remittances",
    "GBP": "British Pound — UK NRI, FEMA transactions",
    "EUR": "Euro — EU trade, import fraud",
    "AED": "UAE Dirham — Gulf NRI remittances, Hawala",
    "SGD": "Singapore Dollar — Singapore NRI assets",
    "SAR": "Saudi Riyal — Gulf worker remittances",
    "CHF": "Swiss Franc — secret Swiss accounts (FEMA/PMLA)",
    "JPY": "Japanese Yen — Japanese investment disputes",
    "CAD": "Canadian Dollar — Canada NRI assets",
    "AUD": "Australian Dollar — Australia NRI assets",
}


def _frankfurter_rates(base: str = "INR") -> dict:
    try:
        r = requests.get(f"{FRANKFURTER}/latest", params={"from": base}, timeout=10)
        if r.status_code == 200:
            return {"ok": True, "data": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _exchangerate_rates(base: str = "INR") -> dict:
    try:
        r = requests.get(f"{EXCHANGERATE}/{base}", timeout=10)
        if r.status_code == 200:
            return {"ok": True, "data": r.json()}
        return {"ok": False, "error": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _convert(amount_inr: float, rate_usd_inr: float) -> dict:
    """Convert INR amount to major currencies."""
    conversions = {}
    if rate_usd_inr:
        conversions["USD"] = round(amount_inr / rate_usd_inr, 2)
    return conversions


def fetch_forex(
    currency: str = None,
    amount: float = None,
    foreign_amount: float = None,
    **kwargs,
) -> dict:
    """
    Fetch live INR forex rates for legal proceedings.

    Args:
        currency     : Target currency code (e.g. 'USD', 'GBP') — returns INR rate
        amount       : INR amount to convert
        foreign_amount: Foreign currency amount to convert to INR
    """
    logger.info(f"[FOREX] Fetching INR rates (currency={currency})")

    # Try Frankfurter first (ECB rates — most authoritative for court use)
    result_from_inr = _frankfurter_rates("INR")
    result_to_inr   = None

    # Also get rates in USD base for cross-conversion
    if currency and currency.upper() != "INR":
        result_to_inr = _frankfurter_rates(currency.upper())

    if not result_from_inr["ok"]:
        # Fallback to ExchangeRate-API
        result_from_inr = _exchangerate_rates("INR")

    if not result_from_inr["ok"]:
        return {
            "chain":  "FOREX",
            "status": "error",
            "error":  result_from_inr.get("error", "Both forex APIs failed"),
        }

    data = result_from_inr["data"]
    rates = data.get("rates", {})
    base  = data.get("base", "INR")
    date  = data.get("date") or data.get("time_last_update_utc", "")[:10]

    # Build key rates from INR perspective
    inr_to = {k: v for k, v in rates.items() if k in LEGAL_CURRENCIES}

    # 1 INR = X foreign; so 1 foreign = (1/X) INR
    inr_from = {
        k: round(1 / v, 4) if v else None
        for k, v in inr_to.items()
    }

    conversions = {}
    if amount and isinstance(amount, (int, float)):
        conversions["inr_to_foreign"] = {
            k: round(amount * v, 2)
            for k, v in inr_to.items()
        }
    if foreign_amount and currency and isinstance(foreign_amount, (int, float)):
        inr_rate = inr_from.get(currency.upper())
        if inr_rate:
            conversions["foreign_to_inr"] = {
                "currency":       currency.upper(),
                "foreign_amount": foreign_amount,
                "inr_equivalent": round(foreign_amount * inr_rate, 2),
                "rate_used":      f"1 {currency.upper()} = ₹{inr_rate}",
            }

    return {
        "chain":       "FOREX",
        "status":      "success",
        "data_source": "Frankfurter (ECB rates) / ExchangeRate-API — free, no key",
        "rate_date":   date,
        "base":        "INR",
        "1_inr_equals": inr_to,
        "1_foreign_equals_inr": inr_from,
        "conversions": conversions if conversions else None,
        "legally_relevant_currencies": {
            k: {
                "rate_1_inr":    inr_to.get(k),
                "rate_1_foreign_inr": inr_from.get(k),
                "legal_note":    LEGAL_CURRENCIES[k],
            }
            for k in LEGAL_CURRENCIES if k in inr_to
        },
        "legal_relevance": {
            "applicable_laws": [
                "FEMA 1999 — Foreign Exchange Management Act",
                "PMLA 2002 — quantifying money laundering proceeds in INR",
                "FCRA 2010 — foreign contribution valuation",
                "ITA 1961 S.5 — foreign income taxable in INR",
                "CPC Order XXI — attachment of foreign assets",
            ],
            "notes": (
                f"Rates as of {date} (ECB/Frankfurter). "
                "For court admissibility, use RBI reference rate (rbi.org.in) on the exact transaction date. "
                "These rates are for preliminary valuation and legal strategy."
            ),
        },
    }
