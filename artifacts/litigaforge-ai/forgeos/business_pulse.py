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
from forgeos.config import (
    FORGEOS_GOAL_MONTHLY_SIGNUPS,
    FORGEOS_GOAL_MRR_RUPEES,
    FORGEOS_GOAL_VERIFIED_LAWYERS,
)
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


async def _week_over_week() -> dict:
    """Signups/cases/matches this week (last 7 days) vs the 7 days before
    that — real deltas, no invented trendlines."""
    rows = await fetch(
        """SELECT
             (SELECT COUNT(*) FROM users
                WHERE created_at >= NOW() - INTERVAL '7 days') AS signups_this_week,
             (SELECT COUNT(*) FROM users
                WHERE created_at >= NOW() - INTERVAL '14 days'
                AND created_at < NOW() - INTERVAL '7 days') AS signups_last_week,
             (SELECT COUNT(*) FROM case_requirements
                WHERE created_at >= NOW() - INTERVAL '7 days') AS cases_this_week,
             (SELECT COUNT(*) FROM case_requirements
                WHERE created_at >= NOW() - INTERVAL '14 days'
                AND created_at < NOW() - INTERVAL '7 days') AS cases_last_week,
             (SELECT COUNT(*) FROM matches
                WHERE created_at >= NOW() - INTERVAL '7 days') AS matches_this_week,
             (SELECT COUNT(*) FROM matches
                WHERE created_at >= NOW() - INTERVAL '14 days'
                AND created_at < NOW() - INTERVAL '7 days') AS matches_last_week,
             (SELECT COUNT(*) FROM lawyers WHERE verified = TRUE) AS verified_lawyers,
             (SELECT COUNT(*) FROM users
                WHERE created_at >= date_trunc('month', NOW())) AS signups_this_month
        """
    )
    return dict(rows[0]) if rows else {}


def _pct_change(this: int, last: int) -> str:
    if last == 0:
        return "n/a (no prior-week baseline)" if this == 0 else "new this week (0 last week)"
    pct = ((this - last) / last) * 100
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.0f}%"


async def _progress_section_lines() -> list[str]:
    wow = await _week_over_week()
    revenue = await dashboard._revenue_summary()
    lines = [
        "",
        "Week-over-week (last 7 days vs the 7 before that):",
        f"- Signups: {wow.get('signups_this_week', 0)} vs {wow.get('signups_last_week', 0)} "
        f"({_pct_change(wow.get('signups_this_week', 0), wow.get('signups_last_week', 0))})",
        f"- Case postings: {wow.get('cases_this_week', 0)} vs {wow.get('cases_last_week', 0)} "
        f"({_pct_change(wow.get('cases_this_week', 0), wow.get('cases_last_week', 0))})",
        f"- Matches created: {wow.get('matches_this_week', 0)} vs {wow.get('matches_last_week', 0)} "
        f"({_pct_change(wow.get('matches_this_week', 0), wow.get('matches_last_week', 0))})",
    ]
    goal_lines = []
    if FORGEOS_GOAL_MONTHLY_SIGNUPS > 0:
        pct = min(100, (wow.get("signups_this_month", 0) / FORGEOS_GOAL_MONTHLY_SIGNUPS) * 100)
        goal_lines.append(f"- Monthly signups goal: {wow.get('signups_this_month', 0)}/{FORGEOS_GOAL_MONTHLY_SIGNUPS} ({pct:.0f}%)")
    if FORGEOS_GOAL_MRR_RUPEES > 0:
        pct = min(100, (revenue.get("mrr_rupees", 0) / FORGEOS_GOAL_MRR_RUPEES) * 100)
        goal_lines.append(f"- MRR goal: Rs {revenue.get('mrr_rupees', 0):,.0f}/Rs {FORGEOS_GOAL_MRR_RUPEES:,.0f} ({pct:.0f}%)")
    if FORGEOS_GOAL_VERIFIED_LAWYERS > 0:
        pct = min(100, (wow.get("verified_lawyers", 0) / FORGEOS_GOAL_VERIFIED_LAWYERS) * 100)
        goal_lines.append(f"- Verified lawyers goal: {wow.get('verified_lawyers', 0)}/{FORGEOS_GOAL_VERIFIED_LAWYERS} ({pct:.0f}%)")
    if goal_lines:
        lines.append("")
        lines.append("Progress vs configured goals:")
        lines.extend(goal_lines)
    return lines


async def _competitor_section_lines() -> list[str]:
    """Best-effort — competitor scraping/caching lives in growth_program.py
    and is deliberately imported lazily here so a business_pulse run never
    fails just because the growth-program cache/scrape had a bad day."""
    try:
        from forgeos import growth_program, memory
        current = await growth_program.get_competitor_snapshot()
        prev = await memory.get_value("growth_program", "competitor_snapshot_prev")
        changes = growth_program._diff_snapshots(prev, current)
        lines = ["", "Competitor signals (public homepages only — LawRato, LegalKart, Lawyered, Jhana.ai, MyKase):"]
        lines.extend(f"- {c}" for c in changes[:3])
        return lines
    except Exception as e:
        logger.info("business_pulse: competitor section unavailable this run: %s", e)
        return []


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
    ]
    lines.extend(await _progress_section_lines())
    lines.extend(await _competitor_section_lines())
    lines.extend([
        "",
        "You are the CEO of LitigaForge, a lawyer-client matching platform. Based only "
        "on the numbers above (today's stats, week-over-week trend, any goal progress, "
        "and any competitor signals), identify at most 3 concrete, specific things worth "
        "the founder's attention right now (or say clearly if nothing looks urgent). No "
        "generic startup advice — only observations tied to these actual numbers.",
    ])
    return "Business Pulse", "\n".join(lines)
