import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import routers.calendar_sync as calendar_sync


def test_ics_serialization_escapes_text_and_skips_invalid_dates():
    ics = calendar_sync.render_calendar([
        {"uid": "a1", "event_date": "2026-11-02", "title": "Case, A; B", "description": "Next\nstep"},
        {"uid": "bad", "event_date": "not-a-date", "title": "Ignore"},
    ])
    assert "DTSTART;VALUE=DATE:20261102" in ics
    assert r"SUMMARY:Case\, A\; B" in ics
    assert r"DESCRIPTION:Next\nstep" in ics
    assert "Ignore" not in ics


@pytest.mark.asyncio
async def test_revoked_calendar_token_returns_404(monkeypatch):
    monkeypatch.setenv("CALENDAR_SYNC_ENABLED", "true")

    async def no_active_feed(*_args):
        return None

    monkeypatch.setattr(calendar_sync, "fetchrow", no_active_feed)
    with pytest.raises(HTTPException) as exc:
        await calendar_sync.get_calendar_feed("revoked-token")
    assert exc.value.status_code == 404
