from datetime import date

from services.court_data_client import _safe_snapshot_date


def test_snapshot_date_is_native_date_for_asyncpg_date_codec():
    value = _safe_snapshot_date("2026-10-01T00:00:00Z")

    assert value == date(2026, 10, 1)
    assert isinstance(value, date)


def test_snapshot_date_rejects_invalid_input():
    assert _safe_snapshot_date("not-a-date") is None
