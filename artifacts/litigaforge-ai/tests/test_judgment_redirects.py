"""Regression tests for tolerant judgment URL resolution."""
import os
import sys

import pytest

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from routers import judgments


CANONICAL = {
    "court_slug": "supreme-court-of-india",
    "year": 1973,
    "slug": "kesavananda-bharati-v-state-of-kerala-basic-structure",
}


@pytest.mark.asyncio
async def test_canonical_slug_is_exact_and_cannot_redirect(monkeypatch):
    async def fake_fetchrow(_query, *args):
        assert args == (
            CANONICAL["court_slug"],
            CANONICAL["year"],
            CANONICAL["slug"],
        )
        return CANONICAL

    monkeypatch.setattr(judgments, "fetchrow", fake_fetchrow)

    result = await judgments._resolve_canonical(**CANONICAL)

    assert result == {**CANONICAL, "exact": True}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("court", "slug"),
    [
        ("supreme-court", "kesavananda-bharati"),
        ("wrong-court", "kesavananda-bharati-v-state-of-kerala"),
        (
            "supreme-court-of-india",
            "kesavananda-bharati-v-state-of-kerala-basic-structure-extra",
        ),
        (
            "supreme-court-of-india",
            "kesavananda-bharati-vs-state-of-kerala-basic-structure",
        ),
        (
            "supreme-court-of-india",
            "kesavananda-bharati-versus-state-of-kerala-basic-structure",
        ),
    ],
)
async def test_tolerant_variants_resolve_to_canonical(monkeypatch, court, slug):
    async def fake_fetchrow(*_args):
        return None

    async def fake_fetch(*_args):
        return [CANONICAL]

    monkeypatch.setattr(judgments, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(judgments, "fetch", fake_fetch)

    result = await judgments._resolve_canonical(court, 1973, slug)

    assert result == {**CANONICAL, "exact": False}


@pytest.mark.asyncio
async def test_ambiguous_prefix_does_not_guess(monkeypatch):
    async def fake_fetchrow(*_args):
        return None

    async def fake_fetch(*_args):
        return [
            CANONICAL,
            {
                "court_slug": "kerala-high-court",
                "year": 1973,
                "slug": "kesavananda-bharati-v-election-commission",
            },
        ]

    monkeypatch.setattr(judgments, "fetchrow", fake_fetchrow)
    monkeypatch.setattr(judgments, "fetch", fake_fetch)

    result = await judgments._resolve_canonical(
        "supreme-court", 1973, "kesavananda-bharati"
    )

    assert result is None