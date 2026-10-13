import pytest

from startup_data_migrations import migrate_workspace_embedding, run_duplicate_cleanups


class FakeConn:
    def __init__(self, values):
        self.values = iter(values)
        self.executed = []

    async def fetchval(self, *_args, **_kwargs):
        return next(self.values)

    async def execute(self, sql, *_args):
        self.executed.append(sql)


@pytest.mark.asyncio
async def test_duplicate_cleanup_is_skipped_without_explicit_setting(monkeypatch):
    monkeypatch.delenv("RUN_DATA_MIGRATIONS", raising=False)

    class NeverQuery:
        async def fetchval(self, *_args, **_kwargs):
            raise AssertionError("cleanup queried while opt-in setting was off")

    await run_duplicate_cleanups(NeverQuery())


@pytest.mark.asyncio
async def test_embedding_type_migration_never_clears_populated_column(monkeypatch):
    monkeypatch.setenv("RUN_DATA_MIGRATIONS", "true")
    conn = FakeConn(["vector(1536)", 3])

    assert await migrate_workspace_embedding(conn, production=True) is False
    assert conn.executed == []


@pytest.mark.asyncio
async def test_empty_embedding_column_can_be_explicitly_retyped(monkeypatch):
    monkeypatch.setenv("RUN_DATA_MIGRATIONS", "true")
    conn = FakeConn(["vector(1536)", 0])

    assert await migrate_workspace_embedding(conn, production=True) is True
    assert any("ALTER TABLE workspace_sessions" in sql for sql in conn.executed)
