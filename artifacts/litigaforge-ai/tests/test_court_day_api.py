"""Court Day API against a real development Postgres (skipped when none is reachable, e.g. in CI)."""
import asyncio
import json
import os
import uuid

import pytest

asyncpg = pytest.importorskip("asyncpg")
httpx = pytest.importorskip("httpx")


def _db_reachable() -> bool:
    async def probe():
        conn = await asyncpg.connect(os.environ.get("DATABASE_URL", ""), timeout=2)
        try:
            return bool(await conn.fetchval("SELECT to_regclass('public.lawyer_cases') IS NOT NULL"))
        finally:
            await conn.close()
    try:
        return asyncio.run(probe())
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_reachable(), reason="needs a development Postgres with the app schema")

COURT = {"state": "Telangana", "district_code": "Hyderabad", "complex_code": "High Court", "court": "Court", "court_no": "4"}


async def _make_user(conn, role="lawyer", verified=True):
    email = f"court-day-{uuid.uuid4().hex[:10]}@litigaforge.test"
    uid = await conn.fetchval(
        "INSERT INTO users (email, name, password_hash, role, email_verified) VALUES ($1,$2,'x',$3,true) RETURNING id",
        email, "Test Advocate", role,
    )
    if role == "lawyer":
        await conn.execute(
            "INSERT INTO lawyers (name, user_id, verified, verification_status, is_test) VALUES ($1,$2,$3,$4,true)",
            "Test Advocate", uid, verified, "verified" if verified else "pending",
        )
    return {"id": uid, "email": email, "role": role, "is_superuser": False}


@pytest.fixture
def api():
    from fastapi import FastAPI
    from auth import require_user
    import database
    from routers import court_day, docket

    state = {"user": None}

    async def current_user():
        return state["user"]

    app = FastAPI()
    app.include_router(court_day.router)
    app.dependency_overrides[require_user] = current_user
    court_day._LAST_UPDATE.clear()

    async def run(steps):
        database._pool = None  # new event loop per test → fresh pool
        pool = await database.get_pool()
        async with pool.acquire() as conn:
            await docket._ensure_table(conn)
            await court_day.ensure_tables(conn)
            users = {
                "a": await _make_user(conn),
                "b": await _make_user(conn),
                "unverified": await _make_user(conn, verified=False),
                "client": await _make_user(conn, role="client"),
            }
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            def as_user(name):
                state["user"] = users[name]
                return client
            try:
                await steps(as_user, users, pool, docket)
            finally:
                async with pool.acquire() as conn:
                    ids = [u["id"] for u in users.values()]
                    await conn.execute("DELETE FROM docket_profiles WHERE user_id = ANY($1::int[])", ids)
                    await conn.execute("DELETE FROM lawyers WHERE user_id = ANY($1::int[])", ids)
                    await conn.execute("DELETE FROM users WHERE id = ANY($1::int[])", ids)
                await pool.close()
                database._pool = None
    return lambda steps: asyncio.run(run(steps))


def test_board_flow_trust_rules_and_access(api):
    async def steps(as_user, users, pool, docket):
        key = f"TELANGANA|HYDERABAD|HIGH COURT|T{uuid.uuid4().hex[:6]}"
        # clients and unverified advocates cannot touch boards
        assert (await as_user("client").get("/court-day/board", params={"court_key": key})).status_code == 403
        r = await as_user("unverified").post("/court-day/board", json={"court_key": key, "item_no": 5})
        assert r.status_code == 403 and "verified advocates" in r.json()["detail"]

        assert (await as_user("a").get("/court-day/board", params={"court_key": key})).json()["board"] is None
        r = await as_user("a").post("/court-day/board", json={"court_key": key, "item_no": 9})
        assert r.json()["status"] == "accepted" and r.json()["board"]["now_item"] == 9

        # cooldown stops rapid repeat updates from one advocate
        assert (await as_user("a").post("/court-day/board", json={"court_key": key, "item_no": 10})).status_code == 429

        # a second advocate agreeing raises the confidence count
        r = await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 9})
        assert r.json()["board"]["advocates"] == 2

        # an implausible jump is held until someone else confirms it
        from routers import court_day
        court_day._LAST_UPDATE.clear()
        r = await as_user("a").post("/court-day/board", json={"court_key": key, "item_no": 60})
        assert r.json()["status"] == "pending" and r.json()["board"]["now_item"] == 9
        court_day._LAST_UPDATE.clear()
        r = await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 60})
        assert r.json()["status"] == "accepted" and r.json()["board"]["now_item"] == 60

        # validation
        assert (await as_user("a").post("/court-day/board", json={"court_key": key, "item_no": 0})).status_code == 422
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM court_board_updates WHERE court_key=$1", key)
    api(steps)


def test_today_matches_cases_to_cached_cause_list_and_masks_sensitive(api):
    async def steps(as_user, users, pool, docket):
        from routers import court_day
        today = court_day._today()
        uid = users["a"]["id"]
        court = {**COURT, "court_no": f"T{uuid.uuid4().hex[:5]}"}
        async with pool.acquire() as conn:
            await docket._ensure_table(conn)
            await conn.execute(
                "INSERT INTO docket_profiles (user_id, cause_list_name, enrolment_number, court_ids) VALUES ($1,'','',$2)",
                uid, [json.dumps(court)],
            )
            await conn.execute(
                """INSERT INTO lawyer_cases (lawyer_id, title, case_type, client_name, court_name, cnr_number, hearing_date, case_stage, status)
                   VALUES ($1,'Sharma v. State','Criminal','R. Sharma','Telangana HC','TSHC010000172025',$2,'Arguments','active'),
                          ($1,'K. Lakshmi v. K. Ramesh','Family Law','K. Lakshmi','Family Court','',$2,'Counselling','active'),
                          ($1,'Old closed matter','Civil','X','Court','',$2,'Disposed','closed')""",
                uid, today.isoformat(),
            )
        await docket.cache_set(docket._court_cache_key(court, today.isoformat()), {
            "date": today.isoformat(), "status": "ok",
            "matters": [{"cnr": "TSHC010000012025", "itemNo": 3}, {"cnr": "TSHC010000172025", "itemNo": 17}],
        }, ttl=600)
        key = court_day.court_key(court)
        await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 11})

        body = (await as_user("a").get("/court-day/today")).json()
        assert body["date"] == today.isoformat() and len(body["week"]) == 7
        assert sum(d["count"] for d in body["week"]) == 2          # closed matter not counted
        first, second = body["matters"]
        assert first["title"] == "Sharma v. State" and first["item"] == "17" and first["hall"] == court["court_no"]
        assert first["list_size"] == 2 and first["place_source"] == "cause_list"
        assert first["board"]["now_item"] == 11 and first["board"]["advocates"] == 1
        assert first["sensitive"] is False
        assert second["sensitive"] is True and second["item"] is None and second["board"] is None

        # another advocate never sees this advocate's matters
        other = (await as_user("b").get("/court-day/today")).json()
        assert other["matters"] == []
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM lawyer_cases WHERE lawyer_id=$1", uid)
            await conn.execute("DELETE FROM court_board_updates WHERE court_key=$1", key)
    api(steps)


def test_brief_is_owner_only_and_built_from_stored_data(api):
    async def steps(as_user, users, pool, docket):
        uid = users["a"]["id"]
        async with pool.acquire() as conn:
            case_id = await conn.fetchval(
                """INSERT INTO lawyer_cases (lawyer_id, title, case_type, description, client_name, court_name, cnr_number, hearing_date, case_stage)
                   VALUES ($1,'Sharma v. State','Criminal','Bail u/s 439 CrPC; FIR under section 420 IPC','R. Sharma','Telangana HC','TSHC010000172025','2026-10-19','Arguments')
                   RETURNING id""", uid,
            )
            tracked = await conn.fetchval(
                "INSERT INTO tracked_cases (user_id, cnr, court_name) VALUES ($1,'TSHC010000172025','Telangana HC') RETURNING id", uid,
            )
            await conn.execute(
                "INSERT INTO case_snapshots (tracked_case_id, raw_response, case_status, next_hearing_date) VALUES ($1,$2,'Pending','2026-10-19')",
                tracked, json.dumps({"stage": "Arguments", "judge": "Hon'ble Justice A", "orders": [
                    {"order_date": "2026-10-02", "title": "Counter filed by the State"},
                    {"order_date": "2026-09-18", "title": "Notice served"}]}),
            )
        r = await as_user("a").get(f"/court-day/brief/{case_id}")
        brief = r.json()
        assert r.status_code == 200
        assert brief["next_date"] == "2026-10-19" and brief["judge"] == "Hon'ble Justice A"
        assert [o["date"] for o in brief["last_orders"]] == ["2026-10-02", "2026-09-18"]
        assert {"old": "CrPC s.439", "new": "BNSS s.483"} == {k: brief["law"][0][k] for k in ("old", "new")}
        assert brief["checklist"] and brief["data_as_of"].endswith("+05:30")
        assert (await as_user("b").get(f"/court-day/brief/{case_id}")).status_code == 404
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM tracked_cases WHERE user_id=$1", uid)
            await conn.execute("DELETE FROM lawyer_cases WHERE lawyer_id=$1", uid)
    api(steps)


def test_board_update_alerts_followers_with_the_app_closed(api, monkeypatch):
    from routers import court_day
    sent = []
    monkeypatch.setattr(court_day, "_send_web_push_sync", lambda sub, payload: sent.append((sub["endpoint"], payload)) or "sent")

    async def steps(as_user, users, pool, docket):
        today = court_day._today()
        uid = users["a"]["id"]
        court = {**COURT, "court_no": f"T{uuid.uuid4().hex[:5]}"}
        key = court_day.court_key(court)
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO docket_profiles (user_id, cause_list_name, enrolment_number, court_ids) VALUES ($1,'','',$2)",
                uid, [json.dumps(court)],
            )
            await conn.execute(
                """INSERT INTO lawyer_cases (lawyer_id, title, case_type, client_name, court_name, cnr_number, hearing_date, case_stage, status)
                   VALUES ($1,'K. Lakshmi v. K. Ramesh','Family Law','K. Lakshmi','Family Court','TSFC010000172025',$2,'Counselling','active')""",
                uid, today.isoformat(),
            )
            await conn.execute(
                "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,'k','a')",
                uid, f"https://push.example.test/{uuid.uuid4().hex}",
            )
        await docket.cache_set(docket._court_cache_key(court, today.isoformat()), {
            "date": today.isoformat(), "status": "ok", "matters": [{"cnr": "TSFC010000172025", "itemNo": 17}],
        }, ttl=600)
        # opening Court Day registers advocate A as following this hall
        assert (await as_user("a").get("/court-day/today")).json()["matters"][0]["item"] == "17"

        await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 10})
        await asyncio.gather(*list(court_day._BACKGROUND))
        assert sent == []                                      # 7 away: no alert yet

        court_day._LAST_UPDATE.clear()
        await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 14})
        await asyncio.gather(*list(court_day._BACKGROUND))
        assert len(sent) == 1
        payload = sent[0][1]
        assert payload["title"] == f"Head to Court {court['court_no']} — 3 away"
        assert "Lakshmi" not in payload["title"] + payload["body"]   # private matter stays private

        court_day._LAST_UPDATE.clear()
        await as_user("b").post("/court-day/board", json={"court_key": key, "item_no": 15})
        await asyncio.gather(*list(court_day._BACKGROUND))
        assert len(sent) == 1                                  # only once per matter per day

        # turning alerts off is respected
        assert (await as_user("a").put("/court-day/alerts", json={"enabled": False})).json() == {"enabled": False}
        assert (await as_user("a").get("/court-day/alerts")).json()["enabled"] is False
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM push_subscriptions WHERE user_id=$1", uid)
            await conn.execute("DELETE FROM court_day_watch WHERE user_id=$1", uid)
            await conn.execute("DELETE FROM court_day_prefs WHERE user_id=$1", uid)
            await conn.execute("DELETE FROM lawyer_cases WHERE lawyer_id=$1", uid)
            await conn.execute("DELETE FROM court_board_updates WHERE court_key=$1", key)
    api(steps)


def test_account_erasure_succeeds_for_an_advocate_with_saved_courts(api):
    """Regression: docket_profiles (no ON DELETE CASCADE) used to make erasure roll back."""
    async def steps(as_user, users, pool, docket):
        from fastapi import Response
        from starlette.requests import Request
        import routers.auth as auth_router
        uid = users["a"]["id"]
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO docket_profiles (user_id, cause_list_name, enrolment_number, court_ids) VALUES ($1,'','',$2)",
                uid, [json.dumps(COURT)],
            )
            await conn.execute("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,'k','a')",
                               uid, f"https://push.example.test/{uuid.uuid4().hex}")
            await conn.execute("INSERT INTO court_day_prefs (user_id, alerts) VALUES ($1, false)", uid)
        request = Request({"type": "http", "method": "DELETE", "path": "/", "headers": [], "client": ("127.0.0.1", 1)})
        await auth_router.delete_account.__wrapped__(request, Response(), {"id": uid, "role": "lawyer"})
        async with pool.acquire() as conn:
            assert await conn.fetchval("SELECT COUNT(*) FROM users WHERE id=$1", uid) == 0
            for table in ("docket_profiles", "push_subscriptions", "court_day_prefs"):
                assert await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE user_id=$1", uid) == 0, table
    api(steps)
