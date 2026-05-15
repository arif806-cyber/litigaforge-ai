"""
Department: MCA21 / Company Registry
API: OpenCorporates India (requires free signup) + MCA scrape fallback
     https://api.opencorporates.com/v0.4/companies/search?jurisdiction_code=in

Since all direct MCA21 APIs require auth, this department uses:
  1. OpenCorporates free tier (1000 reqs/day, requires free API key via signup)
  2. Direct data for CIN validation (regex-based offline)

Legal use cases:
  • Company existence verification before filing suit
  • Fraudulent company detection — check if CIN is valid
  • Directors search — identify who to summon
  • Charges / encumbrances on company assets (ROC filing date)
  • Corporate veil piercing — subsidiary → parent mapping
  • Winding up petitions (CA 2013 S.271)
  • NCLT proceedings — verify respondent company status
"""
import re
import os
import logging
import requests

logger = logging.getLogger("litigaforge.chain.mca_company")

OPENCORP_BASE = "https://api.opencorporates.com/v0.4"

# CIN format: U/L + 5 digits + 2-letter state + 4-digit year + PVT/LTD/OPC... + 6 digits
CIN_PATTERN = re.compile(
    r'^[UL]\d{5}[A-Z]{2}\d{4}(?:PLC|PTC|OPC|FLC|GOI|NPL|ULL|ULT)\d{6}$'
)

# LLPIN format: AAA-1234
LLPIN_PATTERN = re.compile(r'^[A-Z]{3}-\d{4}$')


def _validate_cin(cin: str) -> dict:
    """Offline CIN structural validation."""
    cin = cin.strip().upper()
    if CIN_PATTERN.match(cin):
        # Decode CIN structure
        company_status = "Listed" if cin[0] == "L" else "Unlisted"
        nic_code = cin[1:6]
        state_code = cin[6:8]
        year_inc = cin[8:12]
        company_type = re.search(r'(PLC|PTC|OPC|FLC|GOI|NPL|ULL|ULT)', cin).group()
        reg_no = cin[-6:]
        return {
            "valid": True,
            "cin": cin,
            "listing_status": company_status,
            "nic_code": nic_code,
            "state_of_incorporation": state_code,
            "year_of_incorporation": year_inc,
            "company_type": {
                "PLC": "Public Limited Company",
                "PTC": "Private Limited Company",
                "OPC": "One Person Company",
                "FLC": "Foreign Listed Company",
                "GOI": "Government of India company",
                "NPL": "Non-profit Limited",
            }.get(company_type, company_type),
            "registration_number": reg_no,
        }
    return {"valid": False, "cin": cin, "error": "Invalid CIN format"}


def fetch_mca_company(
    company_name: str = None,
    cin: str = None,
    **kwargs,
) -> dict:
    """
    Look up a company in MCA21 / Company Registry.

    Args:
        company_name : Company name to search (e.g. 'Infosys Limited')
        cin          : Corporate Identification Number (21-char)
    """
    if not company_name and not cin:
        return {"chain": "MCA_COMPANY", "status": "skipped", "reason": "No company name or CIN found in case facts"}

    result = {
        "chain":       "MCA_COMPANY",
        "data_source": "MCA21 / OpenCorporates India",
    }

    # Offline CIN validation
    if cin:
        cin_check = _validate_cin(cin.strip())
        result["cin_validation"] = cin_check
        if not cin_check["valid"]:
            result["status"] = "invalid_cin"
            result["error"] = cin_check["error"]
            return result

    # OpenCorporates — requires free API token
    oc_key = os.getenv("OPENCORPORATES_API_KEY", "")
    query = company_name or cin

    if oc_key:
        try:
            params = {
                "q": query,
                "jurisdiction_code": "in",
                "api_token": oc_key,
                "format": "json",
            }
            r = requests.get(f"{OPENCORP_BASE}/companies/search", params=params, timeout=12)
            if r.status_code == 200:
                data = r.json()
                companies = data.get("results", {}).get("companies", [])
                result["status"] = "success"
                result["search_query"] = query
                result["total_results"] = data.get("results", {}).get("total_count", 0)
                result["companies"] = [
                    {
                        "name":               c["company"].get("name"),
                        "company_number":     c["company"].get("company_number"),
                        "jurisdiction":       c["company"].get("jurisdiction_code"),
                        "incorporation_date": c["company"].get("incorporation_date"),
                        "current_status":     c["company"].get("current_status"),
                        "company_type":       c["company"].get("company_type"),
                        "registered_address": c["company"].get("registered_address_in_full"),
                        "mca_url":            c["company"].get("source", {}).get("url"),
                    }
                    for c in companies[:5]
                ]
            else:
                result["status"] = "api_error"
                result["error"] = f"HTTP {r.status_code}: {r.text[:100]}"
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
    else:
        result["status"] = "no_api_key"
        result["search_query"] = query
        if cin:
            result["cin_info"] = _validate_cin(cin.strip())
        result["note"] = (
            "Add OPENCORPORATES_API_KEY (free at opencorporates.com/api_accounts/new) "
            "for live company registry search. CIN structural validation is available without a key."
        )
        result["mca_direct_link"] = f"https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do"
        result["efiling_link"] = "https://efiling.mca.gov.in/eFiling/helpdeskSearch"
        result["legal_relevance"] = {
            "applicable_laws": [
                "Companies Act 2013 — S.7 (formation), S.271 (winding up)",
                "IBC 2016 — corporate insolvency, NCLT proceedings",
                "PMLA 2002 — shell company investigations",
                "SEBI Act — listed company regulatory action",
            ],
            "notes": (
                "CIN (Corporate Identification Number) is essential for any litigation against a company. "
                "Verify existence, registered address, and status before filing. "
                "Director details and charges are available on MCA21 portal."
            ),
        }

    return result
