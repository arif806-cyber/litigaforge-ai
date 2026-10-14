"""Contract and persistence-safety tests for the eCourtsIndia Partner API."""
from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import court_data_client as client


@pytest.fixture(autouse=True)
def isolate_api_meter(monkeypatch):
    async def reserve_without_database(*_args, **_kwargs):
        return {"day": None, "endpoint": "test", "cost": 0}

    monkeypatch.setattr(client, "_reserve_api_usage", reserve_without_database)
    monkeypatch.setattr(client, "_release_api_usage", AsyncMock())


CNR_A = "DLND020047882015"
CNR_B = "DLHC010001232024"


def _case_payload(cnr: str) -> dict:
    return {
        "data": {
            "courtCaseData": {
                "cnr": cnr,
                "courtName": "Chief Metropolitan Magistrate",
                "courtComplexCode": "DLND02",
                "caseType": "CC",
                "caseTypeRaw": "Ct Cases",
                "caseStatus": "DISPOSED",
                "registrationNumber": "24807/2016",
                "filingDate": "2015-12-21",
                "registrationDate": "2015-12-21",
                "nextHearingDate": "2018-07-07",
                "judges": ["Chief Metropolitan Magistrate"],
                "petitioners": ["MR.ARUN JAITLEY"],
                "respondents": ["MR. ARVIND KEJRIWAL"],
                "petitionerAdvocates": ["Advocate P"],
                "respondentAdvocates": ["Advocate R"],
                "purpose": "Disposed",
                "actsAndSections": ["Code of Civil Procedure - Section 9"],
                "orderCount": 1,
                "historyOfCaseHearings": [
                    {
                        "hearingDate": "2018-07-07",
                        "businessOnDate": "2018-05-19",
                        "purposeOfListing": "Final hearing",
                    }
                ],
                "businessOnDateEntries": [
                    {
                        "date": "2018-07-07",
                        "business": "Disposed",
                        "nextPurpose": "",
                        "nextHearingDate": "",
                    }
                ],
                "interimOrders": [
                    {
                        "orderDate": "2018-05-19",
                        "description": "COPY OF ORDER",
                        "orderUrl": "order-1.pdf",
                    }
                ],
                "judgmentOrders": [],
            },
            "entityInfo": {
                "cnr": cnr,
                "nextDateOfHearing": "2018-07-07T00:00:00Z",
                "dateModified": "2026-05-01T09:38:35Z",
            },
            "files": {
                "files": [
                    {
                        "pdfFile": f"{cnr}-order-1.pdf",
                        "markdownContent": "# Court order\nFull order text.",
                    }
                ]
            },
            "descriptions": {
                "enumLookup": {
                    "courtCode": {"DLND02": "Chief Metropolitan Magistrate"}
                }
            },
        },
        "meta": {"request_id": "test-request"},
    }


def _install_transport(monkeypatch, handler):
    monkeypatch.setattr(client, "_KEY_POOL", ["test-partner-token"])
    monkeypatch.setattr(client, "_HTTP_TRANSPORT", httpx.MockTransport(handler))
    monkeypatch.setattr(client._bucket, "acquire", AsyncMock())


@pytest.mark.asyncio
async def test_case_detail_uses_partner_host_bearer_and_normalizes_contract(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=_case_payload(CNR_A))

    _install_transport(monkeypatch, handler)

    result = await client.lookup_cnr(CNR_A)

    assert len(seen) == 1
    assert str(seen[0].url) == f"https://webapi.ecourtsindia.com/api/partner/case/{CNR_A}"
    assert seen[0].headers["Authorization"] == "Bearer test-partner-token"
    assert result["cnr"] == CNR_A
    assert result["case_status"] == "DISPOSED"
    assert result["case_type"] == "Ct Cases"
    assert result["court_name"] == "Chief Metropolitan Magistrate"
    assert result["petitioner_name"] == "MR.ARUN JAITLEY"
    assert result["hearings"][0]["business"] == "Disposed"
    assert result["orders"][0]["order_text"] == "# Court order\nFull order text."
    from routers.cnr import _live_response

    response = _live_response(CNR_A, result)
    assert response.orders[0].filename == "order-1.pdf"
    assert response.orders[0].has_text is True
    assert response.order_count == 1
    assert response.status == "DISPOSED"


@pytest.mark.parametrize(
    ("payload", "expected_code"),
    [
        ({"meta": {}}, "invalid_response_envelope"),
        ({"data": []}, "invalid_response_envelope"),
        ({"data": {"courtCaseData": []}}, "invalid_case_data"),
    ],
)
def test_case_detail_rejects_invalid_partner_envelopes(payload, expected_code):
    with pytest.raises(client.CourtDataError) as error:
        client._normalize_case_response(payload)
    assert error.value.code == expected_code


def test_case_detail_tolerates_optional_fields_missing():
    normalized = client._normalize_case_response(
        {"data": {"courtCaseData": {"cnr": CNR_A}}, "meta": {}},
        expected_cnr=CNR_A,
    )
    assert normalized["cnr"] == CNR_A
    assert normalized["hearings"] == []
    assert normalized["orders"] == []
    assert normalized["petitioner_name"] == ""
    assert normalized["respondent_name"] == ""
    assert normalized["case_status"] == ""


@pytest.mark.asyncio
async def test_missing_token_and_invalid_cnr_never_issue_partner_requests(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json=_case_payload(CNR_A))

    _install_transport(monkeypatch, handler)
    monkeypatch.setattr(client, "_KEY_POOL", [])
    with pytest.raises(client.CourtDataConfigurationError):
        await client.lookup_cnr(CNR_A)
    assert calls == []

    monkeypatch.setattr(client, "_KEY_POOL", ["unit-test-only"])
    with pytest.raises(ValueError, match="Invalid CNR"):
        await client.lookup_cnr("not-a-cnr")
    assert calls == []


@pytest.mark.asyncio
async def test_partner_search_maps_filters_pagination_and_display_title(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "data": {
                    "results": [
                        {
                            "cnr": CNR_B,
                            "caseType": "RFA",
                            "caseStatus": "PENDING",
                            "petitioners": ["ABC Private Limited"],
                            "respondents": ["XYZ Corporation"],
                            "courtCode": "DLHC01",
                        }
                    ],
                    "totalHits": 1,
                    "page": 2,
                    "pageSize": 20,
                    "totalPages": 3,
                    "hasNextPage": True,
                },
                "meta": {"request_id": "search-request"},
            },
        )

    _install_transport(monkeypatch, handler)
    result = await client.search_cases(
        advocates="Sharma",
        court_codes=["DLHC01", "HCBM01"],
        filing_date_from="2024-01-01",
        page=2,
        page_size=20,
    )

    query = dict(seen[0].url.params.multi_items())
    assert seen[0].url.path == "/api/partner/search"
    assert query["advocates"] == "Sharma"
    assert query["filingDateFrom"] == "2024-01-01"
    assert seen[0].url.params.get_list("courtCodes") == ["DLHC01", "HCBM01"]
    assert result["total_hits"] == 1
    assert result["has_next_page"] is True
    assert result["results"][0]["title"] == "ABC Private Limited vs XYZ Corporation"


@pytest.mark.asyncio
async def test_single_refresh_posts_once_waits_then_persists_detail(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.method == "POST":
            return httpx.Response(
                202,
                json={"data": {"cnr": CNR_A, "status": "QUEUED"}, "meta": {}},
            )
        return httpx.Response(200, json=_case_payload(CNR_A))

    _install_transport(monkeypatch, handler)
    sleep = AsyncMock()
    persist = AsyncMock()
    mark_failure = AsyncMock()
    monkeypatch.setattr(client.asyncio, "sleep", sleep)
    monkeypatch.setattr(client, "_persist_snapshot", persist)
    monkeypatch.setattr(client, "_mark_refresh_failure", mark_failure)

    result = await client.get_case_by_cnr("tracked-id", CNR_A, retries=0)

    assert calls == [
        ("POST", f"/api/partner/case/{CNR_A}/refresh"),
        ("GET", f"/api/partner/case/{CNR_A}"),
    ]
    sleep.assert_awaited_once_with(client._SINGLE_REFRESH_WAIT_SECONDS)
    persist.assert_awaited_once()
    mark_failure.assert_not_awaited()
    assert result["cnr"] == CNR_A


@pytest.mark.asyncio
async def test_paid_refresh_post_is_never_retried_even_if_retries_requested(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(503, json={"error": {"message": "temporarily unavailable"}})

    _install_transport(monkeypatch, handler)
    with pytest.raises(client.CourtDataError):
        await client._request(
            "POST",
            f"/api/partner/case/{CNR_A}/refresh",
            retries=4,
        )

    assert len(calls) == 1


@pytest.mark.asyncio
async def test_get_retries_transient_statuses_but_returns_success(monkeypatch):
    for transient_status in (429, 503):
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            if len(calls) == 1:
                return httpx.Response(
                    transient_status,
                    headers={"Retry-After": "0"},
                    json={"error": {"code": "transient", "message": "try later"}},
                )
            return httpx.Response(200, json=_case_payload(CNR_A))

        _install_transport(monkeypatch, handler)
        sleep = AsyncMock()
        monkeypatch.setattr(client.asyncio, "sleep", sleep)

        result = await client._fetch_case_detail(CNR_A)

        assert result["cnr"] == CNR_A
        assert len(calls) == 2
        sleep.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_retries_network_and_timeout_with_a_bounded_attempt_count(monkeypatch):
    for exception_type, expected_code, expected_status in (
        (httpx.ConnectError, "network_error", 502),
        (httpx.ReadTimeout, "timeout", 504),
    ):
        calls = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(request)
            if len(calls) <= 2:
                raise exception_type("temporary failure", request=request)
            return httpx.Response(200, json=_case_payload(CNR_A))

        _install_transport(monkeypatch, handler)
        sleep = AsyncMock()
        monkeypatch.setattr(client.asyncio, "sleep", sleep)
        result = await client._fetch_case_detail(CNR_A)
        assert result["cnr"] == CNR_A
        assert len(calls) == 3
        assert [call.args[0] for call in sleep.await_args_list] == [1, 2]

        def exhausted_handler(request: httpx.Request) -> httpx.Response:
            raise exception_type("offline", request=request)

        _install_transport(monkeypatch, exhausted_handler)
        with pytest.raises(client.CourtDataError) as error:
            await client._fetch_case_detail(CNR_A)
        assert error.value.code == expected_code
        assert error.value.status_code == expected_status


@pytest.mark.parametrize(
    ("status", "expected_phrase", "retryable"),
    [
        (400, "invalid", False),
        (401, "partner token", False),
        (403, "denied", False),
        (404, "could not find", False),
        (409, "conflict", False),
        (429, "rate-limited", True),
        (500, "temporarily unavailable", True),
    ],
)
@pytest.mark.asyncio
async def test_partner_http_errors_are_distinct_and_not_exposed_as_raw_bodies(
    monkeypatch, status, expected_phrase, retryable
):
    upstream_detail = "private provider diagnostics: internal-ref-98765"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            json={"error": {"code": "partner_error", "message": upstream_detail}},
        )

    _install_transport(monkeypatch, handler)
    with pytest.raises(client.CourtDataError) as error:
        await client._request("GET", "/api/partner/test", retries=0)

    assert error.value.status_code == status
    assert error.value.details["upstream_status"] == status
    assert error.value.details["provider_code"] == "partner_error"
    assert error.value.code == {
        400: "invalid_request",
        404: "not_found",
    }.get(status, "partner_error")
    assert expected_phrase in error.value.user_message.lower()
    assert error.value.retryable is retryable
    assert upstream_detail not in error.value.user_message


@pytest.mark.asyncio
async def test_bulk_refresh_uses_documented_status_lists_and_waits_for_queued_cases(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.method == "POST":
            body = __import__("json").loads(request.content)
            if request.url.path.endswith("/bulk-refresh-status"):
                assert set(body["cnrs"]) == {CNR_A, CNR_B}
                return httpx.Response(200, json={"data": {"results": [
                    {"cnr": CNR_A, "status": "completed"},
                    {"cnr": CNR_B, "status": "completed"},
                ]}})
            assert request.url.path == "/api/partner/case/bulk-refresh"
            assert set(body["cnrs"]) == {CNR_A, CNR_B}
            return httpx.Response(
                200,
                json={
                    "data": {
                        "refreshed": [CNR_A],
                        "queued": [CNR_B],
                        "invalid": [],
                    },
                    "meta": {},
                },
            )
        requested_cnr = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response(200, json=_case_payload(requested_cnr))

    _install_transport(monkeypatch, handler)
    sleep = AsyncMock()
    persist = AsyncMock()
    mark_failure = AsyncMock()
    monkeypatch.setattr(client.asyncio, "sleep", sleep)
    monkeypatch.setattr(client, "_persist_snapshots", persist)
    monkeypatch.setattr(client, "_mark_refresh_failure", mark_failure)

    results = await client.bulk_refresh([
        {"tracked_case_id": "tracked-a", "cnr": CNR_A},
        {"tracked_case_id": "tracked-b", "cnr": CNR_B},
    ])

    assert results.keys() == {CNR_A, CNR_B}
    assert calls == [
        ("POST", "/api/partner/case/bulk-refresh"),
        ("POST", "/api/partner/case/bulk-refresh-status"),
        ("GET", f"/api/partner/case/{CNR_A}"),
        ("GET", f"/api/partner/case/{CNR_B}"),
    ]
    sleep.assert_not_awaited()
    assert persist.await_count == 2
    mark_failure.assert_not_awaited()


@pytest.mark.asyncio
async def test_single_refresh_failure_is_not_persisted_or_retried(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            503,
            json={"error": {"code": "service_unavailable", "message": "try later"}},
        )

    _install_transport(monkeypatch, handler)
    persist = AsyncMock()
    mark_failure = AsyncMock()
    monkeypatch.setattr(client, "_persist_snapshot", persist)
    monkeypatch.setattr(client, "_mark_refresh_failure", mark_failure)

    with pytest.raises(client.CourtDataError):
        await client.get_case_by_cnr("tracked-id", CNR_A)

    assert len(calls) == 1
    assert calls[0].method == "POST"
    persist.assert_not_awaited()
    mark_failure.assert_awaited_once()


@pytest.mark.asyncio
async def test_bulk_refresh_failure_marks_cases_without_persisting(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            503,
            json={"error": {"code": "service_unavailable", "message": "try later"}},
        )

    _install_transport(monkeypatch, handler)
    persist = AsyncMock()
    mark_failure = AsyncMock()
    monkeypatch.setattr(client, "_persist_snapshots", persist)
    monkeypatch.setattr(client, "_mark_refresh_failure", mark_failure)

    result = await client.bulk_refresh([
        {"tracked_case_id": "tracked-a", "cnr": CNR_A},
        {"tracked_case_id": "tracked-b", "cnr": CNR_B},
    ])

    assert result == {}
    assert len(calls) == 1
    assert calls[0].method == "POST"
    assert mark_failure.await_count == 2
    persist.assert_not_awaited()


@pytest.mark.asyncio
async def test_bulk_refresh_missing_status_marks_only_unreported_case_failed(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.method == "POST":
            return httpx.Response(
                200,
                json={
                    "data": {"refreshed": [CNR_A], "queued": [], "invalid": []},
                    "meta": {},
                },
            )
        return httpx.Response(200, json=_case_payload(CNR_A))

    _install_transport(monkeypatch, handler)
    persist = AsyncMock()
    mark_failure = AsyncMock()
    monkeypatch.setattr(client, "_persist_snapshots", persist)
    monkeypatch.setattr(client, "_mark_refresh_failure", mark_failure)

    result = await client.bulk_refresh([
        {"tracked_case_id": "tracked-a", "cnr": CNR_A},
        {"tracked_case_id": "tracked-b", "cnr": CNR_B},
    ])

    assert set(result) == {CNR_A}
    assert persist.await_count == 1
    mark_failure.assert_awaited_once()
    assert mark_failure.await_args.args[0] == "tracked-b"


@pytest.mark.asyncio
async def test_order_metadata_and_markdown_use_documented_paths(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(
            200,
            json={"data": {"filename": "order-1.pdf", "markdownContent": "# Order"}, "meta": {}},
        )

    _install_transport(monkeypatch, handler)
    metadata = await client.get_order_metadata(CNR_A, "order-1.pdf")
    markdown = await client.get_order_markdown(CNR_A, "order-1.pdf")

    assert metadata["filename"] == "order-1.pdf"
    assert markdown["markdownContent"] == "# Order"
    assert calls == [
        f"/api/partner/case/{CNR_A}/order/order-1.pdf",
        f"/api/partner/case/{CNR_A}/order-md/order-1.pdf",
    ]


@pytest.mark.asyncio
async def test_order_ai_retries_null_analysis_as_partner_docs_specify(monkeypatch):
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        analysis = None if calls < 4 else {"summary": "completed"}
        return httpx.Response(
            200,
            json={"data": {"filename": "order-1.pdf", "aiAnalysis": analysis}, "meta": {}},
        )

    _install_transport(monkeypatch, handler)
    sleep = AsyncMock()
    monkeypatch.setattr(client.asyncio, "sleep", sleep)

    result = await client.get_order_ai(CNR_A, "order-1.pdf")

    assert result["aiAnalysis"] == {"summary": "completed"}
    assert calls == 4
    assert [call.args[0] for call in sleep.await_args_list] == [15, 15, 15]


@pytest.mark.asyncio
async def test_successful_snapshot_and_failure_state_have_distinct_timestamp_semantics(monkeypatch):
    class Transaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class Connection:
        def __init__(self):
            self.queries = []

        def transaction(self):
            return Transaction()

        async def execute(self, query, *args):
            self.queries.append((query, args))

    class Acquire:
        def __init__(self, connection):
            self.connection = connection

        async def __aenter__(self):
            return self.connection

        async def __aexit__(self, *args):
            return False

    class Pool:
        def __init__(self, connection):
            self.connection = connection

        def acquire(self):
            return Acquire(self.connection)

    connection = Connection()
    monkeypatch.setattr(client, "get_pool", AsyncMock(return_value=Pool(connection)))
    await client._persist_snapshots(
        ["tracked-id"],
        {
            "cnr": CNR_A,
            "case_status": "DISPOSED",
            "next_hearing_date": "2018-07-07",
            "order_count": 1,
            "court_name": "Chief Metropolitan Magistrate",
            "caseTypeRaw": "Ct Cases",
        },
    )
    assert len(connection.queries) == 2
    assert "INSERT INTO case_snapshots" in connection.queries[0][0]
    success_sql = connection.queries[1][0]
    assert "last_refreshed = now()" in success_sql
    assert "refresh_status = 'succeeded'" in success_sql

    mark_failure = AsyncMock()
    monkeypatch.setattr(client, "db_execute", mark_failure)
    await client._mark_refresh_failure(
        "tracked-id",
        client.CourtDataError("Partner request failed", status_code=503),
    )
    failure_sql = mark_failure.await_args.args[0]
    assert "refresh_status = 'failed'" in failure_sql
    assert "last_refreshed" not in failure_sql


@pytest.mark.asyncio
async def test_live_cnr_route_surfaces_missing_token_instead_of_demo_data(monkeypatch):
    import routers.cnr as cnr_router

    monkeypatch.setattr(client, "_KEY_POOL", [])
    monkeypatch.setattr(client, "lookup_cnr", AsyncMock(side_effect=client.CourtDataConfigurationError()))
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

    with pytest.raises(HTTPException) as error:
        await cnr_router.cnr_lookup_get(CNR_A, request)

    assert error.value.status_code == 503
    assert error.value.detail["code"] == "missing_credentials"
    assert "demo" not in error.value.detail["message"].lower()


@pytest.mark.parametrize(
    ("upstream_status", "expected_http_status"),
    [
        (400, 422),
        (401, 503),
        (403, 503),
        (404, 404),
        (409, 409),
        (429, 503),
        (500, 502),
    ],
)
@pytest.mark.asyncio
async def test_live_cnr_route_maps_upstream_failures_without_fallback(
    monkeypatch, upstream_status, expected_http_status
):
    import routers.cnr as cnr_router

    monkeypatch.setattr(
        client,
        "lookup_cnr",
        AsyncMock(side_effect=client.CourtDataError(
            "Partner request failed",
            status_code=upstream_status,
            code=f"http_{upstream_status}",
        )),
    )
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

    with pytest.raises(HTTPException) as error:
        await cnr_router.cnr_lookup_get(CNR_A, request)

    assert error.value.status_code == expected_http_status
    assert error.value.detail["code"] == f"http_{upstream_status}"


@pytest.mark.asyncio
async def test_invalid_cnr_is_rejected_before_live_lookup(monkeypatch):
    import routers.cnr as cnr_router

    lookup = AsyncMock()
    monkeypatch.setattr(client, "lookup_cnr", lookup)
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

    with pytest.raises(HTTPException) as error:
        await cnr_router.cnr_lookup_get("not-a-cnr", request)

    assert error.value.status_code == 422
    lookup.assert_not_awaited()


@pytest.mark.asyncio
async def test_live_cnr_route_returns_partner_response_on_success(monkeypatch):
    import routers.cnr as cnr_router

    raw = client._normalize_case_response(_case_payload(CNR_A), expected_cnr=CNR_A)
    monkeypatch.setattr(client, "lookup_cnr", AsyncMock(return_value=raw))
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

    response = await cnr_router.cnr_lookup_get(CNR_A, request)

    assert response.cnr == CNR_A
    assert response.data_source == "eCourts India Partner API"
    assert response.orders[0].filename == "order-1.pdf"


@pytest.mark.asyncio
async def test_demo_cnr_fixture_route_is_opt_in_and_separate(monkeypatch):
    import routers.cnr as cnr_router

    monkeypatch.delenv("ECOURTS_DEMO_ROUTES_ENABLED", raising=False)
    with pytest.raises(HTTPException) as error:
        await cnr_router.demo_cnr_lookup(CNR_A)
    assert error.value.status_code == 404

    monkeypatch.setenv("ECOURTS_DEMO_ROUTES_ENABLED", "true")
    demo = await cnr_router.demo_cnr_lookup(CNR_A)
    assert "demo" in demo.data_source.lower()


@pytest.mark.asyncio
async def test_court_structure_accepts_documented_top_level_array(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/partner/causelist/court-structure/states"
        return httpx.Response(200, json=[{"state": "AN", "stateName": "Andaman and Nicobar"}])

    _install_transport(monkeypatch, handler)
    monkeypatch.setattr(client, "_KEY_POOL", ["unit-test-only"])
    data = await client.get_court_structure("states")
    assert data["items"] == [{"state": "AN", "stateName": "Andaman and Nicobar"}]
