import os
import sys
import asyncio

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from llm import nim_embed
from llm.nim_embed import canvas_to_text
from routers.workspace import _embed_saved_canvas, _persist_canvas


def test_canvas_to_text_includes_labels_and_node_data():
    text = canvas_to_text([
        {
            "id": "n1",
            "type": "issue",
            "data": {
                "label": "Termination without cause",
                "statute": "Industrial Disputes Act",
            },
            "position": {"x": 1, "y": 2},
        }
    ])

    assert "type: issue" in text
    assert "Termination without cause" in text
    assert "Industrial Disputes Act" in text
    assert "position" not in text


def test_canvas_to_text_is_stable_and_bounded():
    nodes = [{"type": "fact", "data": {"label": "x" * 100}} for _ in range(10)]

    first = canvas_to_text(nodes, max_chars=120)
    second = canvas_to_text(nodes, max_chars=120)

    assert first == second
    assert len(first) == 120


def test_batch_canvas_embedding_preserves_empty_positions(monkeypatch):
    async def fake_call(texts, input_type, model=None):
        assert texts == ["type: issue; label: Contract breach; data: {\"label\": \"Contract breach\"}"]
        return [[0.5, 0.5]]

    monkeypatch.setattr(nim_embed, "NIM_API_KEY", "configured")
    monkeypatch.setattr(nim_embed, "_call_embed", fake_call)

    result = asyncio.run(
        nim_embed.aembed_canvases([
            [],
            [{"type": "issue", "data": {"label": "Contract breach"}}],
        ])
    )

    assert result == [None, [0.5, 0.5]]


def test_canvas_save_avoids_vector_sql_when_schema_is_unavailable():
    class FakeConnection:
        def __init__(self):
            self.calls = []

        async def execute(self, sql, *args):
            self.calls.append((sql, args))

    conn = FakeConnection()
    asyncio.run(_persist_canvas(
        conn, 7, 11,
        [{"type": "issue", "data": {"label": "Dismissal"}}],
        [],
        None,
        False,
    ))

    assert len(conn.calls) == 1
    assert "embedding" not in conn.calls[0][0]
    assert "::vector" not in conn.calls[0][0]


def test_canvas_save_retries_without_vector_when_vector_write_fails():
    class FakeConnection:
        def __init__(self):
            self.calls = []

        async def execute(self, sql, *args):
            self.calls.append((sql, args))
            if "::vector" in sql:
                raise RuntimeError("vector extension unavailable")

    conn = FakeConnection()
    asyncio.run(_persist_canvas(
        conn, 7, 11,
        [{"type": "issue", "data": {"label": "Dismissal"}}],
        [],
        "[0.1,0.2]",
        True,
    ))

    assert len(conn.calls) == 2
    assert "::vector" in conn.calls[0][0]
    assert "::vector" not in conn.calls[1][0]


def test_embedding_write_is_guarded_by_exact_canvas_version(monkeypatch):
    class FakeConnection:
        def __init__(self):
            self.calls = []

        async def fetchval(self, sql, *args):
            return True

        async def execute(self, sql, *args):
            self.calls.append((sql, args))

    class Acquire:
        async def __aenter__(self):
            return conn

        async def __aexit__(self, *args):
            return None

    class Pool:
        def acquire(self):
            return Acquire()

    async def fake_embed(nodes):
        return [0.1, 0.2]

    async def fake_pool():
        return Pool()

    conn = FakeConnection()
    monkeypatch.setattr("routers.workspace.aembed_canvas", fake_embed)
    monkeypatch.setattr("routers.workspace.get_pool", fake_pool)

    saved_json = '[{"type": "issue"}]'
    asyncio.run(_embed_saved_canvas(7, 11, [{"type": "issue"}], saved_json))

    assert len(conn.calls) == 1
    sql, args = conn.calls[0]
    assert "nodes_json=$4::jsonb" in sql
    assert args[-1] == saved_json