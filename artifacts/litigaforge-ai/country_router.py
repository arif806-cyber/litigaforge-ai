from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import httpx

router = APIRouter()

COUNTRY_CONFIG = {
  "IN": {
    "name": "India",
    "flag": "🇮🇳",
    "language": "en",
    "currency": "INR",
    "currency_symbol": "₹",
    "legal_system": "Common Law",
    "top_services": [
      "Court Case Filing",
      "Consumer Disputes",
      "Property Law",
      "Motor Accident Claims",
      "Family Law",
      "Criminal Defense"
    ],
    "courts": [
      "Supreme Court of India",
      "High Courts",
      "District Courts",
      "Consumer Forums",
      "Lok Adalat"
    ],
    "emergency_legal": "NALSA: 15100",
    "bar_council": "Bar Council of India",
    "primary_laws": [
      "Indian Penal Code",
      "Code of Civil Procedure",
      "Consumer Protection Act 2019",
      "Motor Vehicles Act"
    ],
    "authoritative_sources": [
      "India Code (indiacode.nic.in)",
      "Supreme Court of India (main.sci.gov.in)",
      "eCourts India (ecourts.gov.in)",
      "IndianKanoon (indiankanoon.org)"
    ],
    "payment_methods": ["Razorpay", "UPI", "NetBanking"]
  },
  "US": {
    "name": "United States",
    "flag": "🇺🇸",
    "language": "en",
    "currency": "USD",
    "currency_symbol": "$",
    "legal_system": "Common Law (Federal + State)",
    "top_services": [
      "Contract Review",
      "Employment Law",
      "Immigration Help",
      "Small Claims",
      "Tenant Rights",
      "Personal Injury"
    ],
    "courts": [
      "Supreme Court",
      "Federal Courts",
      "State Courts",
      "Small Claims Court"
    ],
    "emergency_legal": "Legal Aid: 1-800-398-4529",
    "bar_council": "American Bar Association",
    "primary_laws": [
      "US Constitution",
      "Federal Rules of Civil Procedure",
      "ADA",
      "FLSA Employment Law"
    ],
    "authoritative_sources": [
      "Legal Information Institute (law.cornell.edu)",
      "GovInfo / U.S. Code (govinfo.gov)",
      "U.S. Courts (uscourts.gov)",
      "CourtListener (courtlistener.com)"
    ],
    "payment_methods": ["Stripe", "PayPal", "Credit Card"]
  },
  "GB": {
    "name": "United Kingdom",
    "flag": "🇬🇧",
    "language": "en",
    "currency": "GBP",
    "currency_symbol": "£",
    "legal_system": "Common Law",
    "top_services": [
      "Employment Tribunal",
      "Housing Disputes",
      "Immigration",
      "Divorce & Family",
      "Contract Disputes",
      "Personal Injury"
    ],
    "courts": [
      "Supreme Court UK",
      "Court of Appeal",
      "Crown Court",
      "Magistrates Court",
      "Employment Tribunal"
    ],
    "emergency_legal": "Legal Aid: 0345 345 4 345",
    "bar_council": "Bar Council of England and Wales",
    "primary_laws": [
      "Equality Act 2010",
      "Employment Rights Act 1996",
      "Housing Act 2004",
      "Consumer Rights Act 2015"
    ],
    "authoritative_sources": [
      "UK Legislation (legislation.gov.uk)",
      "GOV.UK (gov.uk)",
      "Find Case Law (caselaw.nationalarchives.gov.uk)"
    ],
    "payment_methods": ["Stripe", "PayPal", "Credit Card"]
  },
  "AE": {
    "name": "United Arab Emirates",
    "flag": "🇦🇪",
    "language": "ar",
    "language_secondary": "en",
    "currency": "AED",
    "currency_symbol": "د.إ",
    "legal_system": "Civil Law + Sharia",
    "top_services": [
      "Labor Disputes",
      "Tenancy Contracts",
      "Business Setup",
      "Visa Issues",
      "Cheque Bounce Cases",
      "Traffic Accidents"
    ],
    "courts": [
      "Federal Supreme Court",
      "Dubai Courts",
      "DIFC Courts",
      "Abu Dhabi Courts"
    ],
    "emergency_legal": "Ministry of Justice: 800-ADGM",
    "bar_council": "UAE Ministry of Justice",
    "primary_laws": [
      "UAE Labor Law",
      "UAE Penal Code",
      "Tenancy Law Dubai",
      "Commercial Companies Law"
    ],
    "authoritative_sources": [
      "UAE Legislation Portal (uaelegislation.gov.ae)",
      "UAE Ministry of Justice (moj.gov.ae)",
      "The Official Portal of the UAE Government (u.ae)"
    ],
    "payment_methods": ["Stripe", "Credit Card", "Bank Transfer"]
  },
  "AU": {
    "name": "Australia",
    "flag": "🇦🇺",
    "language": "en",
    "currency": "AUD",
    "currency_symbol": "A$",
    "legal_system": "Common Law",
    "top_services": [
      "Employment Rights",
      "Family Law",
      "Migration Help",
      "Consumer Claims",
      "Property Disputes",
      "Personal Injury"
    ],
    "courts": [
      "High Court of Australia",
      "Federal Court",
      "Family Court",
      "Magistrates Court"
    ],
    "emergency_legal": "LawAccess: 1300 888 529",
    "bar_council": "Law Council of Australia",
    "primary_laws": [
      "Fair Work Act 2009",
      "Australian Consumer Law",
      "Family Law Act 1975",
      "Migration Act 1958"
    ],
    "authoritative_sources": [
      "Federal Register of Legislation (legislation.gov.au)",
      "AustLII (austlii.edu.au)",
      "Fair Work Ombudsman (fairwork.gov.au)"
    ],
    "payment_methods": ["Stripe", "PayPal", "Credit Card"]
  },
  "CA": {
    "name": "Canada",
    "flag": "🇨🇦",
    "language": "en",
    "language_secondary": "fr",
    "currency": "CAD",
    "currency_symbol": "CA$",
    "legal_system": "Common Law + Civil Law (Quebec)",
    "top_services": [
      "Immigration & PR",
      "Employment Law",
      "Family Law",
      "Tenant Rights",
      "Criminal Defense",
      "Business Law"
    ],
    "courts": [
      "Supreme Court of Canada",
      "Federal Court",
      "Provincial Courts",
      "Small Claims Court"
    ],
    "emergency_legal": "Legal Aid Ontario: 1-800-668-8258",
    "bar_council": "Law Society of Canada",
    "primary_laws": [
      "Canadian Charter of Rights",
      "Employment Standards Act",
      "Immigration IRPA",
      "Consumer Protection Act"
    ],
    "authoritative_sources": [
      "Justice Laws Website (laws-lois.justice.gc.ca)",
      "CanLII (canlii.org)",
      "Supreme Court of Canada (scc-csc.ca)"
    ],
    "payment_methods": ["Stripe", "PayPal", "Credit Card"]
  },
  "SG": {
    "name": "Singapore",
    "flag": "🇸🇬",
    "language": "en",
    "currency": "SGD",
    "currency_symbol": "S$",
    "legal_system": "Common Law",
    "top_services": [
      "Employment Disputes",
      "Business Contracts",
      "Tenancy Issues",
      "Family Law",
      "IP Protection",
      "Startup Legal"
    ],
    "courts": [
      "Court of Appeal",
      "High Court",
      "State Courts",
      "Employment Claims Tribunal"
    ],
    "emergency_legal": "Community Legal Clinics: 1800-CALL-LAW",
    "bar_council": "Law Society of Singapore",
    "primary_laws": [
      "Employment Act",
      "Companies Act",
      "Women's Charter",
      "Consumer Protection Act"
    ],
    "authoritative_sources": [
      "Singapore Statutes Online (sso.agc.gov.sg)",
      "Singapore Courts (judiciary.gov.sg)",
      "Attorney-General's Chambers (agc.gov.sg)"
    ],
    "payment_methods": ["Stripe", "PayNow", "Credit Card"]
  },
  "DE": {
    "name": "Germany",
    "flag": "🇩🇪",
    "language": "de",
    "language_secondary": "en",
    "currency": "EUR",
    "currency_symbol": "€",
    "legal_system": "Civil Law",
    "top_services": [
      "Employment Law",
      "Tenancy Rights",
      "Consumer Protection",
      "Family Law",
      "Data Privacy GDPR",
      "Business Law"
    ],
    "courts": [
      "Federal Constitutional Court",
      "Federal Court of Justice",
      "Labour Courts",
      "Administrative Courts"
    ],
    "emergency_legal": "Rechtsantragstelle at local courts",
    "bar_council": "German Bar Association (DAV)",
    "primary_laws": [
      "German Civil Code BGB",
      "Employment Protection Act",
      "Tenancy Law BGB",
      "GDPR"
    ],
    "authoritative_sources": [
      "Gesetze im Internet (gesetze-im-internet.de)",
      "Federal Court of Justice (bundesgerichtshof.de)",
      "Federal Ministry of Justice (bmj.de)"
    ],
    "payment_methods": ["Stripe", "SEPA", "Credit Card"]
  }
}


@router.get("/api/country-detect")
async def detect_country(request: Request):
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://ipapi.co/{ip}/json/",
                timeout=5.0
            )
            data = response.json()
            country_code = data.get("country_code", "IN")

            config = COUNTRY_CONFIG.get(country_code, COUNTRY_CONFIG["IN"])

            return JSONResponse({
                "success": True,
                "country_code": country_code,
                "ip": ip,
                "config": config,
                "detected_city": data.get("city", ""),
                "detected_region": data.get("region", "")
            })
    except Exception:
        return JSONResponse({
            "success": True,
            "country_code": "IN",
            "config": COUNTRY_CONFIG["IN"],
            "detected_city": "",
            "detected_region": ""
        })


@router.get("/api/country/{code}")
async def get_country_config(code: str):
    config = COUNTRY_CONFIG.get(code.upper(), COUNTRY_CONFIG["IN"])
    return JSONResponse({
        "success": True,
        "country_code": code.upper(),
        "config": config
    })


@router.get("/api/countries/all")
async def get_all_countries():
    return JSONResponse({
        "success": True,
        "countries": [
            {
                "code": k,
                "name": v["name"],
                "flag": v["flag"]
            }
            for k, v in COUNTRY_CONFIG.items()
        ]
    })
