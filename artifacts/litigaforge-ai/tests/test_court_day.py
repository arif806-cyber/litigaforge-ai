"""Court Day: board trust rules, cause-list matching, privacy masking and the law crosswalk."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from routers import court_day as cd

IST = ZoneInfo("Asia/Kolkata")
NOW = datetime(2026, 10, 15, 11, 0, tzinfo=IST)
COURT = {"state": "Telangana", "district_code": "Hyderabad", "complex_code": "High Court", "court": "Court", "court_no": "4"}


def row(item, user, minutes_ago, status="accepted"):
    return {"item_no": item, "user_id": user, "status": status, "created_at": NOW - timedelta(minutes=minutes_ago)}


# ── board summary ─────────────────────────────────────────────────────────────
def test_no_updates_means_no_board():
    assert cd.summarise_board([], NOW) is None
    assert cd.summarise_board([row(9, 1, 1, "pending")], NOW) is None


def test_latest_accepted_value_wins_and_counts_confirming_advocates():
    rows = [row(12, 1, 2), row(12, 2, 4), row(11, 3, 8)]
    board = cd.summarise_board(rows, NOW)
    assert board["now_item"] == 12
    assert board["advocates"] == 2
    assert board["minutes_ago"] == 2
    assert board["stale"] is False
    assert board["source"] == "advocates_in_court"


def test_board_goes_stale_then_disappears():
    assert cd.summarise_board([row(9, 1, 25)], NOW)["stale"] is True
    assert cd.summarise_board([row(9, 1, 60 * 3 + 1)], NOW) is None


def test_pending_rows_never_become_the_board():
    rows = [row(40, 5, 1, "pending"), row(12, 1, 3)]
    assert cd.summarise_board(rows, NOW)["now_item"] == 12


# ── trust rules ───────────────────────────────────────────────────────────────
def test_first_update_and_normal_progress_are_accepted():
    assert cd.decide_status(None, 7, [], 1) == "accepted"
    assert cd.decide_status(10, 11, [], 1) == "accepted"
    assert cd.decide_status(10, 8, [], 1) == "accepted"      # small correction
    assert cd.decide_status(10, 40, [], 1) == "accepted"     # lists move fast after passovers


def test_surprising_values_need_a_second_advocate():
    assert cd.decide_status(10, 41, [], 1) == "pending"
    assert cd.decide_status(10, 3, [], 1) == "pending"
    # the same advocate repeating himself does not confirm it
    assert cd.decide_status(10, 41, [{"item_no": 41, "user_id": 1}], 1) == "pending"
    # a different advocate reporting the same value does
    assert cd.decide_status(10, 41, [{"item_no": 41, "user_id": 2}], 1) == "accepted"


# ── cause-list matching ───────────────────────────────────────────────────────
def test_court_key_is_stable_and_requires_all_parts():
    assert cd.court_key(COURT) == "TELANGANA|HYDERABAD|HIGH COURT|4"
    assert cd.court_key({**COURT, "state": " telangana "}) == cd.court_key(COURT)
    assert cd.court_key({**COURT, "court_no": ""}) == ""


def test_locate_matter_finds_item_hall_and_list_size():
    day = date(2026, 10, 15)
    lists = [{"court": COURT, "date": day, "matters": [
        {"cnr": "TSHC010000012025", "itemNo": 3},
        {"cnr": "tshc 0100 0001 7 2025", "itemNo": "17", "purpose": "Arguments"},
        {"cnr": "TSHC010000022025"},
    ]}]
    place = cd.locate_matter("TSHC01000001720 25".replace(" ", ""), day, lists)
    assert place == {
        "court_key": "TELANGANA|HYDERABAD|HIGH COURT|4", "court": "Court", "hall": "4", "item": "17",
        "list_size": 3, "purpose": "Arguments", "source": "cause_list",
    }
    # falls back to list position when the list has no item numbers
    assert cd.locate_matter("TSHC010000022025", day, lists)["item"] == "3"
    # other days and unknown CNRs are not matched
    assert cd.locate_matter("TSHC010000022025", day + timedelta(days=1), lists) is None
    assert cd.locate_matter("", day, lists) is None


# ── privacy ───────────────────────────────────────────────────────────────────
def test_family_child_and_sexual_offence_matters_are_marked_sensitive():
    for text in ("Family Law", "Matrimonial", "O.P. for maintenance", "Child custody", "POCSO", "u/s 376 IPC",
                 "Domestic Violence Act", "Guardianship"):
        assert cd.is_sensitive(text), text
    for text in ("Civil Litigation", "Writ Petition", "Bail u/s 439 CrPC", "Cheque bounce"):
        assert not cd.is_sensitive(text), text


# ── law crosswalk and briefs ──────────────────────────────────────────────────
def test_law_mapping_uses_the_local_crosswalk():
    mapped = cd.law_mapping("Bail application u/s 439 CrPC; offence under section 420 IPC")
    assert {"old": "CrPC s.439", "new": "BNSS s.483"} == {k: mapped[0][k] for k in ("old", "new")}
    assert mapped[1]["old"] == "IPC s.420" and mapped[1]["new"].startswith("BNS s.318")
    assert cd.law_mapping("") == []
    assert cd.law_mapping("Recovery suit under Order 37 CPC") == []


def test_orders_from_snapshot_are_newest_first_and_capped():
    raw = {"orders": [
        {"order_date": "2026-09-18", "title": "Notice served"},
        {"order_date": "2026-10-02", "title": "Counter filed"},
        {"order_date": "2026-08-01", "title": "Admitted"},
        {"order_date": "2026-07-01", "title": "Filed"},
    ]}
    orders = cd._orders_from_snapshot(raw)
    assert [o["date"] for o in orders] == ["2026-10-02", "2026-09-18", "2026-08-01"]
    assert cd._orders_from_snapshot({}) == []


def test_week_runs_monday_to_sunday():
    week = cd._week_of(date(2026, 10, 15))
    assert week[0] == date(2026, 10, 12) and week[-1] == date(2026, 10, 18)
