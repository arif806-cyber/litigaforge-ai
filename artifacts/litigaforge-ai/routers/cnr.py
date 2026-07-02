"""
LitigaForge AI — CNR Case Tracking Router

Provides CNR (Case Number Record) lookup for Indian eCourts cases.
The official eCourts API is CAPTCHA-gated and requires institutional credentials;
this router returns realistic structured data (live mock) while exposing the
same response schema so a real API integration can drop in later.
"""
import logging
import os
import re
from datetime import date, timedelta, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from rate_limit import limiter
from sanitizer import sanitize_text

logger = logging.getLogger("litigaforge.cnr")
router = APIRouter(tags=["cnr"])

_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")

# ── CNR validation ────────────────────────────────────────────────────────────
# Standard eCourts CNR format:  SSCCCCNNNNNNYYYY
#   SS   = 2-char state code   (TL, AP, MH, DL, KA …)
#   CCCC = 4-char court code   (HC01, DC02 …)
#   NNNNNN = 6-digit case seq  (padded)
#   YYYY = 4-digit year
CNR_RE = re.compile(
    r"^[A-Z]{2}[A-Z0-9]{4}\d{6}\d{4}$",  # 16 chars total
    re.IGNORECASE,
)


def _validate_cnr(cnr: str) -> str:
    cleaned = re.sub(r"[\s\-/]", "", cnr.upper().strip())
    if not CNR_RE.match(cleaned):
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid CNR format. Expected 16-character code like "
                "TLHC010012342023 (state + court + seq + year)."
            ),
        )
    return cleaned


# ── Response schemas ──────────────────────────────────────────────────────────

class HearingEntry(BaseModel):
    date: str                          # ISO-8601 (YYYY-MM-DD)
    purpose: str
    judge: str
    result: Optional[str] = None       # null = future hearing
    next_date: Optional[str] = None
    order_url: Optional[str] = None


class CnrLookupResponse(BaseModel):
    cnr: str
    case_number: str
    case_type: str
    filing_date: str
    registration_date: str
    court: str
    district: str
    state: str
    judge: str
    status: str                        # "pending" | "disposed" | "transferred"
    stage: str
    petitioner: str
    respondent: str
    advocate_petitioner: Optional[str] = None
    advocate_respondent: Optional[str] = None
    subject: str
    under_act: Optional[str] = None
    under_section: Optional[str] = None
    hearings: list[HearingEntry]
    next_hearing: Optional[str] = None
    last_updated: str
    data_source: str = "eCourts (demo)"
    disclaimer: str = (
        "This is illustrative data for demonstration purposes. "
        "For authoritative case status visit ecourts.gov.in."
    )


# ── Deterministic mock generator ─────────────────────────────────────────────
# We derive realistic case data deterministically from the CNR so repeated
# calls for the same CNR return consistent results. Users can test with any
# real-looking CNR and get a rich, stable response.

_CASE_TYPES = [
    "Civil Suit", "Criminal Appeal", "Writ Petition", "Matrimonial Case",
    "Motor Accident Claim", "Consumer Complaint", "Labour Dispute",
    "Property Dispute", "Cheque Dishonour", "Arbitration",
]
_STAGES = [
    "Evidence", "Arguments", "Framing of Issues", "Written Statement",
    "Examination-in-Chief", "Cross Examination", "Final Hearing",
    "Judgment Reserved", "Interim Order",
]
_PURPOSES = [
    "Written Statement", "Evidence on affidavit", "Cross Examination",
    "Arguments on interim application", "Final arguments",
    "Framing of issues", "Examination-in-Chief", "Production of documents",
    "Compliance", "Perusal of documents", "Pronouncement of order",
]
_JUDGES = [
    "Hon. Sri T. Mallikarjuna Rao, J.",
    "Hon. Smt. G. Sri Devi, J.",
    "Hon. Sri K. Venkata Ramana, J.",
    "Hon. Sri P. Rajendra Prasad, J.",
    "Hon. Smt. B. Nirmala Reddy, J.",
]
_PETITIONERS = [
    "Ravi Kumar Reddy", "Smt. Padmavathi Devi", "M/s Srinivasa Traders",
    "Anil Kumar Sharma", "Smt. Lakshmi Bai", "Suresh Babu Rao",
]
_RESPONDENTS = [
    "State of Telangana", "District Collector, Hyderabad",
    "M/s National Insurance Co. Ltd.", "Smt. Vasantha Kumari",
    "Union of India & Others", "The Tahsildar, Kukatpally",
]
_ADVOCATES = [
    "Sri M. Janardhan Reddy", "Sri B. Sudhakar", "Smt. R. Kavitha",
    "Sri P. Srinivasulu", "Sri K. Narayana Rao",
]
_SUBJECTS = [
    "Recovery of money", "Injunction for property possession",
    "Compensation for road accident", "Declaration of title",
    "Specific performance of contract", "Dissolution of marriage",
    "Quashing of FIR", "Refund of security deposit",
]
_COURTS = {
    "TL": ("Telangana High Court", "Hyderabad", "Telangana"),
    "AP": ("Andhra Pradesh High Court", "Amaravati", "Andhra Pradesh"),
    "MH": ("Bombay High Court", "Mumbai", "Maharashtra"),
    "DL": ("Delhi High Court", "New Delhi", "Delhi"),
    "KA": ("Karnataka High Court", "Bengaluru", "Karnataka"),
    "TN": ("Madras High Court", "Chennai", "Tamil Nadu"),
    "GJ": ("Gujarat High Court", "Ahmedabad", "Gujarat"),
    "RJ": ("Rajasthan High Court", "Jaipur", "Rajasthan"),
    "UP": ("Allahabad High Court", "Prayagraj", "Uttar Pradesh"),
    "WB": ("Calcutta High Court", "Kolkata", "West Bengal"),
}
_DEFAULT_COURT = ("City Civil Court", "Hyderabad", "Telangana")


def _pick(lst: list, seed: int) -> str:
    return lst[seed % len(lst)]


def _make_mock(cnr: str) -> CnrLookupResponse:
    h = sum(ord(c) * (i + 1) for i, c in enumerate(cnr))
    year_str = cnr[-4:]
    try:
        filing_year = int(year_str)
    except ValueError:
        filing_year = 2022
    filing_year = max(2010, min(filing_year, date.today().year))

    state_code = cnr[:2].upper()
    court_info = _COURTS.get(state_code, _DEFAULT_COURT)

    seq = int(cnr[6:12]) if cnr[6:12].isdigit() else h % 999999
    case_number = f"{_pick(_CASE_TYPES, h).split()[0].upper()[:2]}/{seq}/{filing_year}"

    filing_date = date(filing_year, (h % 11) + 1, (h % 27) + 1)
    reg_date = filing_date + timedelta(days=(h % 7) + 1)

    status = "pending" if (h % 5) != 0 else "disposed"

    # Build hearing history
    hearings = []
    hearing_date = filing_date + timedelta(days=30 + (h % 20))
    today = date.today()

    for i in range(8 + (h % 6)):
        purpose = _pick(_PURPOSES, h + i)
        judge = _pick(_JUDGES, h + i)
        is_past = hearing_date < today
        result = f"Adjourned to next date" if is_past and i < 12 else None
        if is_past and i == 7 and status == "disposed":
            result = "Decree passed in favour of petitioner"
        hearings.append(HearingEntry(
            date=hearing_date.isoformat(),
            purpose=purpose,
            judge=judge,
            result=result if is_past else None,
            next_date=None,
        ))
        hearing_date += timedelta(days=28 + (h % 14) + i * 3)

    # Determine next upcoming hearing
    upcoming = [hh for hh in hearings if hh.date >= today.isoformat()]
    next_hearing = upcoming[0].date if upcoming else None

    return CnrLookupResponse(
        cnr=cnr,
        case_number=case_number,
        case_type=_pick(_CASE_TYPES, h),
        filing_date=filing_date.isoformat(),
        registration_date=reg_date.isoformat(),
        court=court_info[0],
        district=court_info[1],
        state=court_info[2],
        judge=_pick(_JUDGES, h + 3),
        status=status,
        stage=_pick(_STAGES, h + 1) if status == "pending" else "Disposed",
        petitioner=_pick(_PETITIONERS, h),
        respondent=_pick(_RESPONDENTS, h + 2),
        advocate_petitioner=_pick(_ADVOCATES, h),
        advocate_respondent=_pick(_ADVOCATES, h + 4),
        subject=_pick(_SUBJECTS, h + 1),
        under_act="Code of Civil Procedure, 1908" if h % 2 == 0 else "Indian Penal Code, 1860",
        under_section=str(30 + (h % 250)),
        hearings=hearings,
        next_hearing=next_hearing,
        last_updated=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        data_source="eCourts India (demo/illustrative)",
        disclaimer=(
            "This data is generated for demonstration purposes. "
            "For authoritative, real-time case status visit ecourts.gov.in or the "
            "official eCourts Services app."
        ),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

class CnrLookupRequest(BaseModel):
    cnr: str = Field(..., min_length=10, max_length=20, description="eCourts CNR number")


@router.post("/cnr/lookup", response_model=CnrLookupResponse)
@limiter.limit("30/minute")
async def cnr_lookup(request: Request, body: CnrLookupRequest):
    """
    Look up an Indian eCourts CNR (Case Number Record).

    Live eCourts API integration requires institutional credentials (CAPTCHA-gated).
    Returns 503 until a valid API key is configured.
    """
    _validate_cnr(sanitize_text(body.cnr))
    raise HTTPException(
        status_code=503,
        detail=(
            "Live eCourts data is not available. "
            "The official eCourts API requires institutional credentials. "
            "Visit ecourts.gov.in or the eCourts Services app for real-time case status."
        ),
    )


@router.get("/cnr/lookup/{cnr}", response_model=CnrLookupResponse)
@limiter.limit("30/minute")
async def cnr_lookup_get(cnr: str, request: Request):
    """GET variant for shareable links — returns 503 until live API is wired."""
    _validate_cnr(sanitize_text(cnr))
    raise HTTPException(
        status_code=503,
        detail=(
            "Live eCourts data is not available. "
            "The official eCourts API requires institutional credentials. "
            "Visit ecourts.gov.in or the eCourts Services app for real-time case status."
        ),
    )
