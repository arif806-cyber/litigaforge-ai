import os
import sys

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from routers.personalization import build_canvas_pattern_suggestion, compute_profile


def test_canvas_pattern_requires_meaningful_history():
    profile = compute_profile([{"event_type": "node_add", "data": {"node_type": "judgment"}}])
    assert build_canvas_pattern_suggestion(profile) is None


def test_canvas_pattern_uses_ranked_node_preferences():
    events = [
        *[{"event_type": "node_add", "data": {"node_type": "judgment"}} for _ in range(4)],
        *[{"event_type": "node_add", "data": {"node_type": "strategy"}} for _ in range(2)],
    ]
    suggestion = build_canvas_pattern_suggestion(compute_profile(events))
    assert suggestion is not None
    assert suggestion["type"] == "canvas_pattern"
    assert suggestion["node_types"][:2] == ["judgment", "judgment"]
    assert "strategy" in suggestion["node_types"]


def test_accepted_suggestions_strengthen_matching_node_preferences():
    profile = compute_profile([
        {
            "event_type": "suggestion_accept",
            "data": {"suggestion_type": "precedent"},
        },
        {
            "event_type": "node_add",
            "data": {"node_type": "strategy"},
        }
    ])
    suggestion = build_canvas_pattern_suggestion(profile)
    assert suggestion is not None
    assert suggestion["node_types"][:2] == ["judgment", "judgment"]