import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.community import _extract_json_object


def test_extract_json_ignores_markdown_and_trailing_disclaimer():
    raw = """```json
{"risk_score": 72, "summary": "Substantive analysis"}
```

This is legal information, not legal advice. Consult a qualified advocate."""

    assert _extract_json_object(raw) == {
        "risk_score": 72,
        "summary": "Substantive analysis",
    }


def test_extract_json_skips_non_json_braces_before_valid_object():
    raw = 'Template {not valid JSON}. Result: {"risk_score": 61, "summary": "OK"}'

    assert _extract_json_object(raw)["risk_score"] == 61