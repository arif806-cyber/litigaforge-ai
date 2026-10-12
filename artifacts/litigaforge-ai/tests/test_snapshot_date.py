from datetime import date

from services.court_data_client import (
    _safe_snapshot_date,
    normalize_snapshot_hearing_dates,
)


def test_snapshot_date_is_native_date_for_asyncpg_date_codec():
    value = _safe_snapshot_date("2026-10-01T00:00:00Z")

    assert value == date(2026, 10, 1)
    assert isinstance(value, date)


def test_snapshot_date_rejects_invalid_input():
    assert _safe_snapshot_date("not-a-date") is None


def test_disposed_case_hides_next_date_and_returns_disposal_date():
    assert normalize_snapshot_hearing_dates(
        "DISPOSED",
        "2026-10-20",
        {"dateOfDisposal": "2026-10-01"},
        today=date(2026, 10, 12),
    ) == (None, None, "2026-10-01")


def test_past_hearing_date_is_returned_as_last_listed():
    assert normalize_snapshot_hearing_dates(
        "PENDING",
        "2026-10-01",
        {},
        today=date(2026, 10, 12),
    ) == (None, "2026-10-01", None)


def test_disposed_past_hearing_uses_last_listed_label_source():
    assert normalize_snapshot_hearing_dates(
        "DISPOSED",
        "2026-10-01",
        {"last_hearing_date": "2026-07-03"},
        today=date(2026, 10, 12),
    ) == (None, "2026-10-01", None)
