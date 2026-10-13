import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from citation_grounding import (
    retrieved_authority_block,
    scrub_unretrieved_citations,
    strip_unretrieved_judgment_citations,
)


def test_only_retrieved_case_names_and_reporter_citations_survive():
    judgments = [{
        "case_name": "Asha Ram v. State of Haryana",
        "citation": "(2020) 10 SCC 123",
        "url": "https://indiankanoon.org/doc/123/",
    }]
    text = (
        "Asha Ram v. State of Haryana (2020) 10 SCC 123 supports the point. "
        "Kesavananda Bharati v. State of Kerala (1973) 4 SCC 225 also applies."
    )

    clean = strip_unretrieved_judgment_citations(text, judgments)

    assert "Asha Ram v. State of Haryana" in clean
    assert "Kesavananda Bharati" not in clean
    assert "Unverified judgment reference removed" in clean


def test_empty_authority_bundle_prohibits_case_citations():
    assert "do not name or cite any case" in retrieved_authority_block([]).lower()
    clean = strip_unretrieved_judgment_citations(
        "Maneka Gandhi v. Union of India (1978) 1 SCC 248 changed the law.", []
    )
    assert "Maneka Gandhi" not in clean


def test_json_analysis_is_recursively_scrubbed():
    result = scrub_unretrieved_citations(
        {
            "summary": "A fabricated case, Foo v. Bar, controls.",
            "recommendations": ["Use the statutory filing deadline."],
        },
        [],
    )

    assert "Foo v. Bar" not in result["summary"]
    assert result["recommendations"] == ["Use the statutory filing deadline."]


@pytest.mark.asyncio
async def test_telangan_judgment_retrieval_uses_local_full_text_when_ik_is_disabled(monkeypatch):
    import case_law_search
    from grounded_legal_pipeline import retrieve_grounding

    monkeypatch.setenv("IK_ENABLED", "false")

    async def local_search(*_args, **_kwargs):
        return {"results": [{
            "case_name": "Local Judgment v State",
            "citation": "2020 SCC 1",
            "court": "Telangana High Court",
            "year": 2020,
            "source_url": "https://indiankanoon.org/doc/123/",
            "full_text": "The locally stored judgment text.",
            "summary_en": "Only the short summary.",
        }]}

    monkeypatch.setattr(case_law_search, "search_case_law", local_search)
    grounding = await retrieve_grounding(
        object(), "Find a Telangana judgment.", {"state": "Telangana", "matter_type": "other"}
    )

    assert grounding["judgments"][0]["text"] == "The locally stored judgment text."
