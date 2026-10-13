import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import case_law_search as ik


class _DocConn:
    def __init__(self):
        self.document = None
        self.fetched_at = None

    async def execute(self, *_args):
        if _args and "INSERT INTO ik_document_cache" in str(_args[0]):
            self.document = json.loads(_args[2])
            self.fetched_at = datetime.now(timezone.utc)

    async def fetchrow(self, sql, *_args):
        if "ik_document_cache" in sql and self.document:
            return {"document_json": json.dumps(self.document), "fetched_at": self.fetched_at}
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
        '<p data-structure="Facts">Facts: The appeal followed a trial.</p>'
        '<p data-structure="Issue">Issue: Whether the appeal is maintainable.</p>'
        '<p data-structure="PetArg">PetArg: The petitioner challenged the order.</p>'
        '<p data-structure="RespArg">RespArg: The respondent opposed relief.</p>'
        '<p data-structure="Section">Section: Section 9 applies.</p>'
        '<p data-structure="Precedent">Precedent: An earlier case was considered.</p>'
        '<p data-structure="CDiscource">The Court considered the record.</p>'
        '<p data-structure="Conclusion">Conclusion: Appeal dismissed.</p>'
        '<div class="section">This class must not be treated as a section.</div>'
        '<div id="conclusion">This id must not be treated as a conclusion.</div>'
    )
    assert [p["label"] for p in paragraphs] == [
        "facts", "issue", "petitioner's arguments", "respondent's arguments",
        "section", "precedent", "court's reasoning", "conclusion",
    ]
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
            "doc": '<p data-structure="Conclusion">Conclusion: Appeal dismissed.</p>',
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
async def test_citation_watch_refreshes_document_cache_after_seven_days(monkeypatch):
    monkeypatch.setenv("IK_ENABLED", "true")
    monkeypatch.setenv("INDIANKANOON_API_TOKEN", "mock-token")
    conn = _DocConn()
    conn.document = {"doc": "old"}
    conn.fetched_at = datetime.now(timezone.utc) - timedelta(days=8)
    calls = []

    async def mock_call(_conn, path, data, *, feature):
        calls.append((path, feature))
        return {"doc": '<p data-structure="Conclusion">Appeal dismissed.</p>'}

    monkeypatch.setattr(ik, "_ik_call", mock_call)
    result = await ik.get_ik_document(conn, "123", feature="citation_watch")
    assert calls == [("/doc/123/", "citation_watch")]
    assert result["_paragraphs"][0]["label"] == "conclusion"


def test_authority_prompt_falls_back_to_local_full_text_when_ik_is_off(monkeypatch):
    from citation_grounding import retrieved_authority_block

    monkeypatch.setenv("IK_ENABLED", "false")
    block = retrieved_authority_block([{
        "case_name": "Local Case v State",
        "full_text": "The Court dismissed the appeal after considering the evidence.",
        "summary_en": "Short summary.",
    }])
    assert "The Court dismissed the appeal" in block
    assert "Short summary." not in block


def test_hearing_topic_only_keeps_generic_case_type_terms():
    from datetime import date
    from routers.workspace import _hearing_search_params, _safe_hearing_topic

    assert _safe_hearing_topic("Contract claim by Arif about a 2024 invoice") == "contract"
    assert _safe_hearing_topic("my landlord eviction appeal") == "landlord eviction appeal"
    params = _hearing_search_params(
        "Justice Example", "Example and Sample JJ", "contract claim by Arif about invoice",
        date(2026, 10, 12),
    )
    assert params["formInput"] == "contract"
    assert params["doctypes"] == "telangana,andhra"
    assert "Arif" not in json.dumps(params)


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
