"""
ForgeOS Business Pulse — a recurring, live-metrics-driven business advisory
mission. Every time it fires, build_pulse() pulls FRESH real numbers (new
signups, cases, matches, lawyer-verification backlog, contact volume,
revenue, AI cost-to-date) straight from the database and hands them to the
CEO agent as the mission description — never a stale, reused prompt.

Fired by forgeos/scheduler.py via the `builder: "business_pulse"` key in a
forgeos_schedules row (seeded once, idempotently, by forgeos/seed.py). This
reuses the existing schedules table for interval state, enable/disable, and
error backoff instead of running a second standalone asyncio loop.
"""
from datetime import datetime, timezone

from database import fetch
from forgeos import dashboard
from forgeos.orchestrator import _daily_cost_cap_exceeded
from logger import get_logger

logger = get_logger("litigaforge.forgeos.business_pulse")


async def _counts_today() -> dict:
    rows = await fetch(
        """SELECT
             (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) AS new_signups,
             (SELECT COUNT(*) FROM case_requirements WHERE created_at >= CURRENT_DATE) AS new_cases,
             (SELECT COUNT(*) FROM matches WHERE created_at >= CURRENT_DATE) AS new_matches,
             (SELECT COUNT(*) FROM matches WHERE status = 'accepted'
                AND created_at >= CURRENT_DATE) AS accepted_matches,
             (SELECT COUNT(*) FROM lawyers WHERE verification_status = 'pending') AS pending_verifications,
             (SELECT COUNT(*) FROM contact_messages WHERE created_at >= CURRENT_DATE) AS new_contact_messages
        """
    )
    return dict(rows[0]) if rows else {}


async def build_pulse() -> tuple[str, str] | None:
    """Returns (title, description) for a fresh Business Pulse mission, or
    None if today's ForgeOS AI spend already hit the daily cap — the caller
    should skip firing rather than let the mission fail loudly and clutter
    the feed with a cap-blocked entry."""
    spent_today = await _daily_cost_cap_exceeded()
    if spent_today is not None:
        logger.info("business_pulse: skipping run — daily cost cap already reached ($%.4f)", spent_today)
        return None

    counts = await _counts_today()
    revenue = await dashboard._revenue_summary()
    ai_cost = await dashboard._ai_cost_summary()

    today_label = datetime.now(timezone.utc).strftime("%d %b %Y")
    lines = [
        f"Business Pulse — {today_label} (live snapshot, freshly computed this run)",
        "",
        "Today so far:",
        f"- New signups: {counts.get('new_signups', 0)}",
        f"- New case postings: {counts.get('new_cases', 0)}",
        f"- New lawyer-client matches: {counts.get('new_matches', 0)} "
        f"({counts.get('accepted_matches', 0)} accepted)",
        f"- New contact messages: {counts.get('new_contact_messages', 0)}",
        f"- Lawyers awaiting verification (current queue): {counts.get('pending_verifications', 0)}",
        "",
        f"Revenue: MRR Rs {revenue.get('mrr_rupees', 0):,.0f} across "
        f"{revenue.get('paid_subscribers', 0)} paying subscribers.",
        f"AI cost today: ${ai_cost.get('cost_today_usd', 0):.4f} "
        f"(all-time metered spend: ${ai_cost.get('total_cost_usd', 0):.2f}).",
        "",
        "You are the CEO of LitigaForge, a lawyer-client matching platform. Based only "
        "on the numbers above, identify at most 3 concrete, specific things worth the "
        "founder's attention right now (or say clearly if nothing looks urgent). No "
        "generic startup advice — only observations tied to these actual numbers.",
    ]
    return "Business Pulse", "\n".join(lines)
