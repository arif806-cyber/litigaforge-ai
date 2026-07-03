"""
ForgeOS Dashboard Aggregation — read-only rollups that back the /forgeos
Live AI Command Center. Every number here comes from a real table (no
placeholders/mocks):

  * agents / missions      -> forgeos_agents / forgeos_missions
  * revenue                -> users.subscription_tier x payments.PLAN_PRICES
                               (the same source of truth the subscription
                               router itself writes to on upgrade/downgrade)
  * AI cost                -> forgeos_metrics (metric_type='llm_cost_usd'),
                               populated by forgeos/missions.py from real
                               litellm token usage — see orchestrator.py
  * activity feed          -> forgeos_audit_log + forgeos_events, merged

Deployments/PR queue live in forgeos/github.py (separate module — different
external dependency and its own cache lifecycle).
"""
from database import fetch

from forgeos import registry, missions as missions_mod
from forgeos.audit import list_audit_log
from forgeos.events import recent_events

MISSION_STATUSES = (
    "planned", "waiting", "assigned", "running",
    "reviewing", "completed", "failed", "cancelled",
)


async def _mission_counts() -> dict[str, int]:
    rows = await fetch("SELECT status, COUNT(*) AS n FROM forgeos_missions GROUP BY status")
    counts = {status: 0 for status in MISSION_STATUSES}
    for row in rows:
        counts[row["status"]] = int(row["n"])
    counts["total"] = sum(counts.values())
    return counts


async def _revenue_summary() -> dict:
    """Real MRR from the same subscription_tier column the Razorpay flow
    writes to (routers/subscription.py) — no separate revenue ledger to
    drift out of sync with. Amounts are in whole rupees (PLAN_PRICES is
    stored in paise for Razorpay's API)."""
    from payments import PLAN_PRICES

    rows = await fetch(
        """SELECT subscription_tier, COUNT(*) AS n FROM users
           WHERE subscription_tier != 'free' GROUP BY subscription_tier"""
    )
    by_tier = {}
    mrr_paise = 0
    for row in rows:
        tier = row["subscription_tier"]
        count = int(row["n"])
        price_paise = PLAN_PRICES.get(tier, 0)
        by_tier[tier] = {"subscribers": count, "mrr_rupees": (price_paise * count) / 100}
        mrr_paise += price_paise * count

    total_paid_rows = await fetch(
        "SELECT COUNT(*) AS n FROM users WHERE subscription_tier != 'free'"
    )
    return {
        "mrr_rupees": mrr_paise / 100,
        "paid_subscribers": int(total_paid_rows[0]["n"]) if total_paid_rows else 0,
        "by_tier": by_tier,
    }


async def _ai_cost_summary() -> dict:
    """Real spend from metered LLM calls only — forgeos/missions.py writes a
    row here per mission using litellm's own pricing table
    (llm/legal_llm.py:acomplete_with_usage). Calls that fell back to the
    unmetered ai_brain cascade are not counted (cost genuinely unknown, not
    zero) — `unmetered_calls` surfaces how often that happened so the number
    is understood as a floor, not an exact total."""
    cost_rows = await fetch(
        "SELECT COALESCE(SUM(value), 0) AS total FROM forgeos_metrics WHERE metric_type = 'llm_cost_usd'"
    )
    tokens_rows = await fetch(
        "SELECT COALESCE(SUM(value), 0) AS total FROM forgeos_metrics WHERE metric_type = 'llm_tokens'"
    )
    today_rows = await fetch(
        """SELECT COALESCE(SUM(value), 0) AS total FROM forgeos_metrics
           WHERE metric_type = 'llm_cost_usd' AND created_at >= CURRENT_DATE"""
    )
    by_agent = await fetch(
        """SELECT a.id AS agent_id, a.name, COALESCE(SUM(m.value), 0) AS cost_usd
           FROM forgeos_agents a
           LEFT JOIN forgeos_metrics m ON m.agent_id = a.id AND m.metric_type = 'llm_cost_usd'
           GROUP BY a.id, a.name ORDER BY cost_usd DESC"""
    )
    unmetered = await fetch(
        """SELECT COUNT(*) AS n FROM forgeos_missions
           WHERE status = 'completed' AND result::text LIKE '%ai_brain_cascade%'"""
    )
    return {
        "total_cost_usd": float(cost_rows[0]["total"]),
        "total_tokens": int(tokens_rows[0]["total"]),
        "cost_today_usd": float(today_rows[0]["total"]),
        "by_agent": [{"agent_id": r["agent_id"], "name": r["name"], "cost_usd": float(r["cost_usd"])}
                     for r in by_agent],
        "unmetered_calls": int(unmetered[0]["n"]) if unmetered else 0,
    }


async def _activity_feed(limit: int = 30) -> list[dict]:
    """Merge audit-log entries and bus events into one reverse-chronological
    feed for the dashboard's activity panel."""
    audit_rows = await list_audit_log(limit=limit)
    event_rows = await recent_events(limit=limit)

    feed = []
    for r in audit_rows:
        feed.append({
            "kind": "audit", "created_at": r["created_at"], "action": r["action"],
            "target_type": r["target_type"], "target_id": r["target_id"], "detail": r["detail"],
        })
    for r in event_rows:
        feed.append({
            "kind": "event", "created_at": r["created_at"], "action": r["topic"],
            "target_type": "", "target_id": "", "detail": r["payload"],
        })
    feed.sort(key=lambda x: x["created_at"], reverse=True)
    return feed[:limit]


async def _latest_health_check() -> dict | None:
    """Latest Product Health Check run, if any — deliberately deferred-import
    since health_check.py lives outside forgeos/ and runs independently of
    FORGEOS_ENABLED (never let a missing/broken forgeos dashboard block it,
    or vice versa)."""
    try:
        from health_check import get_latest_run
        return await get_latest_run()
    except Exception as e:
        logger.warning("dashboard: failed to load latest health check: %s", e)
        return None


async def get_dashboard_snapshot() -> dict:
    """Single aggregation call the REST endpoint (and SSE's initial payload)
    both use — keeps GET /forgeos/dashboard and the first SSE frame
    consistent with each other."""
    agents = await registry.list_agents()
    missions = await missions_mod.list_missions(limit=20)
    mission_counts = await _mission_counts()
    revenue = await _revenue_summary()
    ai_cost = await _ai_cost_summary()
    activity = await _activity_feed()
    health_check = await _latest_health_check()

    return {
        "agents": agents,
        "agent_count": len(agents),
        "active_agent_count": sum(1 for a in agents if a["status"] == "active"),
        "missions": missions,
        "mission_counts": mission_counts,
        "revenue": revenue,
        "ai_cost": ai_cost,
        "activity": activity,
        "health_check": health_check,
    }
