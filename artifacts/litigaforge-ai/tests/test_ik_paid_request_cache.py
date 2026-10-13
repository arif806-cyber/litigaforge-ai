import json
import os
import sys
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import case_law_search as ik


class _DocConn:
    def __init__(self):
        self.document = None

    async def execute(self, *_args):
        if _args and "INSERT INTO ik_document_cache" in str(_args[0]):
            self.document = json.loads(_args[2])

    async def fetchrow(self, sql, *_args):
        if "ik_document_cache" in sql and self.document:
            return {"document_json": json.dumps(self.document)}
        return None


class _SearchConn:
    def __init__(self):
        self.row = None

    async def execute(self, sql, *args):
        if "INSERT INTO ikanoon_search_cache" in sql:
            self.row = {
                "query_hash": args[0],
                "results_json": args[2],
                "fetched_at": datetime.now(timezone.utc),
            }

    async def fetchrow(self, sql, *args):
        if self.row and self.row["query_hash"] == args[0]:
            return self.row
        return None


def test_parses_structural_paragraph_labels():
    paragraphs = ik.parse_ik_paragraphs(
        '<p data-label="facts">Facts: The appeal followed a trial.</p>'
        '<div class="court-reasoning">The Court considered the record.</div>'
        '<p data-section="conclusion">Conclusion: Appeal dismissed.</p>'
    )
    assert [p["label"] for p in paragraphs] == ["facts", "court's reasoning", "conclusion"]
    assert all(p["text"] for p in paragraphs)


@pytest.mark.asyncio
async def test_document_request_is_made_once_and_cached(monkeypatch):
    monkeypatch.setenv("IK_ENABLED", "true")
    monkeypatch.setenv("INDIANKANOON_API_TOKEN", "mock-token")
    conn = _DocConn()
    calls = []

    async def mock_call(_conn, path, data, *, feature):
        calls.append((path, data, feature))
        return {
            "title": "Mock case",
            "doc": '<p data-label="conclusion">Conclusion: Appeal dismissed.</p>',
            "citeList": [{"tid": "2"}],
            "citedbyList": [{"tid": "3"}],
        }

    monkeypatch.setattr(ik, "_ik_call", mock_call)
    first = await ik.get_ik_document(conn, "123", feature="citation_watch")
    second = await ik.get_ik_document(conn, "123", feature="citation_watch")

    assert len(calls) == 1
    assert calls[0][0] == "/doc/123/"
    assert calls[0][1] == {"maxcites": "50", "maxcitedby": "50"}
    assert first["citeList"] == second["citeList"]
    assert first["_paragraphs"][0]["label"] == "conclusion"


@pytest.mark.asyncio
async def test_filtered_search_is_cached_and_not_paid_twice(monkeypatch):
    monkeypatch.setenv("IK_ENABLED", "true")
    monkeypatch.setenv("INDIANKANOON_API_TOKEN", "mock-token")
    conn = _SearchConn()
    calls = []

    async def mock_call(_conn, path, params, *, feature):
        calls.append((path, params, feature))
        return {"docs": [{"tid": "41", "title": "Mock judgment"}]}

    monkeypatch.setattr(ik, "_ik_call", mock_call)
    params = {"formInput": "mock query", "doctypes": "andhra", "maxpages": "2"}
    first, first_hit = await ik.ik_cached_search(conn, params, feature="hearing_prep", ttl_hours=168)
    second, second_hit = await ik.ik_cached_search(conn, params, feature="hearing_prep", ttl_hours=168)

    assert len(calls) == 1
    assert calls[0][2] == "hearing_prep"
    assert first["docs"] == second["docs"]
    assert first_hit is False
    assert second_hit is True
