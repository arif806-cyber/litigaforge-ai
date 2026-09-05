import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
from case_law_search import search_case_law


class _Conn:
    def __init__(self, rows):
        self.rows = rows
        self.sql = ""

    async def fetch(self, sql, *args):
        self.sql = sql
        return self.rows

    async def fetchrow(self, *args):
        return None

    async def execute(self, *args):
        return None


@pytest.mark.asyncio
async def test_local_search_is_broad_ranked_and_honestly_labelled(monkeypatch):
    monkeypatch.delenv("INDIANKANOON_API_TOKEN", raising=False)
    conn = _Conn([{
        "id": 9, "case_name": "Example v State", "court": "Supreme Court",
        "court_slug": "supreme-court-of-india", "year": 2024, "slug": "example-v-state",
        "source_url": "https://source/9",
    }])
    result = await search_case_law(conn, "constitutional issue", limit=5)
    assert "full_text ILIKE" in conn.sql
    assert "websearch_to_tsquery" in conn.sql
    assert result["source"] == "local_db"
    assert result["results"][0]["source"] == "local_db"
    assert result["results"][0]["url"] == "/judgments/supreme-court-of-india/2024/example-v-state"