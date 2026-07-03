"""
ForgeOS Scheduler — polls forgeos_schedules for due recurring mission
triggers. Hand-rolled asyncio loop (matching the pattern used by
digest.py / judgment_ingest.py / main.py's nightly refresh loops), NOT
APScheduler — kept consistent with existing precedent in this codebase.

Only started when FORGEOS_ENABLED is true (see main.py lifespan).
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from database import execute, fetch, fetchrow
from logger import get_logger
from forgeos.config import (
    FORGEOS_SCHEDULER_POLL_SECONDS,
    FORGEOS_STUCK_RUNNING_SECONDS,
    FORGEOS_STUCK_WAITING_SECONDS,
    FORGEOS_STUCK_ASSIGNED_SECONDS,
)

logger = get_logger("litigaforge.forgeos")


async def _run_due_schedules() -> None:
    rows = await fetch(
        """SELECT id, name, mission_template, interval_seconds
           FROM forgeos_schedules
           WHERE enabled = TRUE AND next_run_at <= NOW()"""
    )
    for row in rows:
        try:
            template = row["mission_template"] or {}
            if isinstance(template, str):
                template = json.loads(template)

            title = template.get("title", row["name"])
            description = template.get("description", "")
            input_data = template.get("input", {})
            builder_name = template.get("builder")

            if builder_name == "business_pulse":
                from forgeos.business_pulse import build_pulse
                built = await build_pulse()
                if built is None:
                    # Skipped this run (e.g. daily AI cost cap already reached) —
                    # push next_run_at forward like any other completed poll, no
                    # mission created, no failed-mission clutter in the feed.
                    await execute(
                        """UPDATE forgeos_schedules
                           SET next_run_at = NOW() + ($1 || ' seconds')::interval
                           WHERE id = $2""",
                        str(row["interval_seconds"]), row["id"],
                    )
                    from forgeos.audit import log_action
                    await log_action("pulse.skipped_cost_cap", target_type="schedule", target_id=row["id"],
                                      actor="scheduler",
                                      detail=f"Business Pulse schedule '{row['name']}' skipped — daily AI cost cap reached")
                    continue
                title, description = built
                input_data = {**input_data, "mission_type": "business_pulse"}
            elif builder_name:
                logger.warning("forgeos: schedule '%s' has unknown builder '%s' — falling back to static template",
                                row["name"], builder_name)

            from forgeos.missions import create_mission
            await create_mission(
                title=title,
                description=description,
                agent_id=template.get("agent_id"),
                agent_name=template.get("agent_name"),
                input_data=input_data,
                requires_approval=bool(template.get("requires_approval", False)),
            )
            await execute(
                """UPDATE forgeos_schedules
                   SET last_run_at = NOW(), next_run_at = NOW() + ($1 || ' seconds')::interval
                   WHERE id = $2""",
                str(row["interval_seconds"]), row["id"],
            )
            logger.info("forgeos: schedule '%s' fired a new mission", row["name"])
        except Exception as e:
            logger.error("forgeos: schedule '%s' failed: %s", row["name"], e, exc_info=True)
            # Push next_run_at forward anyway so a broken schedule doesn't fire in a tight loop.
            await execute(
                """UPDATE forgeos_schedules
                   SET next_run_at = NOW() + ($1 || ' seconds')::interval
                   WHERE id = $2""",
                str(row["interval_seconds"]), row["id"],
            )


async def _find_replacement_agent(exclude_agent_id: int | None) -> dict | None:
    """Pick another active agent to take over a blocked mission, preferring
    one whose capabilities overlap with the original agent's (best-effort —
    falls back to any other active agent so a mission never stalls forever
    just because roles don't line up exactly)."""
    from forgeos import registry
    candidates = await registry.list_agents(status="active")
    candidates = [a for a in candidates if a["id"] != exclude_agent_id]
    if not candidates:
        return None

    original = await registry.get_agent(exclude_agent_id) if exclude_agent_id else None
    if original:
        original_caps = set(original.get("capabilities") or [])
        overlapping = [a for a in candidates if original_caps & set(a.get("capabilities") or [])]
        if overlapping:
            candidates = overlapping

    # Prefer whoever is currently idle (no in-flight mission), then whoever
    # has been idle the longest, so load spreads out instead of piling onto
    # a single agent.
    candidates.sort(key=lambda a: (a.get("current_mission_id") is not None,
                                    a.get("last_activity_at") or ""))
    return candidates[0]


async def _alert_founder(subject: str, message: str) -> None:
    """send_founder_alert() does blocking smtplib I/O — never call it directly
    from the async scheduler loop or a slow SMTP server stalls every other
    coroutine (including live user requests) sharing this event loop."""
    from alerts.email import send_founder_alert
    await asyncio.to_thread(send_founder_alert, subject, message)


async def _reassign_stuck_missions() -> None:
    """Detect missions orphaned by a process restart/crash mid-run and either
    hand them to a fresh agent or, if none is available / the block is a
    pending human approval, alert the founder instead of silently stalling."""
    from forgeos import registry
    from forgeos.events import bus
    from forgeos.audit import log_action

    stuck_assigned = await fetch(
        f"""SELECT id, title, agent_id FROM forgeos_missions
           WHERE status = 'assigned' AND updated_at < NOW() - INTERVAL '{FORGEOS_STUCK_ASSIGNED_SECONDS} seconds'"""
    )
    from forgeos import missions as missions_module

    for mission in stuck_assigned:
        mission_id = mission["id"]
        if missions_module.is_mission_task_active(mission_id):
            # Still legitimately queued behind the concurrency semaphore in
            # this same process — NOT an orphan from a crash/restart. Leave
            # it alone; relaunching now would double-execute it.
            logger.info(
                "forgeos: mission #%s has been 'assigned' for over %ss but is still "
                "queued behind the concurrency limit in this process — skipping relaunch",
                mission_id, FORGEOS_STUCK_ASSIGNED_SECONDS,
            )
            continue
        detail = (f"Mission #{mission_id} '{mission['title']}' has been 'assigned' for over "
                  f"{FORGEOS_STUCK_ASSIGNED_SECONDS}s without its task ever starting "
                  "(likely a process restart) — relaunching.")
        logger.warning("forgeos: %s", detail)
        await execute(
            "UPDATE forgeos_missions SET updated_at = NOW() WHERE id = $1", mission_id,
        )
        await log_action("mission.relaunched", target_type="mission", target_id=mission_id,
                          actor="scheduler", detail=detail)
        missions_module._spawn_execution(mission_id)

    stuck_running = await fetch(
        f"""SELECT id, title, agent_id, status FROM forgeos_missions
           WHERE status = 'running' AND updated_at < NOW() - INTERVAL '{FORGEOS_STUCK_RUNNING_SECONDS} seconds'"""
    )
    for mission in stuck_running:
        mission_id, old_agent_id = mission["id"], mission["agent_id"]

        if missions_module.is_mission_task_active(mission_id):
            # Genuinely still executing in this process (e.g. a long LLM
            # call) — not orphaned. Leave it running rather than reassigning
            # and spawning a second execution for the same mission.
            logger.info(
                "forgeos: mission #%s has been 'running' for over %ss but has a live task "
                "in this process — skipping reassignment",
                mission_id, FORGEOS_STUCK_RUNNING_SECONDS,
            )
            continue

        replacement = await _find_replacement_agent(old_agent_id)

        if old_agent_id:
            await registry.update_agent_activity(old_agent_id, current_mission_id=None, progress=0)

        if replacement:
            await fetchrow(
                """UPDATE forgeos_missions SET agent_id = $1, status = 'assigned', updated_at = NOW()
                   WHERE id = $2 RETURNING id""",
                replacement["id"], mission_id,
            )
            detail = (f"Mission #{mission_id} '{mission['title']}' was stuck in 'running' for over "
                      f"{FORGEOS_STUCK_RUNNING_SECONDS}s (likely a process restart) — reassigned from "
                      f"agent #{old_agent_id} to agent #{replacement['id']} ({replacement['name']}).")
            logger.warning("forgeos: %s", detail)
            await bus.publish("mission.blocked", {
                "mission_id": mission_id, "reason": "stuck_running",
                "old_agent_id": old_agent_id, "new_agent_id": replacement["id"],
            }, source="scheduler")
            await log_action("mission.reassigned", target_type="mission", target_id=mission_id,
                              actor="scheduler", detail=detail)
            missions_module._spawn_execution(mission_id)
        else:
            await fetchrow(
                """UPDATE forgeos_missions SET status = 'failed',
                       error = 'Stuck in running with no available agent for reassignment',
                       updated_at = NOW() WHERE id = $1 RETURNING id""",
                mission_id,
            )
            detail = (f"Mission #{mission_id} '{mission['title']}' was stuck in 'running' for over "
                      f"{FORGEOS_STUCK_RUNNING_SECONDS}s and no active agent was available to take over "
                      "— marked failed.")
            logger.error("forgeos: %s", detail)
            await bus.publish("mission.blocked", {"mission_id": mission_id, "reason": "stuck_no_agent"},
                               source="scheduler")
            await log_action("mission.failed_no_agent", target_type="mission", target_id=mission_id,
                              actor="scheduler", detail=detail)
            await _alert_founder(f"ForgeOS mission #{mission_id} blocked", detail)

    stuck_waiting = await fetch(
        f"""SELECT id, title FROM forgeos_missions
           WHERE status = 'waiting' AND updated_at < NOW() - INTERVAL '{FORGEOS_STUCK_WAITING_SECONDS} seconds'"""
    )
    for mission in stuck_waiting:
        # Dedupe: this mission stays 'waiting' until a human acts, so without
        # a cooldown every 60s poll would re-fire — checking the audit log
        # for a prior alert within the same backoff window caps it to one
        # alert per FORGEOS_STUCK_WAITING_SECONDS instead of ~60/hour.
        already_alerted = await fetchrow(
            f"""SELECT id FROM forgeos_audit_log
               WHERE action = 'mission.approval_overdue' AND target_type = 'mission'
                 AND target_id = $1
                 AND created_at > NOW() - INTERVAL '{FORGEOS_STUCK_WAITING_SECONDS} seconds'
               LIMIT 1""",
            str(mission["id"]),
        )
        if already_alerted:
            continue
        detail = (f"Mission #{mission['id']} '{mission['title']}' has been waiting on human approval "
                  f"for over {FORGEOS_STUCK_WAITING_SECONDS}s.")
        logger.warning("forgeos: %s", detail)
        await bus.publish("mission.blocked", {"mission_id": mission["id"], "reason": "approval_overdue"},
                           source="scheduler")
        await log_action("mission.approval_overdue", target_type="mission", target_id=mission["id"],
                          actor="scheduler", detail=detail)
        await _alert_founder(f"ForgeOS mission #{mission['id']} awaiting approval", detail)


async def _scheduler_loop() -> None:
    while True:
        try:
            await asyncio.sleep(FORGEOS_SCHEDULER_POLL_SECONDS)
        except asyncio.CancelledError:
            logger.info("forgeos: scheduler cancelled")
            raise
        try:
            await _run_due_schedules()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("forgeos: scheduler poll failed: %s", e, exc_info=True)
        try:
            await _reassign_stuck_missions()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("forgeos: stuck-mission sweep failed: %s", e, exc_info=True)


def start_scheduler() -> Optional["asyncio.Task"]:
    """Start the ForgeOS schedule poller. Only ever called when
    FORGEOS_ENABLED is true. Returns the task handle so the caller can
    cancel it on shutdown."""
    logger.info("forgeos: scheduler enabled — polling every %ss", FORGEOS_SCHEDULER_POLL_SECONDS)
    return asyncio.create_task(_scheduler_loop())
