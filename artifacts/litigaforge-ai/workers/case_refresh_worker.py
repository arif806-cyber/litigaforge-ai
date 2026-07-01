"""
LitigaForge — Live Case Intelligence Diff Engine  (Phase 1 + Phase 2)

Nightly worker (+ on-demand trigger) that:
  1. Fetches all active tracked_cases
  2. Calls bulk_refresh() in batches of 50
  3. Diffs each new snapshot against the previous one
  4. Writes exactly one case_event per detected change (no event if nothing changed)
  5. Queues in-app + email notifications for each event
  6. Embeds new order text into case_order_embeddings on order_passed events

Phase 2 additions (do not remove Phase 1 logic):
  - _embed_new_orders(): embeds new court orders via NIM into case_order_embeddings
  - _chunk_text():        sentence-boundary splitter targeting ~500 tokens
  - _send_case_event_email(): immediate email dispatch with retry-on-failure fallback
  - run_notification_retry(): hourly job that retries pending email notifications

Critical rules:
  NO DIFF = NO EVENT.  Duplicate / noisy events mean users stop trusting the feed.
  Scope filter is MANDATORY in all vector searches — never cross-case.
"""
from __future__ import annotations

import asyncio
import re
from datetime import date, datetime
from typing import Any

from database import fetch as db_fetch, execute as db_execute, fetchval as db_fetchval, fetchrow as db_fetchrow
from logger import get_logger

logger = get_logger("litigaforge.case_refresh_worker")


# ── Text chunking ───────────────────────────────────────────────────────────────

def _chunk_text(text: str, chunk_size: int = 400) -> list[str]:
    """
    Split text into chunks of approximately chunk_size words on sentence boundaries.
    Targets ~500 tokens per chunk (400 words ≈ 533 tokens at 1.33 tokens/word).
    Falls back to word-boundary splitting for very long sentences.
    """
    if not text:
        return []

    # Split on sentence boundaries (., !, ? followed by space/newline)
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for sentence in sentences:
        words = len(sentence.split())
        if current_words + words > chunk_size and current:
            chunks.append(" ".join(current))
            current = []
            current_words = 0
        # If a single sentence exceeds chunk_size, split by words
        if words > chunk_size:
            sentence_words = sentence.split()
            for i in range(0, len(sentence_words), chunk_size):
                chunks.append(" ".join(sentence_words[i : i + chunk_size]))
        else:
            current.append(sentence)
            current_words += words

    if current:
        chunks.append(" ".join(current))

    return [c for c in chunks if c.strip()]


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
            try:
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


# ── Phase 2: order embedding ────────────────────────────────────────────────────

async def _embed_new_orders(tracked_case_id: str, cnr: str) -> None:
    """
    Fetch new orders for this case and embed them into case_order_embeddings.
    Called as a fire-and-forget task after an order_passed event.
    Failure is fully soft — logs and returns, retried on next nightly run.
    """
    try:
        from llm.nim_embed import aembed_passages, nim_embed_enabled, vec_to_str
        if not nim_embed_enabled():
            logger.info("embed_new_orders: NIM_API_KEY not set — skipping for tc=%s", tracked_case_id)
            return

        from services.court_data_client import get_case_orders, get_order_text

        # Which order_ids have already been embedded for this case?
        existing_rows = await db_fetch(
            "SELECT DISTINCT order_id FROM case_order_embeddings "
            "WHERE tracked_case_id = $1::uuid AND order_id IS NOT NULL",
            tracked_case_id,
        )
        already_embedded: set[str] = {r["order_id"] for r in existing_rows}

        orders = await get_case_orders(cnr)
        if not orders:
            logger.info(
                "embed_new_orders: get_case_orders returned empty for cnr=%s — "
                "will retry on next nightly run", cnr,
            )
            return

        embedded_count = 0
        for order in orders:
            order_id = order.get("order_id") or order.get("orderId") or order.get("id")
            if not order_id:
                continue
            order_id = str(order_id)

            if order_id in already_embedded:
                continue  # already processed

            order_date_raw = order.get("order_date") or order.get("orderDate")
            # Prefer inline text from bulk response; fall back to per-order API call
            text = (
                order.get("order_text")
                or order.get("text")
                or order.get("content")
                or order.get("order_content")
                or ""
            ).strip()
            if not text:
                text_fetched = await get_order_text(cnr, order_id)
                if not text_fetched:
                    logger.warning(
                        "embed_new_orders: no text for order_id=%s cnr=%s — "
                        "will retry on next nightly run", order_id, cnr,
                    )
                    continue
                text = text_fetched

            chunks = _chunk_text(text)
            if not chunks:
                continue

            vecs = await aembed_passages(chunks)
            if vecs is None:
                logger.warning(
                    "embed_new_orders: embedding call failed for order_id=%s", order_id,
                )
                continue

            for chunk_text, vec in zip(chunks, vecs):
                if vec is None:
                    continue
                try:
                    await db_execute(
                        """
                        INSERT INTO case_order_embeddings
                            (tracked_case_id, order_id, order_date, order_text, embedding)
                        VALUES ($1::uuid, $2, $3::date, $4, $5::vector)
                        """,
                        tracked_case_id,
                        order_id,
                        order_date_raw or None,
                        chunk_text,
                        vec_to_str(vec),
                    )
                except Exception as insert_err:
                    logger.warning(
                        "embed_new_orders: insert failed for order_id=%s: %s", order_id, insert_err,
                    )

            embedded_count += 1
            already_embedded.add(order_id)

        logger.info(
            "embed_new_orders: tc=%s cnr=%s — embedded %d new order(s)",
            tracked_case_id, cnr, embedded_count,
        )

    except Exception as exc:
        logger.exception(
            "embed_new_orders: unexpected error for tc=%s cnr=%s: %s",
            tracked_case_id, cnr, exc,
        )


# ── Phase 2: email dispatch ─────────────────────────────────────────────────────

async def _send_case_event_email(
    notif_id: str,
    user_email: str,
    user_name: str,
    event_type: str,
    summary_text: str,
    case_type: str | None,
    court_name: str | None,
    tracked_case_id: str,
) -> None:
    """
    Attempt an immediate case-event email send, then update the notification status.
    Leaves status='pending' on failure so the hourly retry job can pick it up.
    """
    try:
        from alerts.email import send_case_event_email as _send_email
        result = _send_email(
            to_email=user_email,
            name=user_name,
            event_type=event_type,
            case_type=case_type or "Case",
            court_name=court_name or "Court",
            summary=summary_text,
            case_link=f"/cnr-tracker",
        )
        if result.get("success"):
            await db_execute(
                "UPDATE case_notifications SET status = 'sent', sent_at = now() "
                "WHERE id = $1::uuid",
                notif_id,
            )
            logger.info(
                "case email sent: notif_id=%s to=%s event=%s", notif_id, user_email, event_type,
            )
        else:
            logger.warning(
                "case email failed (will retry): notif_id=%s error=%s",
                notif_id, result.get("error"),
            )
    except Exception as exc:
        logger.warning(
            "case email dispatch error (will retry): notif_id=%s: %s", notif_id, exc,
        )


# ── Main worker ────────────────────────────────────────────────────────────────

async def run_refresh(*, cnr_filter: str | None = None) -> dict:
    """
    Full refresh pass.
    cnr_filter: if provided, only refresh that single CNR (for on-demand triggers).
    Returns summary dict for logging / API response.
    """
    from services.court_data_client import bulk_refresh, get_case_by_cnr

    summary = {"cases_checked": 0, "events_created": 0, "errors": 0}

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

    batch_input = [{"tracked_case_id": str(r["id"]), "cnr": r["cnr"]} for r in rows]
    id_map = {str(r["id"]): r for r in rows}

    try:
        _results = await bulk_refresh(batch_input)
    except RuntimeError as exc:
        logger.error("Court data client error: %s", exc)
        summary["errors"] = len(rows)
        return summary
    except Exception as exc:
        logger.exception("Unexpected error during bulk_refresh: %s", exc)
        summary["errors"] = len(rows)
        return summary

    for tc_id_str, row in id_map.items():
        try:
            events_created = await _diff_and_record(tc_id_str, row)
            summary["events_created"] += events_created

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

    # Phase 3: update predictive next-hearing estimates after all diffs are done
    try:
        await _update_predictions()
    except Exception as _pred_err:
        logger.exception("prediction update failed (non-fatal): %s", _pred_err)

    return summary


# ── Phase 3: predictive timeline ───────────────────────────────────────────────

async def _update_predictions() -> None:
    """
    Heuristic predictive timeline — runs at end of each nightly refresh.

    Algorithm:
      1. Collect all consecutive hearing-date pairs per tracked case.
      2. Group intervals by (case_type, court_name).
      3. For groups with ≥3 interval data points, compute median interval.
      4. predicted_next_hearing = last_known_hearing_date + median_interval.
      5. Groups with <3 data points → set predicted_next_hearing = NULL
         (never fabricate a date from insufficient data).
    """
    from collections import defaultdict
    from datetime import timedelta as _td, date as _date

    # All snapshots with a hearing date, for active tracked cases with known type+court
    rows = await db_fetch(
        """
        SELECT tc.id::text  AS tracked_case_id,
               tc.case_type,
               tc.court_name,
               cs.next_hearing_date
        FROM   case_snapshots cs
        JOIN   tracked_cases  tc ON tc.id = cs.tracked_case_id
        WHERE  cs.next_hearing_date IS NOT NULL
          AND  tc.is_active    = true
          AND  tc.case_type    IS NOT NULL
          AND  tc.court_name   IS NOT NULL
        ORDER  BY tc.id, cs.fetched_at
        """
    )

    if not rows:
        logger.debug("predictions: no snapshot data to process")
        return

    # Build per-case sorted hearing-date lists
    case_dates: dict[str, list[str]] = defaultdict(list)
    case_group: dict[str, tuple[str, str]] = {}
    for r in rows:
        tc_id = r["tracked_case_id"]
        d = r["next_hearing_date"]
        ds = str(d) if d else None
        if ds:
            case_dates[tc_id].append(ds)
        if tc_id not in case_group:
            case_group[tc_id] = (r["case_type"], r["court_name"])

    # Compute consecutive intervals per case, aggregate by group
    group_intervals: dict[tuple[str, str], list[int]] = defaultdict(list)
    for tc_id, dates in case_dates.items():
        unique_sorted = sorted(set(dates))
        if len(unique_sorted) < 2:
            continue
        grp = case_group.get(tc_id)
        if not grp:
            continue
        for i in range(1, len(unique_sorted)):
            d1 = _date.fromisoformat(unique_sorted[i - 1])
            d2 = _date.fromisoformat(unique_sorted[i])
            interval = (d2 - d1).days
            if interval > 0:
                group_intervals[grp].append(interval)

    # Compute median per group that has ≥3 data points
    group_median: dict[tuple[str, str], int] = {}
    for grp, intervals in group_intervals.items():
        if len(intervals) >= 3:
            s = sorted(intervals)
            group_median[grp] = s[len(s) // 2]

    # Get last known hearing date per active case
    last_rows = await db_fetch(
        """
        SELECT tc.id::text  AS tracked_case_id,
               tc.case_type,
               tc.court_name,
               MAX(cs.next_hearing_date) AS last_date
        FROM   tracked_cases  tc
        JOIN   case_snapshots cs ON cs.tracked_case_id = tc.id
        WHERE  tc.is_active   = true
          AND  cs.next_hearing_date IS NOT NULL
          AND  tc.case_type   IS NOT NULL
          AND  tc.court_name  IS NOT NULL
        GROUP  BY tc.id, tc.case_type, tc.court_name
        """
    )

    updated = 0
    nulled = 0
    for r in last_rows:
        grp = (r["case_type"], r["court_name"])
        median_days = group_median.get(grp)
        if median_days is None:
            # Not enough system-wide data — leave NULL
            await db_execute(
                "UPDATE tracked_cases SET predicted_next_hearing = NULL "
                "WHERE id = $1::uuid",
                r["tracked_case_id"],
            )
            nulled += 1
        else:
            last = r["last_date"]
            if isinstance(last, str):
                last = _date.fromisoformat(last)
            predicted = last + _td(days=median_days)
            await db_execute(
                "UPDATE tracked_cases SET predicted_next_hearing = $1 "
                "WHERE id = $2::uuid",
                predicted, r["tracked_case_id"],
            )
            updated += 1

    logger.info(
        "predictions: updated=%d null_kept=%d (groups_with_data=%d)",
        updated, nulled, len(group_median),
    )


async def _diff_and_record(tracked_case_id: str, row: dict) -> int:
    """
    Fetch the two most recent snapshots for this case, diff them, and write
    classified events + notifications (in-app + email).
    Returns the number of events written (0 = no change).
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

    curr_snap["court_name"] = row.get("court_name", "")
    prev_snap["court_name"] = row.get("court_name", "")

    changes = _classify_event(prev_snap, curr_snap)

    if not changes:
        logger.debug("tracked_case_id=%s — no changes detected", tracked_case_id)
        return 0

    # Fetch user info for email notifications (one DB call per case, not per event)
    user_id_int: int = int(row["user_id"])
    user_info = await db_fetchrow(
        "SELECT email, name, case_tracking_emails FROM users WHERE id = $1",
        user_id_int,
    )
    send_email = (
        user_info is not None
        and user_info.get("case_tracking_emails", True) is not False
    )

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

        # ── In-app notification (always) ────────────────────────────────────────
        # FIX: user_id is INTEGER — do not cast as ::uuid
        await db_execute(
            """
            INSERT INTO case_notifications
                (user_id, case_event_id, channel, status)
            VALUES ($1, $2::uuid, 'in_app', 'pending')
            """,
            user_id_int, str(event_id),
        )

        # ── Email notification (respects opt-out) ──────────────────────────────
        if send_email:
            notif_id = await db_fetchval(
                """
                INSERT INTO case_notifications
                    (user_id, case_event_id, channel, status)
                VALUES ($1, $2::uuid, 'email', 'pending')
                RETURNING id::text
                """,
                user_id_int, str(event_id),
            )
            if notif_id:
                asyncio.ensure_future(
                    _send_case_event_email(
                        notif_id=str(notif_id),
                        user_email=user_info["email"],
                        user_name=user_info.get("name") or "there",
                        event_type=event_type,
                        summary_text=summary_text,
                        case_type=row.get("case_type"),
                        court_name=row.get("court_name"),
                        tracked_case_id=tracked_case_id,
                    )
                )

        # ── Order embedding (fire-and-forget on order_passed) ──────────────────
        if event_type == "order_passed":
            asyncio.ensure_future(
                _embed_new_orders(tracked_case_id, row["cnr"])
            )

        events_written += 1

    return events_written


# ── Phase 2: hourly notification retry ─────────────────────────────────────────

async def run_notification_retry() -> dict:
    """
    Pick up any case_notifications with channel='email' and status='pending'
    and attempt to resend them.  Called by the hourly retry scheduler in main.py.
    Returns a summary dict.
    """
    summary = {"checked": 0, "sent": 0, "failed": 0}

    pending = await db_fetch(
        """
        SELECT
            cn.id::text          AS notif_id,
            cn.user_id,
            cn.case_event_id::text,
            ce.event_type,
            ce.summary,
            ce.tracked_case_id::text,
            tc.cnr,
            tc.case_type,
            tc.court_name,
            u.email,
            u.name,
            u.case_tracking_emails
        FROM   case_notifications cn
        JOIN   case_events   ce ON ce.id = cn.case_event_id
        JOIN   tracked_cases tc ON tc.id = ce.tracked_case_id
        JOIN   users          u ON u.id  = cn.user_id
        WHERE  cn.channel = 'email'
          AND  cn.status  = 'pending'
        ORDER  BY cn.id
        LIMIT  100
        """,
    )

    for row in pending:
        summary["checked"] += 1
        # Honour opt-out (in case preference changed since original attempt)
        if row.get("case_tracking_emails") is False:
            await db_execute(
                "UPDATE case_notifications SET status = 'skipped' WHERE id = $1::uuid",
                row["notif_id"],
            )
            continue

        try:
            from alerts.email import send_case_event_email as _send_email
            result = _send_email(
                to_email=row["email"],
                name=row.get("name") or "there",
                event_type=row["event_type"],
                case_type=row.get("case_type") or "Case",
                court_name=row.get("court_name") or "Court",
                summary=row["summary"],
                case_link="/cnr-tracker",
            )
            if result.get("success"):
                await db_execute(
                    "UPDATE case_notifications SET status = 'sent', sent_at = now() "
                    "WHERE id = $1::uuid",
                    row["notif_id"],
                )
                summary["sent"] += 1
                logger.info(
                    "retry: email sent notif_id=%s to=%s", row["notif_id"], row["email"],
                )
            else:
                summary["failed"] += 1
                logger.warning(
                    "retry: email still failing notif_id=%s: %s",
                    row["notif_id"], result.get("error"),
                )
        except Exception as exc:
            summary["failed"] += 1
            logger.warning("retry: error for notif_id=%s: %s", row["notif_id"], exc)

    logger.info(
        "notification retry done — checked=%d sent=%d failed=%d",
        summary["checked"], summary["sent"], summary["failed"],
    )
    return summary
