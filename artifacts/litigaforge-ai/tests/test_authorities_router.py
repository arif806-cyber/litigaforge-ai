import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import routers.authorities as authorities


def test_authority_source_urls_are_http_only():
    assert authorities._safe_source_url("https://indiankanoon.org/doc/123/")
    assert authorities._safe_source_url("javascript:alert(1)") is None
    assert authorities._safe_source_url("//example.com/case") is None


@pytest.mark.asyncio
async def test_check_monitor_persists_only_linked_judgments(monkeypatch):
    class Connection:
        def __init__(self):
            self.inserts = []
            self.updates = []

        async def fetchrow(self, sql, *args):
            self.inserts.append(args)
            return {"id": len(self.inserts), "case_name": args[3], "source_url": args[5]}

        async def execute(self, sql, *args):
            self.updates.append((sql, args))

    async def fake_search(_conn, query, limit, **kwargs):
        assert query == "contract damages"
        assert limit == 10
        assert kwargs["feature"] == "authorities"
        return {"results": [
            {"case_name": "Linked Case v State", "source_url": "https://example.org/1", "citation": "2022 SCC"},
            {"case_name": "No source URL"},
            {"source_url": "https://example.org/2"},
            {"case_name": "Unsafe URL", "source_url": "javascript:alert(1)"},
        ]}

    monkeypatch.setattr(authorities, "search_case_law", fake_search)
    conn = Connection()
    result = await authorities._check_monitor(conn, 17, "saved_search", 9, "contract damages")

    assert result["new_count"] == 1
    assert result["new_alerts"][0]["case_name"] == "Linked Case v State"
    assert conn.inserts[0][0:3] == (17, "saved_search", 9)
    assert conn.updates[0][1] == (9, 17)
