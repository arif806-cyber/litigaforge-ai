"""
pytest-asyncio configuration for LitigaForge AI integration tests.
asyncio_mode and asyncio_default_fixture_loop_scope are set in pytest.ini.
No custom event_loop fixture needed with pytest-asyncio >= 0.23 session scope.
"""
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def pytest_sessionstart(session):
    from runtime_env import assert_development_database
    assert_development_database()
