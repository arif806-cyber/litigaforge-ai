import asyncio

from monitoring import heartbeat


def test_heartbeat_is_disabled_when_url_is_unset(monkeypatch):
    monkeypatch.delenv("HC_PING_TEST", raising=False)
    asyncio.run(heartbeat("HC_PING_TEST"))


def test_heartbeat_uses_five_second_timeout_and_fail_path(monkeypatch):
    monkeypatch.setenv("HC_PING_TEST", "https://hc.example/check/")
    captured = {}

    class Response:
        def raise_for_status(self):
            captured["raised"] = True

    class Client:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url):
            captured["url"] = url
            return Response()

    monkeypatch.setattr("monitoring.httpx.AsyncClient", Client)
    asyncio.run(heartbeat("HC_PING_TEST", failed=True))
    assert captured == {
        "timeout": 5.0,
        "url": "https://hc.example/check/fail",
        "raised": True,
    }
