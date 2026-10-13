"""
LitigaForge AI — live-server integration checks plus isolated handler contracts.
Live requests target localhost:5000/litigaforge and use cookie-only auth.
Run: pytest artifacts/litigaforge-ai/tests/test_endpoints.py -v
"""
import os
import sys
import time
import uuid
import pytest
import httpx

BASE_URL = "http://localhost:5000"
BASE = "/litigaforge"

_backend = os.path.join(os.path.dirname(__file__), "..")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.environ.setdefault("SESSION_SECRET", "test-secret-litigaforge")
os.environ.setdefault("BASE_PATH", "/litigaforge")


def anon_get(path: str, **kwargs) -> httpx.Response:
    """One-shot GET with no cookies — truly unauthenticated."""
    return httpx.get(f"{BASE_URL}{path}", timeout=10, **kwargs)


def anon_post(path: str, **kwargs) -> httpx.Response:
    """One-shot POST with no cookies — truly unauthenticated."""
    return httpx.post(f"{BASE_URL}{path}", timeout=10, **kwargs)


# ── Session-scoped client (carries httpOnly cookies after registration) ───────

@pytest.fixture(scope="session")
def client():
    # These tests write through the live registration API; fail before the first
    # request if the test process is deployed or configured for production DB.
    from runtime_env import assert_development_database
    assert_development_database()
    with httpx.Client(base_url=BASE_URL, timeout=15) as c:
        yield c


@pytest.fixture(scope="session")
def authenticated_user(client):
    """Register a fresh test user and keep its cookie session on the client.
    Retries up to 3×20s if the register endpoint is rate-limited (3/minute)."""
    email = f"test_{uuid.uuid4().hex[:8]}@litigaforge.test"
    for attempt in range(4):
        r = client.post(f"{BASE}/auth/register", json={
            "name": "Test User", "email": email,
            "password": "TestPass123!", "role": "client",
        })
        if r.status_code == 200:
            assert r.json()["user"]["email"] == email
            assert "token" not in r.json()
            cookies = [header.lower() for header in r.headers.get_list("set-cookie")]
            assert any(cookie.startswith("lf_token=") and "httponly" in cookie for cookie in cookies)
            assert any(cookie.startswith("lf_refresh=") and "httponly" in cookie for cookie in cookies)
            return email
        if r.status_code == 429 and attempt < 3:
            time.sleep(20)
            continue
        pytest.fail(f"Registration failed after {attempt + 1} attempt(s): {r.text}")
    pytest.fail("Registration failed: rate-limited after all retries")


# ══════════════════════════════════════════════════════════════════════════════
# 1. Health
# ══════════════════════════════════════════════════════════════════════════════

def test_health(client):
    r = client.get(f"{BASE}/healthz")
    assert r.status_code == 200
    assert "status" in r.json()


# ══════════════════════════════════════════════════════════════════════════════
# 2. Auth — register
# ══════════════════════════════════════════════════════════════════════════════

def test_register_success(client):
    r = client.post(f"{BASE}/auth/register", json={
        "name": "Jane Doe",
        "email": f"jane_{uuid.uuid4().hex[:6]}@test.com",
        "password": "Secure123!", "role": "client",
    })
    if r.status_code == 429:
        pytest.skip("Register endpoint rate-limited (3/minute) — try again later")
    assert r.status_code == 200
    assert "token" not in r.json()
    assert "user" in r.json()
    cookies = [header.lower() for header in r.headers.get_list("set-cookie")]
    assert any(cookie.startswith("lf_token=") and "httponly" in cookie for cookie in cookies)
    assert any(cookie.startswith("lf_refresh=") and "httponly" in cookie for cookie in cookies)


def test_register_duplicate_email(client, authenticated_user):
    email = authenticated_user
    r = client.post(f"{BASE}/auth/register", json={
        "name": "Dup", "email": email,
        "password": "Secure123!", "role": "client",
    })
    assert r.status_code == 409


def test_register_weak_password(client):
    r = client.post(f"{BASE}/auth/register", json={
        "name": "Weak",
        "email": f"weak_{uuid.uuid4().hex[:6]}@test.com",
        "password": "abc", "role": "client",
    })
    assert r.status_code in (400, 429)  # 429 = rate-limited, still rejects


# ══════════════════════════════════════════════════════════════════════════════
# 3. Auth — login
# ══════════════════════════════════════════════════════════════════════════════

def test_login_wrong_password(client, authenticated_user):
    email = authenticated_user
    r = client.post(f"{BASE}/auth/login",
                    json={"email": email, "password": "WrongPass!"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post(f"{BASE}/auth/login",
                    json={"email": "nobody@x.com", "password": "any"})
    assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 4. Auth — /me
# ══════════════════════════════════════════════════════════════════════════════

def test_me_authenticated(client, authenticated_user):
    r = client.get(f"{BASE}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == authenticated_user


def test_me_unauthenticated():
    # Fresh one-shot request — no session cookies, no Bearer token
    r = anon_get(f"{BASE}/auth/me")
    assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 5. Subscription plans
# ══════════════════════════════════════════════════════════════════════════════

def test_subscription_plans(client):
    r = client.get(f"{BASE}/subscription/plans")
    assert r.status_code == 200
    data = r.json()
    plans = data.get("plans", data) if isinstance(data, dict) else data
    assert isinstance(plans, list) and len(plans) > 0
    tiers = [p.get("tier") or p.get("id") for p in plans]
    assert "free" in tiers


# ══════════════════════════════════════════════════════════════════════════════
# 6. An unverified account cannot post a case requirement
# ══════════════════════════════════════════════════════════════════════════════

def test_unverified_user_cannot_post_case_requirement(client, authenticated_user):
    r = client.post(
        f"{BASE}/cases/requirements",
        json={
            "title": "Property dispute in Banjara Hills",
            "case_type": "Property Dispute",
            "description": "Neighbour encroached 2 feet of boundary wall",
            "location": "Hyderabad",
            "budget_range": "Rs. 5,000 \u2013 15,000",
            "budget_min": 5000,
            "budget_max": 15000,
        },
    )
    assert r.status_code == 403
    assert "Verify your email" in r.json()["detail"]


def test_post_case_unauthenticated():
    # Fresh one-shot — no cookies
    r = anon_post(f"{BASE}/cases/requirements",
                  json={"title": "Test", "case_type": "Civil"})
    assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 7. List case requirements (public)
# ══════════════════════════════════════════════════════════════════════════════

def test_list_case_requirements(client):
    r = client.get(f"{BASE}/cases/requirements")
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))


# ══════════════════════════════════════════════════════════════════════════════
# 8. Lawyer directory (public)
# ══════════════════════════════════════════════════════════════════════════════

def test_lawyer_directory(client):
    r = client.get(f"{BASE}/lawyers")
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 9. Legal Q&A browse (public)
# ══════════════════════════════════════════════════════════════════════════════

def test_ask_browse_questions(client):
    r = client.get(f"{BASE}/ask")
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 10. Judgment finder — AI endpoint, allow extra time
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.slow
@pytest.mark.timeout(60)
def test_judgment_search(client):
    r = client.post(f"{BASE}/judgments/search",
                    json={"query": "landlord eviction Telangana"})
    assert r.status_code in (200, 429)


# ══════════════════════════════════════════════════════════════════════════════
# 11. Legal aid contacts — may involve AI, allow extra time
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.slow
@pytest.mark.timeout(60)
def test_legal_aid_contacts(client):
    r = client.get(f"{BASE}/legal-aid/contacts", timeout=30)
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 12. Match proposals — client
# ══════════════════════════════════════════════════════════════════════════════

def test_matches_client_view(client, authenticated_user):
    r = client.get(f"{BASE}/matches/client")
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 13. Client cases list
# ══════════════════════════════════════════════════════════════════════════════

def test_client_cases_list(client, authenticated_user):
    r = client.get(f"{BASE}/client/cases")
    assert r.status_code == 200
    assert "cases" in r.json() or isinstance(r.json(), list)


# ══════════════════════════════════════════════════════════════════════════════
# 14. Secure file — unauthenticated → 401
# ══════════════════════════════════════════════════════════════════════════════

def test_secure_file_unauthenticated():
    # Fresh one-shot — no cookies, no Bearer
    r = anon_get(f"{BASE}/secure-files/somefilename.pdf")
    assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 15. Secure file — path traversal blocked
# ══════════════════════════════════════════════════════════════════════════════

def test_secure_file_path_traversal(client, authenticated_user):
    r = client.get(
        f"{BASE}/secure-files/..%2F..%2Fetc%2Fpasswd",
    )
    assert r.status_code in (400, 404)


# ══════════════════════════════════════════════════════════════════════════════
# 16. Email verification — invalid token → 400
# ══════════════════════════════════════════════════════════════════════════════

def test_verify_email_invalid_token(client):
    r = client.get(f"{BASE}/auth/verify-email?token=totally-fake-token-xyz")
    assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# 17. Resend verification — no auth → 401
# ══════════════════════════════════════════════════════════════════════════════

def test_resend_verification_auth_required():
    # Fresh one-shot — no cookies
    r = anon_post(f"{BASE}/auth/resend-verification")
    assert r.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 18. Commission calculation — pure unit test (no HTTP)
# ══════════════════════════════════════════════════════════════════════════════

def test_commission_calculation():
    from payments import booking_fee_paise, calc_commission_paise

    # The client booking fee is flat and must never vary with case budget.
    fee = booking_fee_paise()
    assert calc_commission_paise("", 0) == fee
    assert calc_commission_paise("", 5000) == fee
    assert calc_commission_paise("", 100000) == fee
    assert calc_commission_paise("Flexible / Discuss", 50000) == fee


# ══════════════════════════════════════════════════════════════════════════════
# 19. Document analyzer — accepted-job contract without a live AI call
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_document_analyzer_queues_durable_job(monkeypatch):
    from routers import community

    async def fake_enqueue_job(user_id, worker):
        assert user_id == 42
        assert callable(worker)
        return {"job_id": "test-job-id", "status": "queued"}

    monkeypatch.setattr(community, "enqueue_job", fake_enqueue_job)
    req = community.DocumentRequest(
        document_text=(
            "This is a rental agreement between Landlord A and Tenant B. "
            "Rent is Rs. 15,000 per month payable on the 1st of every month. "
            "Lease for 11 months from June 2026. Security deposit Rs. 45,000."
        ),
        document_type="contract",
    )
    result = await community.analyze_document(req, None, {"id": 42})

    route = next(
        route for route in community.router.routes
        if getattr(route, "path", None) == "/document/analyze"
    )
    assert route.status_code == 202
    assert result == {"job_id": "test-job-id", "status": "queued"}


# ══════════════════════════════════════════════════════════════════════════════
# 20. Watch mode — list watches
# ══════════════════════════════════════════════════════════════════════════════

def test_watch_list(client):
    r = client.get(f"{BASE}/watch")
    assert r.status_code == 200
    data = r.json()
    assert "watches" in data or "total" in data
