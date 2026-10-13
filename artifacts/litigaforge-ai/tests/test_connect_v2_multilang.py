import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import routers.connect_v2 as connect


@pytest.mark.parametrize(("text", "language"), [
    ("नमस्ते", "hi"), ("తెలుగు", "te"), ("தமிழ்", "ta"),
    ("ಕನ್ನಡ", "kn"), ("മലയാളം", "ml"), ("বাংলা", "bn"),
    ("ગુજરાતી", "gu"), ("ਪੰਜਾਬੀ", "pa"), ("ଓଡ଼ିଆ", "or"),
    ("اردو", "ur"), ("Hello advocate", "en"),
])
def test_language_detection_for_supported_scripts(text, language):
    assert connect.detect_language(text) == language


def test_feature_flags_fail_closed_by_default(monkeypatch):
    for key in ("connect_v2", "CONNECT_V2_ENABLED", "multilang", "MULTILANG_ENABLED"):
        monkeypatch.delenv(key, raising=False)
    assert connect.enabled() is False
    assert connect.multilang_enabled() is False


@pytest.mark.asyncio
async def test_connect_request_rejects_unsupported_language_before_database(monkeypatch):
    monkeypatch.setattr(connect, "enabled", lambda: True)
    body = connect.CasePost(
        problem_type="contract dispute", description="A valid legal problem",
        location="Hyderabad", language="xx",
    )
    with pytest.raises(HTTPException) as exc:
        await connect.create_request(body, {"id": 8, "role": "client"})
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_connect_request_requires_multilang_flag_for_regional_language(monkeypatch):
    monkeypatch.setattr(connect, "enabled", lambda: True)
    monkeypatch.setattr(connect, "multilang_enabled", lambda: False)
    body = connect.CasePost(
        problem_type="contract dispute", description="A valid legal problem",
        location="Hyderabad", language="te",
    )
    with pytest.raises(HTTPException) as exc:
        await connect.create_request(body, {"id": 8, "role": "client"})
    assert exc.value.status_code == 404


def test_connect_role_boundaries_are_explicit():
    with pytest.raises(HTTPException) as client_error:
        connect._require_client({"role": "advocate"})
    with pytest.raises(HTTPException) as advocate_error:
        connect._require_verified_advocate({"role": "client"})
    assert client_error.value.status_code == advocate_error.value.status_code == 403


def test_matching_requires_both_location_and_practice_area():
    profile = {
        "district": "Hyderabad",
        "courts_practised": ["City Civil Court"],
        "practice_areas": ["property"],
    }
    assert connect._advocate_matches_case(profile, "Hyderabad", "property dispute")
    assert not connect._advocate_matches_case(profile, "Warangal", "property dispute")
    assert not connect._advocate_matches_case(profile, "Hyderabad", "family dispute")
