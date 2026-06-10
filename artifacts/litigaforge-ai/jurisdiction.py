"""Jurisdiction helpers — make AI legal answers, research, and documents country-specific.

Reuses the rich per-country legal metadata in ``country_router.COUNTRY_CONFIG``
(legal system, courts, primary laws, currency, bar council) so every AI prompt
is tailored to the user's selected country instead of defaulting to India.
"""
from urllib.parse import quote_plus

from country_router import COUNTRY_CONFIG

DEFAULT_CODE = "IN"

# Per-country case-law search providers. {q} is the URL-encoded query.
CASELAW_PROVIDERS = {
    "IN": ("IndianKanoon", "https://indiankanoon.org/search/?formInput={q}&type=judgments"),
    "US": ("CourtListener", "https://www.courtlistener.com/?q={q}"),
    "GB": ("Find Case Law (UK)", "https://caselaw.nationalarchives.gov.uk/search?query={q}"),
    "AU": ("AustLII", "https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?method=auto&query={q}"),
    "CA": ("CanLII", "https://www.canlii.org/en/#search/text={q}"),
    "AE": ("Google Scholar", "https://scholar.google.com/scholar?q={q}"),
    "SG": ("Google Scholar", "https://scholar.google.com/scholar?q={q}"),
    "DE": ("Google Scholar", "https://scholar.google.com/scholar?q={q}"),
}


def normalize_code(code):
    """Return a supported uppercase country code, falling back to India."""
    if not code:
        return DEFAULT_CODE
    code = str(code).strip().upper()
    return code if code in COUNTRY_CONFIG else DEFAULT_CODE


def get_config(code):
    return COUNTRY_CONFIG[normalize_code(code)]


def country_name(code):
    return get_config(code)["name"]


def caselaw_provider(code):
    return CASELAW_PROVIDERS.get(normalize_code(code), CASELAW_PROVIDERS[DEFAULT_CODE])


def caselaw_link(code, query):
    _, url = caselaw_provider(code)
    return url.format(q=quote_plus((query or "").strip()))


def advisor_descriptor(code):
    c = get_config(code)
    return (f"a senior legal advisor qualified in {c['name']} with deep expertise "
            f"in its {c['legal_system']} legal system")


def jurisdiction_block(code):
    """A reusable prompt block describing the legal jurisdiction to the model."""
    c = get_config(code)
    laws = ", ".join(c.get("primary_laws", [])) or "the applicable national statutes"
    courts = ", ".join(c.get("courts", [])) or "the relevant courts"
    sources = "; ".join(c.get("authoritative_sources", []))
    sources_line = (
        f"Ground every answer in these official legal sources for {c['name']}: {sources}.\n"
        if sources else ""
    )
    return (
        f"JURISDICTION: {c['name']} — {c['legal_system']} legal system.\n"
        f"Primary laws to rely on: {laws}.\n"
        f"Relevant courts / forums: {courts}.\n"
        f"{sources_line}"
        f"Currency: {c['currency']} ({c['currency_symbol']}).\n"
        f"Answer strictly under the law of {c['name']}. Cite real {c['name']} statutes, sections, "
        f"and procedures, and use {c['currency']} for any monetary amounts. Do NOT cite the law of "
        f"any other country (for example, do not reference Indian law unless the jurisdiction above "
        f"is India)."
    )


def localize_currency(text, code):
    """Swap India currency tokens for the target country's currency. No-op for India."""
    if not text:
        return text
    if normalize_code(code) == "IN":
        return text
    c = get_config(code)
    cur = c["currency"]
    sym = c.get("currency_symbol", cur)
    return (text.replace("INR", cur)
                .replace("Rs.", cur)
                .replace("₹", sym))
