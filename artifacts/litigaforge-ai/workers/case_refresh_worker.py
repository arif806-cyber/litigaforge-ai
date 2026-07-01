"""
LitigaForge — Live Case Intelligence Diff Engine

Nightly worker (+ on-demand trigger) that:
  1. Fetches all active tracked_cases
  2. Calls bulk_refresh() in batches of 50
  3. Diffs each new snapshot against the previous one
  4. Writes exactly one case_event per detected change (no event if nothing changed)
  5. Queues in-app notifications for each event

This is the heart of the system. The critical rule:
  NO DIFF = NO EVENT.  Duplicate / noisy events mean users stop trusting the feed.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import Any

from database import fetch as db_fetch, execute as db_execute, fetchval as db_fetchval
from logger import get_logger

logger = get_logger("litigaforge.case_refresh_worker")


# ── Diff logic ─────────────────────────────────────────────────────────────────

def _classify_event(prev: dict, curr: dict) -> list[tuple[str, str]]:
    """
    Compare two snapshots and return a list of (event_type, summary) tuples.
    Returns [] when nothing changed — caller must write NO rows in that case.

    event_type values (per spec):
      hearing_adjourned | next_date_fixed | order_passed |
      case_disposed | court_transferred
    """
    events: list[tuple[str, str]] = []

    # ── Case disposed ───────────────────────────────────────────────────────────
    prev_status = (prev.get("case_status") or "").lower().strip()
    curr_status = (curr.get("case_status") or "").lower().strip()
    if curr_status != prev_status and "dispos" in curr_status:
        events.append((
            "case_disposed",
            f"Case has been disposed. Status changed from '{prev_status}' to '{curr_status}'.",
        ))
        return events  # nothing else matters once disposed

    # ── Court transferred ───────────────────────────────────────────────────────
    # court_name comes from the raw_response stored fields via court_intelligence router
    prev_court = (prev.get("court_name") or "").strip()
    curr_court = (curr.get("court_name") or "").strip()
    if curr_court and prev_court and curr_court != prev_court:
        events.append((
            "court_transferred",
            f"Case transferred from '{prev_court}' to '{curr_court}'.",
        ))

    # ── Hearing date changed ────────────────────────────────────────────────────
    prev_date = prev.get("next_hearing_date")
    curr_date = curr.get("next_hearing_date")
    if prev_date != curr_date and curr_date is not None:
        if prev_date is None:
            events.append((
                "next_date_fixed",
                f"Next hearing date set to {curr_date}.",
            ))
        else:
            # Determine adjournment vs new date
            try:
                # Convert to date objects for comparison
                prev_d = prev_date if isinstance(prev_date, date) else date.fromisoformat(str(prev_date))
                curr_d = curr_date if isinstance(curr_date, date) else date.fromisoformat(str(curr_date))
                if curr_d > prev_d:
                    events.append((
                        "hearing_adjourned",
                        f"Hearing adjourned. Previous date: {prev_date}, new date: {curr_date}.",
                    ))
                else:
                    events.append((
                        "next_date_fixed",
                        f"Next hearing date changed from {prev_date} to {curr_date}.",
                    ))
            except (ValueError, TypeError):
                events.append((
                    "next_date_fixed",
                    f"Next hearing date changed from {prev_date} to {curr_date}.",
                ))

    # ── Order passed (order count increased) ───────────────────────────────────
    prev_orders = int(prev.get("order_count") or 0)
    curr_orders = int(curr.get("order_count") or 0)
    if curr_orders > prev_orders:
        delta = curr_orders - prev_orders
        events.append((
            "order_passed",
            f"{delta} new order{'s' if delta > 1 else ''} added. Total orders: {curr_orders}.",
        ))

    return events


# ── Main worker ────────────────────────────────────────────────────────────────

async def run_refresh(*, cnr_filter: str | None = None) -> dict:
    """
    Full refresh pass.
    cnr_filter: if provided, only refresh that single CNR (for on-demand triggers).
    Returns summary dict for logging / API response.
    """
    # Avoid importing at module level so the worker can be imported before the
    # API key is checked (import doesn't require a live key, only calls do).
    from services.court_data_client import bulk_refresh, get_case_by_cnr

    summary = {"cases_checked": 0, "events_created": 0, "errors": 0}

    # 1. Fetch active tracked cases
    if cnr_filter:
        rows = await db_fetch(
            "SELECT id, cnr, case_type, court_name, user_id "
            "FROM tracked_cases WHERE cnr = $1 AND is_active = true",
            cnr_filter,
        )
    else:
        rows = await db_fetch(
            "SELECT id, cnr, case_type, court_name, user_id "
            "FROM tracked_cases WHERE is_active = true"
        )

    if not rows:
        logger.info("No active tracked cases to refresh.")
        return summary

    logger.info("Starting refresh for %d tracked cases", len(rows))
    summary["cases_checked"] = len(rows)

    # 2. Batch into 50s and call bulk_refresh
    batch_input = [{"tracked_case_id": str(r["id"]), "cnr": r["cnr"]} for r in rows]
    id_map = {str(r["id"]): r for r in rows}  # tracked_case_id -> row

    try:
        # bulk_refresh persists raw snapshots internally before returning
        _results = await bulk_refresh(batch_input)
    except RuntimeError as exc:
        # API key not set or similar — abort gracefully
        logger.error("Court data client error: %s", exc)
        summary["errors"] = len(rows)
        return summary
    except Exception as exc:
        logger.exception("Unexpected error during bulk_refresh: %s", exc)
        summary["errors"] = len(rows)
        return summary

    # 3. For each case, diff the latest two snapshots and classify events
    for tc_id_str, row in id_map.items():
        try:
            events_created = await _diff_and_record(tc_id_str, row)
            summary["events_created"] += events_created

            # Update last_refreshed timestamp
            await db_execute(
                "UPDATE tracked_cases SET last_refreshed = now() WHERE id = $1::uuid",
                tc_id_str,
            )
        except Exception as exc:
            logger.exception("Error processing diffs for tracked_case_id=%s: %s", tc_id_str, exc)
            summary["errors"] += 1

    logger.info(
        "Refresh complete — cases=%d events=%d errors=%d",
        summary["cases_checked"], summary["events_created"], summary["errors"],
    )
    return summary


async def _diff_and_record(tracked_case_id: str, row: dict) -> int:
    """
    Fetch the two most recent snapshots for this case, diff them, and write
    classified events.  Returns the number of events written (0 = no change).
    """
    snapshots = await db_fetch(
        """
        SELECT id, case_status, next_hearing_date, order_count, raw_response, fetched_at
        FROM   case_snapshots
        WHERE  tracked_case_id = $1::uuid
        ORDER  BY fetched_at DESC
        LIMIT  2
        """,
        tracked_case_id,
    )

    if len(snapshots) < 2:
        logger.debug("tracked_case_id=%s has fewer than 2 snapshots — skipping diff", tracked_case_id)
        return 0

    curr_snap = dict(snapshots[0])
    prev_snap = dict(snapshots[1])

    # Enrich with court_name from the tracked_cases row (not in snapshots schema)
    curr_snap["court_name"] = row.get("court_name", "")
    prev_snap["court_name"] = row.get("court_name", "")

    # Detect changes
    changes = _classify_event(prev_snap, curr_snap)

    if not changes:
        logger.debug("tracked_case_id=%s — no changes detected", tracked_case_id)
        return 0

    # Write events and queue notifications
    user_id = str(row["user_id"])
    events_written = 0
    for event_type, summary_text in changes:
        event_id = await db_fetchval(
            """
            INSERT INTO case_events
                (tracked_case_id, event_type, summary, detected_at, notified)
            VALUES ($1::uuid, $2, $3, now(), false)
            RETURNING id
            """,
            tracked_case_id, event_type, summary_text,
        )
        logger.info(
            "Event created: tracked_case_id=%s type=%s event_id=%s",
            tracked_case_id, event_type, event_id,
        )

        # Queue in-app notification
        await db_execute(
            """
            INSERT INTO case_notifications
                (user_id, case_event_id, channel, status)
            VALUES ($1::uuid, $2::uuid, 'in_app', 'pending')
            """,
            user_id, str(event_id),
        )
        events_written += 1

    return events_written
