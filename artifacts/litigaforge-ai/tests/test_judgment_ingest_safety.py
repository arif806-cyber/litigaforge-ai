import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import judgment_ingest
from judgment_ingest import _build_summary_prompt, _html_to_text, _valid_summary


def _summary(**overrides):
    value = {
        "summary_en": "The court considered the challenge and held that the procedure was unfair.",
        "summary_hi": "न्यायालय ने चुनौती पर विचार किया और प्रक्रिया को अनुचित माना।",
        "summary_te": "న్యాయస్థానం సవాలును పరిశీలించి ప్రక్రియ అన్యాయమని పేర్కొంది.",
        "acts_cited": [],
        "outcome": "Appeal allowed; order set aside.",
    }
    value.update(overrides)
    return value


def test_regional_summary_prompt_requires_telugu():
    prompt = _build_summary_prompt("A v B", "Telangana High Court", "Judgment text", strict=False)
    assert "natural Telugu" in prompt


def test_regional_summary_requires_telugu_content():
    assert _valid_summary(_summary(summary_te=""), require_telugu=True) is None
    assert _valid_summary(_summary(), require_telugu=True)["summary_te"]


def test_indeterminate_outcome_is_not_published_as_a_summary():
    assert _valid_summary(_summary(outcome="The matter is reserved for judgment.")) is None
    assert _valid_summary(_summary(outcome="The outcome cannot be determined from the source.")) is None


def test_text_extraction_can_verify_and_store_long_source_separately():
    text = "<p>" + ("full judgment " * 30) + "</p>"
    extracted = _html_to_text(text, cap=None)
    assert len(extracted) > 200
    assert _html_to_text(text, cap=100) == extracted[:100]


def test_partial_ingestion_does_not_advance_success_date():
    class Pool:
        def acquire(self):
            raise AssertionError("state table must not be updated for an incomplete run")

    import asyncio
    saved = asyncio.run(judgment_ingest._persist_ingest_success(
        Pool(), {"all_queries_complete": False}, __import__("datetime").date(2026, 10, 13)
    ))
    assert saved is False
