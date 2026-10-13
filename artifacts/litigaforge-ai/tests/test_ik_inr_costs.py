import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import case_law_search as ik


def test_official_endpoint_prices_are_rupees_and_configurable(monkeypatch):
    for path, expected in (
        ("/search/", "0.50"),
        ("/doc/123/", "0.20"),
        ("/docfragment/123/", "0.05"),
        ("/docmeta/123/", "0.02"),
        ("/origdoc/123/", "0.50"),
    ):
        assert ik.ik_endpoint_price_inr(path) == Decimal(expected)
    monkeypatch.setenv("IK_PRICE_ORIGINAL_INR", "1.25")
    assert ik.ik_endpoint_price_inr("/origdoc/123/") == Decimal("1.25")


class _BudgetConn:
    def __init__(self, spent="0"):
        self.spent = spent
        self.inserted = False

    @asynccontextmanager
    async def transaction(self):
        yield

    async def execute(self, *_args):
        if _args and str(_args[0]).lstrip().upper().startswith("INSERT"):
            self.inserted = True

    async def fetchval(self, *_args):
        return None

    async def fetchrow(self, *_args):
        return {"total": Decimal(self.spent)}


@pytest.mark.asyncio
async def test_rupee_cap_blocks_reservation(monkeypatch):
    monkeypatch.setenv("IK_DAILY_COST_CAP_INR", "0.49")
    conn = _BudgetConn()
    with pytest.raises(ik.IKDailyCostCapExceeded):
        await ik.reserve_ik_budget(conn, "/search/")
    assert not conn.inserted


class _CachedConn:
    def __init__(self):
        self.executed = []

    async def fetchrow(self, *_args):
        return {
            "results_json": [{"tid": "123", "title": "Cached case"}],
            "fetched_at": datetime.now(timezone.utc),
        }

    async def execute(self, *args):
        self.executed.append(args)


@pytest.mark.asyncio
async def test_fresh_cache_avoids_paid_search_call(monkeypatch):
    monkeypatch.setenv("IK_ENABLED", "true")
    monkeypatch.setenv("INDIANKANOON_API_TOKEN", "test-token")
    async def forbidden(*_args, **_kwargs):
        raise AssertionError("fresh cache must not call Indian Kanoon")
    monkeypatch.setattr(ik, "_ik_call", forbidden)
    docs, cap_hit = await ik._ik_search(_CachedConn(), "cached query", 5)
    assert docs[0]["tid"] == "123"
    assert cap_hit is False
