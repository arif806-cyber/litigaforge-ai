"""
LitigaForge AI — CNR Case Tracking Router

Live CNR lookups use the server-side eCourtsIndia Partner API client.
Illustrative fixtures, when explicitly enabled, are available only through the
labelled /demo/cnr/lookup/{cnr} route and are never a fallback for live routes.
"""
import logging
import os
from datetime import date, timedelta, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from rate_limit import limiter
from sanitizer import sanitize_text
from services import court_data_client

logger = logging.getLogger("litigaforge.cnr")
router = APIRouter(tags=["cnr"])

_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")

# ── CNR validation ────────────────────────────────────────────────────────────
def _validate_cnr(cnr: str) -> str:
    try:
        return court_data_client.normalize_cnr(cnr)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid CNR format. Expected the documented 16-character "
                "format: 4 letters followed by 12 digits."
            ),
        ) from exc


# ── Response schemas ──────────────────────────────────────────────────────────

class HearingEntry(BaseModel):
    date: str                          # ISO-8601 (YYYY-MM-DD)
    purpose: str
    judge: str
    result: Optional[str] = None       # null = future hearing
    next_date: Optional[str] = None
    order_url: Optional[str] = None


class OrderEntry(BaseModel):
    filename: str
    order_date: Optional[str] = None
    description: Optional[str] = None
    order_type: Optional[str] = None
    has_text: bool = False


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
    orders: list[OrderEntry] = Field(default_factory=list)
    order_count: int = 0
    next_hearing: Optional[str] = None
    last_updated: str
    data_source: str = "eCourts India Partner API"
    disclaimer: str = ""


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


# ── Live API helper ───────────────────────────────────────────────────────────

def _as_display_text(value) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value if item)
    return str(value or "")


def _live_response(cnr: str, raw: dict) -> CnrLookupResponse:
    hearings_raw = raw.get("hearings") or []
    hearings = [
        HearingEntry(
            date=str(
                hearing.get("hearingDate")
                or hearing.get("businessOnDate")
                or hearing.get("date")
                or ""
            ),
            purpose=str(
                hearing.get("purposeOfListing")
                or hearing.get("nextPurpose")
                or hearing.get("purpose")
                or "Hearing"
            ),
            judge=str(hearing.get("judge") or hearing.get("courtOf") or ""),
            result=hearing.get("business") or hearing.get("result"),
            next_date=hearing.get("nextHearingDate") or hearing.get("next_date"),
        )
        for hearing in hearings_raw if isinstance(hearing, dict)
    ]
    case_status = str(raw.get("case_status") or "Unknown")
    return CnrLookupResponse(
        cnr=cnr,
        case_number=str(raw.get("case_number") or cnr),
        case_type=str(raw.get("case_type") or ""),
        filing_date=str(raw.get("filing_date") or ""),
        registration_date=str(raw.get("registration_date") or ""),
        court=str(raw.get("court_name") or ""),
        district=str(raw.get("district") or ""),
        state=str(raw.get("state") or ""),
        judge=str(raw.get("judge_name") or ""),
        status=case_status,
        stage=str(raw.get("case_stage") or ""),
        petitioner=_as_display_text(raw.get("petitioner_name")),
        respondent=_as_display_text(raw.get("respondent_name")),
        advocate_petitioner=_as_display_text(raw.get("advocate_petitioner")) or None,
        advocate_respondent=_as_display_text(raw.get("advocate_respondent")) or None,
        subject=str(raw.get("caseCategory") or raw.get("caseTypeSub") or ""),
        under_act=_as_display_text(raw.get("under_act")) or None,
        under_section=str(raw.get("under_section") or "") or None,
        hearings=hearings,
        orders=[
            OrderEntry(
                filename=str(order.get("order_id") or ""),
                order_date=str(order.get("order_date") or "") or None,
                description=str(order.get("description") or "") or None,
                order_type=str(order.get("orderType") or "") or None,
                has_text=bool(order.get("order_text")),
            )
            for order in raw.get("orders") or []
            if isinstance(order, dict) and order.get("order_id")
        ],
        order_count=int(raw.get("order_count") or len(raw.get("orders") or [])),
        next_hearing=str(raw.get("next_hearing_date") or "") or None,
        last_updated=str(raw.get("last_updated") or ""),
        data_source="eCourts India Partner API",
        disclaimer="",
    )


def _raise_upstream_http_error(exc: court_data_client.CourtDataError) -> None:
    status = exc.status_code
    if exc.code == "missing_credentials":
        http_status = 503
    elif exc.code == "timeout":
        http_status = 504
    elif status == 409:
        http_status = 409
    elif status == 404:
        http_status = 404
    elif status == 400:
        http_status = 422
    else:
        # A vendor 401/403 is not this application's user-authentication failure.
        http_status = 503 if status in {401, 402, 403, 429} else 502
    headers = {}
    if exc.retry_after is not None:
        headers["Retry-After"] = str(int(exc.retry_after))
    raise HTTPException(
        status_code=http_status,
        detail={"code": exc.code, "message": exc.user_message},
        headers=headers or None,
    ) from exc


async def _fetch_live_cnr(cnr: str) -> CnrLookupResponse:
    raw = await court_data_client.lookup_cnr(cnr)
    return _live_response(cnr, raw)


# ── Routes ────────────────────────────────────────────────────────────────────

class CnrLookupRequest(BaseModel):
    cnr: str = Field(..., min_length=10, max_length=20, description="eCourts CNR number")


@router.post("/cnr/lookup", response_model=CnrLookupResponse)
@limiter.limit("30/minute")
async def cnr_lookup(request: Request, body: CnrLookupRequest):
    """
    Look up an Indian eCourts CNR (Case Number Record).

    Uses the eCourtsIndia Partner API. Missing configuration and upstream failures
    are returned explicitly; this route never substitutes illustrative data.
    """
    cleaned = _validate_cnr(sanitize_text(body.cnr))
    try:
        return await _fetch_live_cnr(cleaned)
    except court_data_client.CourtDataError as exc:
        _raise_upstream_http_error(exc)


@router.get("/cnr/lookup/{cnr}", response_model=CnrLookupResponse)
@limiter.limit("30/minute")
async def cnr_lookup_get(cnr: str, request: Request):
    """GET variant for shareable links; never falls back to demo data."""
    cleaned = _validate_cnr(sanitize_text(cnr))
    try:
        return await _fetch_live_cnr(cleaned)
    except court_data_client.CourtDataError as exc:
        _raise_upstream_http_error(exc)


def _demo_routes_enabled() -> bool:
    return os.getenv("ECOURTS_DEMO_ROUTES_ENABLED", "").strip().lower() in {
        "1", "true", "yes",
    }


@router.get("/demo/cnr/lookup/{cnr}", response_model=CnrLookupResponse)
async def demo_cnr_lookup(cnr: str):
    """Explicitly labelled illustrative fixture route; disabled unless opted in."""
    if not _demo_routes_enabled():
        raise HTTPException(status_code=404, detail="Demo CNR route is disabled.")
    cleaned = _validate_cnr(sanitize_text(cnr))
    return _make_mock(cleaned)
