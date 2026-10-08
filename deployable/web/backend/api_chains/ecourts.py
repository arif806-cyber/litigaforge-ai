"""LEGACY, DISABLED eCourts adapter.

The former eCourts.gov.in/x-api-key integration and synthetic fallback were
retired. Production lookups belong to artifacts/litigaforge-ai's
eCourtsIndia Partner API client; this compatibility function fails closed.
"""


def fetch_ecourts(
    party_name: str = None,
    case_number: str = None,
    state_code: str = "TS",
    district_code: str = "01",
    **kwargs,
) -> dict:
    return {
        "chain": "eCourts",
        "status": "disabled",
        "reason": (
            "The legacy eCourts adapter is disabled. Use the LitigaForge "
            "eCourtsIndia Partner API workflow."
        ),
    }
