"""
LitigaForge AI — Realistic Seed + Matching Audit
=================================================
Seeds 5 diverse Lawyer profiles and 5 Client case-requirements,
then runs the full scoring algorithm and prints an audit report.

Usage:
    cd artifacts/litigaforge-ai
    python scripts/seed_test_data.py [--dry-run] [--audit-only]
"""
import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime
from textwrap import indent

import asyncpg
import bcrypt as _bcrypt

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("DATABASE_URL not set — export it before running this script.")

SEED_PASSWORD_HASH = _bcrypt.hashpw(b"LitigaForge@2025!", _bcrypt.gensalt(rounds=12)).decode()

# ─────────────────────────────────────────────
# Seed data
# ─────────────────────────────────────────────

LAWYERS = [
    {
        "email": "seed.ramesh.gupta@litigaforge.test",
        "name": "Adv. Ramesh Chandra Gupta",
        "bar_number": "TS/BAR/2009/04221",
        "district": "Hyderabad",
        "practice_areas": ["Property Dispute", "Civil", "Real Estate", "Rent Control"],
        "languages": ["Telugu", "Hindi", "English"],
        "experience_years": 15,
        "rating": 4.8,
        "bio": (
            "15 years before Telangana HC and City Civil Court Hyderabad. "
            "Handled 300+ property and civil matters. TSRERA empanelled."
        ),
        "hourly_rate": 2500,
        "availability": "available",
        "verification_status": "verified",
        "verified": True,
        "state_code": "TS",
    },
    {
        "email": "seed.priya.nair@litigaforge.test",
        "name": "Adv. Priya Lakshmi Nair",
        "bar_number": "AP/BAR/2016/07834",
        "district": "Vijayawada",
        "practice_areas": ["Family Law", "Divorce", "Matrimonial", "Child Custody"],
        "languages": ["Telugu", "English", "Malayalam"],
        "experience_years": 8,
        "rating": 4.6,
        "bio": (
            "Specialist in HMA 1955 and personal law matters before AP HC and "
            "Family Courts in Krishna district. 150+ divorce and custody cases resolved."
        ),
        "hourly_rate": 1500,
        "availability": "available",
        "verification_status": "verified",
        "verified": True,
        "state_code": "AP",
    },
    {
        "email": "seed.farooq.khan@litigaforge.test",
        "name": "Adv. Mohammed Farooq Khan",
        "bar_number": "TS/BAR/2012/09113",
        "district": "Warangal",
        "practice_areas": ["Criminal", "Bail Matters", "POCSO", "IPC/BNS Defence"],
        "languages": ["Telugu", "Urdu", "English"],
        "experience_years": 12,
        "rating": 4.5,
        "bio": (
            "12 years of criminal practice: Sessions Court Warangal, "
            "Telangana HC. IPC/BNS transition specialist; 80% bail success rate."
        ),
        "hourly_rate": 2000,
        "availability": "available",
        "verification_status": "verified",
        "verified": True,
        "state_code": "TS",
    },
    {
        "email": "seed.sunita.rao@litigaforge.test",
        "name": "Adv. Sunita Rao Patel",
        "bar_number": "TS/BAR/2018/12456",
        "district": "Hyderabad",
        "practice_areas": ["Corporate", "Contracts", "Company Law", "Mergers & Acquisitions"],
        "languages": ["Telugu", "English", "Hindi"],
        "experience_years": 6,
        "rating": 4.3,
        "bio": (
            "Corporate counsel specialising in drafting, M&A due diligence "
            "and NCLT Hyderabad matters. 4 years in-house before private practice."
        ),
        "hourly_rate": 3000,
        "availability": "available",
        "verification_status": "verified",
        "verified": True,
        "state_code": "TS",
    },
    {
        "email": "seed.kishore.yeluri@litigaforge.test",
        "name": "Adv. Kishore Babu Yeluri",
        "bar_number": "AP/BAR/2022/18901",
        "district": "Guntur",
        "practice_areas": ["Consumer", "Family Law", "Property Dispute"],
        "languages": ["Telugu", "English"],
        "experience_years": 3,
        "rating": 3.9,
        "bio": (
            "Junior advocate, Consumer Forum Guntur and AP HC. "
            "Keen on consumer protection (CPA 2019) and RERA matters."
        ),
        "hourly_rate": 800,
        "availability": "available",
        "verification_status": "pending",
        "verified": False,
        "state_code": "AP",
    },
]

CLIENTS = [
    {
        "email": "seed.meera.devi@litigaforge.test",
        "name": "Meera Devi",
        "case": {
            "title": "Property encroachment by neighbour in Hyderabad",
            "case_type": "Property Dispute",
            "description": (
                "Neighbour has encroached 200 sq ft of my plot in Uppal, Hyderabad. "
                "GPA holder disputes the boundary wall. Seeking injunction and demarcation "
                "under TP Act 1882 and TSRERA."
            ),
            "location": "Hyderabad",
            "budget_range": "₹10,000–₹25,000",
            "budget_min": 10000,
            "budget_max": 25000,
            "expected_top_lawyer": "Adv. Ramesh Chandra Gupta",
        },
    },
    {
        "email": "seed.rahul.singh@litigaforge.test",
        "name": "Rahul Kumar Singh",
        "case": {
            "title": "Online fraud — BNS 2023 (post July 2024 offence)",
            "case_type": "Criminal",
            "description": (
                "Victim of ₹3.2 lakh online investment fraud committed in October 2024. "
                "FIR lodged at Banjara Hills PS. Need counsel for BNS Section 318 "
                "(cheating) and BNSS bail proceedings."
            ),
            "location": "Hyderabad",
            "budget_range": "₹50,000–₹1,00,000",
            "budget_min": 50000,
            "budget_max": 100000,
            "expected_top_lawyer": "Adv. Mohammed Farooq Khan",
        },
    },
    {
        "email": "seed.deepa.reddy@litigaforge.test",
        "name": "Deepa Reddy",
        "case": {
            "title": "Divorce and child custody — Vijayawada",
            "case_type": "Family Law",
            "description": (
                "Seeking divorce by mutual consent under HMA 1955 Section 13B. "
                "Dispute over custody of 5-year-old daughter. Residing in Vijayawada, "
                "AP. Require experienced family advocate in AP HC jurisdiction."
            ),
            "location": "Vijayawada",
            "budget_range": "₹15,000–₹30,000",
            "budget_min": 15000,
            "budget_max": 30000,
            "expected_top_lawyer": "Adv. Priya Lakshmi Nair",
        },
    },
    {
        "email": "seed.arun.venkat@litigaforge.test",
        "name": "Arun Venkat",
        "case": {
            "title": "IT services contract breach — multi-district",
            "case_type": "Corporate",
            "description": (
                "Client company based in Hyderabad refused payment of ₹28 lakh for "
                "completed software deliverables. Contract executed at Rangareddy. "
                "Seeking money suit and injunction on IP assignment clause."
            ),
            "location": "Hyderabad and Rangareddy",
            "budget_range": "₹75,000+",
            "budget_min": 75000,
            "budget_max": 200000,
            "expected_top_lawyer": "Adv. Sunita Rao Patel",
        },
    },
    {
        "email": "seed.fatima.begum@litigaforge.test",
        "name": "Fatima Begum",
        "case": {
            "title": "Consumer complaint — defective product purchased online",
            "case_type": "Consumer",
            "description": (
                "Purchased a faulty refrigerator from a Delhi-based e-commerce platform. "
                "Company refuses refund despite CPA 2019 Section 35 complaint. "
                "Residing in Delhi. EXPECTED GAP: may not find local match."
            ),
            "location": "Delhi",
            "budget_range": "₹5,000–₹10,000",
            "budget_min": 5000,
            "budget_max": 10000,
            "expected_top_lawyer": "NONE (gap — no Delhi lawyers seeded)",
        },
    },
]

# ─────────────────────────────────────────────
# Scoring algorithm (mirrors matching.py)
# ─────────────────────────────────────────────

_TS_DISTRICTS = {
    "hyderabad", "secunderabad", "warangal", "hanamkonda", "karimnagar",
    "nizamabad", "khammam", "nalgonda", "medak", "rangareddy", "sangareddy",
    "siddipet", "mancherial", "mahabubabad", "suryapet", "yadadri",
    "vikarabad", "narayanpet", "nagarkurnool", "wanaparthy", "gadwal",
    "jogulamba", "kamareddy", "rajanna", "peddapalli", "bhadradri",
    "mulugu", "asifabad", "kumuram", "jayashankar", "bhupalpally",
    "jangaon", "adilabad", "nirmal", "ranga reddy",
}
_AP_DISTRICTS = {
    "vijayawada", "visakhapatnam", "vizag", "guntur", "tirupati",
    "kakinada", "nellore", "kurnool", "rajahmundry", "eluru",
    "machilipatnam", "amaravati", "chittoor", "ongole", "srikakulam",
    "vizianagaram", "bhimavaram", "tanuku", "narasaraopet", "tenali",
    "bapatla", "markapur", "nandyal", "kadapa", "anantapur",
    "hindupur", "proddatur", "dharmavaram", "tadpatri",
}


def _infer_state(district: str) -> str:
    dl = district.lower()
    if any(d in dl for d in _TS_DISTRICTS):
        return "TS"
    if any(d in dl for d in _AP_DISTRICTS):
        return "AP"
    return ""


def _parse_locations(loc: str) -> list[str]:
    parts = re.split(r'\s+and\s+|[,;&/]', loc.lower())
    return [p.strip() for p in parts if p.strip()]


def _case_state(location_str: str) -> str:
    ll = location_str.lower()
    for d in _TS_DISTRICTS:
        if d in ll:
            return "TS"
    for d in _AP_DISTRICTS:
        if d in ll:
            return "AP"
    return ""


def _normalize_state(raw: str) -> str:
    r = raw.strip().upper()
    if r in ("TS", "TELANGANA", "TG"):
        return "TS"
    if r in ("AP", "ANDHRA PRADESH", "ANDHRAPRADESH"):
        return "AP"
    return ""


def score_lawyer(lawyer: dict, case: dict) -> dict:
    score = 0
    reasons = []

    case_type = case.get("case_type", "").lower()
    case_location = case.get("location", "").lower()
    case_loc_parts = _parse_locations(case_location) if case_location else []

    raw_state = case.get("state_code") or ""
    inferred_case_state = _normalize_state(raw_state) if raw_state else _case_state(case_location)

    pas = [p.lower() for p in lawyer.get("practice_areas", [])]
    if case_type in pas:
        score += 40
        reasons.append(f"Specialises in {case_type.title()}")
    elif any(ct in p for ct in case_type.split() for p in pas):
        score += 25
        reasons.append("Related practice area overlap")

    exp = lawyer.get("experience_years", 0)
    if exp >= 10:
        score += 20
        reasons.append(f"{exp}+ years experience")
    elif exp >= 5:
        score += 10
        reasons.append(f"{exp}+ years experience")

    lawyer_district = lawyer.get("district", "").lower()
    if case_location and case_loc_parts:
        matched_segment = None
        for seg in case_loc_parts:
            if lawyer_district in seg or seg in lawyer_district:
                matched_segment = seg
                break
        if matched_segment is None:
            all_words = " ".join(case_loc_parts).split()
            if any(w in lawyer_district for w in all_words):
                matched_segment = case_location

        if matched_segment is not None:
            if len(case_loc_parts) > 1:
                chosen = matched_segment.title() if matched_segment != case_location else lawyer["district"]
                score += 20
                reasons.append(f"Based in {lawyer['district']} (matched '{chosen}')")
            else:
                score += 20
                reasons.append(f"Based in {lawyer['district']}")
        elif any(w in lawyer_district for w in case_location.split()):
            score += 10
            reasons.append("Nearby location")

    rating = float(lawyer.get("rating", 0) or 0)
    if rating >= 4.5:
        score += 10
        reasons.append(f"Excellent rating ({rating})")
    elif rating >= 4.0:
        score += 5
        reasons.append(f"Strong rating ({rating})")

    lawyer_state = _infer_state(lawyer_district)
    if inferred_case_state and lawyer_state and lawyer_state == inferred_case_state:
        hc_name = "Telangana HC" if lawyer_state == "TS" else "AP HC"
        score += 15
        reasons.append(f"Admitted to {hc_name} (inferred)")

    return {"score": min(score, 100), "reasons": reasons}


# ─────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────

async def seed(conn: asyncpg.Connection, dry_run: bool) -> tuple[list[dict], list[dict]]:
    """Insert seed lawyers + clients; return (lawyer_rows, client_case_rows)."""
    seeded_lawyers = []
    seeded_clients = []

    print("\n── Seeding Lawyers ─────────────────────────────────────────")
    for ld in LAWYERS:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", ld["email"])
        if existing:
            print(f"  SKIP  {ld['name']} (already seeded)")
            row = await conn.fetchrow(
                "SELECT l.*, u.email FROM lawyers l JOIN users u ON u.id = l.user_id WHERE u.email = $1",
                ld["email"],
            )
            seeded_lawyers.append(dict(row))
            continue

        if not dry_run:
            uid = await conn.fetchval(
                """INSERT INTO users (email, name, password_hash, subscription_tier, cases_this_month, month_reset_date)
                   VALUES ($1, $2, $3, 'advocate_pro', 0, NOW())
                   RETURNING id""",
                ld["email"], ld["name"], SEED_PASSWORD_HASH,
            )
            lid = await conn.fetchval(
                """INSERT INTO lawyers
                   (user_id, name, email, phone, bar_number, district,
                    practice_areas, languages, experience_years, rating,
                    bio, hourly_rate, availability, verification_status, verified)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                   RETURNING id""",
                uid, ld["name"], ld["email"], "+91-000-000-0000",
                ld["bar_number"], ld["district"],
                ld["practice_areas"], ld["languages"],
                ld["experience_years"], ld["rating"],
                ld["bio"], ld["hourly_rate"],
                ld["availability"], ld["verification_status"], ld["verified"],
            )
            row = dict(await conn.fetchrow("SELECT * FROM lawyers WHERE id = $1", lid))
            seeded_lawyers.append(row)
            print(f"  ADD   {ld['name']} ({ld['district']}, {ld['experience_years']} yrs, {ld['verification_status']})")
        else:
            print(f"  DRY   {ld['name']} (would insert)")

    print("\n── Seeding Clients & Cases ────────────────────────────────")
    for cd in CLIENTS:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", cd["email"])
        if existing:
            uid = existing["id"]
            print(f"  SKIP  {cd['name']} user (already seeded)")
        elif not dry_run:
            uid = await conn.fetchval(
                """INSERT INTO users (email, name, password_hash, subscription_tier, cases_this_month, month_reset_date)
                   VALUES ($1, $2, $3, 'free', 0, NOW())
                   RETURNING id""",
                cd["email"], cd["name"], SEED_PASSWORD_HASH,
            )
            print(f"  ADD   User {cd['name']}")
        else:
            print(f"  DRY   {cd['name']} (would insert)")
            uid = 0

        c = cd["case"]
        case_exists = await conn.fetchrow(
            "SELECT id FROM case_requirements WHERE user_id = $1 AND title = $2",
            uid, c["title"],
        )
        if case_exists:
            print(f"  SKIP  Case '{c['title']}' (already seeded)")
            row = dict(await conn.fetchrow("SELECT * FROM case_requirements WHERE id = $1", case_exists["id"]))
            row["expected_top_lawyer"] = c.get("expected_top_lawyer", "")
            seeded_clients.append(row)
        elif not dry_run:
            cid = await conn.fetchval(
                """INSERT INTO case_requirements
                   (user_id, title, case_type, description, location, budget_range,
                    budget_min, budget_max, is_anonymous, status)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,'open')
                   RETURNING id""",
                uid, c["title"], c["case_type"], c["description"],
                c["location"], c["budget_range"],
                c["budget_min"], c["budget_max"],
            )
            row = dict(await conn.fetchrow("SELECT * FROM case_requirements WHERE id = $1", cid))
            row["expected_top_lawyer"] = c.get("expected_top_lawyer", "")
            seeded_clients.append(row)
            print(f"  ADD   Case '{c['title']}' ({c['case_type']}, {c['location']})")
        else:
            print(f"  DRY   Case '{c['title']}' (would insert)")

    return seeded_lawyers, seeded_clients


async def audit(
    conn: asyncpg.Connection,
    seeded_lawyers: list[dict],
    seeded_clients: list[dict],
) -> None:
    all_verified = [l for l in seeded_lawyers if l.get("verification_status") == "verified"]

    print("\n" + "=" * 65)
    print("  MATCHING ALGORITHM AUDIT REPORT")
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)
    print(f"  Verified lawyers in pool: {len(all_verified)} / {len(seeded_lawyers)}")
    print(f"  Client cases:             {len(seeded_clients)}")

    ok_count = 0
    warn_count = 0
    fail_count = 0

    for case in seeded_clients:
        print(f"\n{'─'*65}")
        print(f"  Case: {case['title']}")
        print(f"  Type: {case.get('case_type','?')}  |  Location: {case.get('location','?')}")
        expected = case.get("expected_top_lawyer", "")

        results = []
        for l in all_verified:
            r = score_lawyer(dict(l), dict(case))
            results.append((l, r))

        results.sort(key=lambda x: x[1]["score"], reverse=True)

        if not results:
            print("  ⚠  NO LAWYERS to score")
            fail_count += 1
            continue

        top = results[0]
        top_score = top[1]["score"]
        top_name = top[0].get("name", "?")

        print(f"\n  Rankings:")
        for rank, (l, r) in enumerate(results[:5], 1):
            name = l.get("name", "?")
            bar = "▓" * (r["score"] // 10) + "░" * (10 - r["score"] // 10)
            flag = " ← TOP" if rank == 1 else ""
            print(f"  {rank}. [{bar}] {r['score']:3d}  {name}{flag}")
            print(f"         {', '.join(r['reasons'][:3])}")

        match_ok = (
            expected == "NONE (gap — no Delhi lawyers seeded)"
            or (expected and expected in top_name)
        )
        if expected == "NONE (gap — no Delhi lawyers seeded)":
            gap_score = top_score
            if gap_score < 30:
                print(f"\n  ✓ GAP CONFIRMED: best score {gap_score} < 30 (no strong local match)")
                ok_count += 1
            else:
                print(f"\n  ⚠ GAP NOT CONFIRMED: best score {gap_score} ≥ 30 (unexpected match found)")
                warn_count += 1
        elif match_ok:
            print(f"\n  ✓ PASS: Expected '{expected}' → top match (score {top_score})")
            ok_count += 1
        else:
            print(f"\n  ✗ MISMATCH: Expected '{expected}' but top is '{top_name}' (score {top_score})")
            fail_count += 1

    print(f"\n{'=' * 65}")
    verdict = "ALL PASS" if fail_count == 0 and warn_count == 0 else "ISSUES FOUND"
    print(f"  AUDIT RESULT: {verdict}")
    print(f"  ✓ Pass: {ok_count}  ⚠ Warn: {warn_count}  ✗ Fail: {fail_count}")
    print("=" * 65)

    if fail_count > 0:
        print("\n  ACTION: Review scoring weights in routers/matching.py")
    if warn_count > 0:
        print("  ACTION: Consider adding more lawyers for underserved locations")


# ─────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed + audit LitigaForge test data")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be inserted without writing")
    parser.add_argument("--audit-only", action="store_true", help="Skip seeding, just audit existing seed data")
    args = parser.parse_args()

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        if args.audit_only:
            seeded_lawyers, seeded_clients = [], []
            for ld in LAWYERS:
                row = await conn.fetchrow(
                    "SELECT l.* FROM lawyers l JOIN users u ON u.id = l.user_id WHERE u.email = $1",
                    ld["email"],
                )
                if row:
                    seeded_lawyers.append(dict(row))
            for cd in CLIENTS:
                user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", cd["email"])
                if user:
                    row = await conn.fetchrow(
                        "SELECT * FROM case_requirements WHERE user_id = $1 AND title = $2",
                        user["id"], cd["case"]["title"],
                    )
                    if row:
                        d = dict(row)
                        d["expected_top_lawyer"] = cd["case"].get("expected_top_lawyer", "")
                        seeded_clients.append(d)
        else:
            seeded_lawyers, seeded_clients = await seed(conn, args.dry_run)

        if seeded_lawyers and seeded_clients and not args.dry_run:
            await audit(conn, seeded_lawyers, seeded_clients)
        elif args.dry_run:
            print("\n  [dry-run] Skipping audit — no data was written.")
        else:
            print("\n  [warn] No lawyers or cases found to audit.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
