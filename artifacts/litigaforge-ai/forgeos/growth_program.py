"""
ForgeOS Growth & Competitive Intelligence Program — a set of recurring
mission builders (same (title, description) | None contract as
business_pulse.build_pulse()) covering organic-traffic growth, technical SEO,
lawyer-onboarding trust/compliance, and competitive positioning against named
Indian legal marketplaces (LawRato, LegalKart, Lawyered, Jhana.ai, MyKase).

IMPORTANT SCOPE NOTE: ForgeOS agents only generate text via an LLM
(forgeos/orchestrator.py run_agent_task() has no code-execution, file-edit,
or deploy capability). Every mission below produces a draft / report / spec
for a human to review and act on — it does NOT autonomously ship code, verify
a lawyer's bar registration against a real government system (no such public
API exists), or publish to the live blog. Grounding data (competitor scrapes,
our own site's SEO self-check, live KPIs) is fetched for real wherever
possible so the LLM reasons over facts instead of hallucinating them — same
pattern as business_pulse.py.

Builders are wired into forgeos_schedules via seed.py's INITIAL_SCHEDULES and
dispatched generically by scheduler.py's BUILDERS registry.
"""
import asyncio
import json
import os
from datetime import datetime, timezone

import httpx

from database import fetch
from forgeos import dashboard, memory
from forgeos.orchestrator import _daily_cost_cap_exceeded
from logger import get_logger

logger = get_logger("litigaforge.forgeos.growth_program")

_MEMORY_NAMESPACE = "growth_program"
_PUBLIC_SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")

# Public homepages only — no login-gated pages, no scraping behind auth.
_COMPETITORS = {
    "LawRato": "https://lawrato.com/",
    "LegalKart": "https://www.legalkart.com/",
    "Lawyered": "https://lawyered.in/",
    "Jhana.ai": "https://www.jhana.ai/",
    "MyKase": "https://www.mykase.in/",
}

_SNAPSHOT_TTL_SECONDS = 20 * 3600  # ~20h — effectively "daily", read-driven refresh
_HTTP_TIMEOUT = httpx.Timeout(8.0, connect=5.0)
_MAX_BODY_BYTES = 200_000
_USER_AGENT = "LitigaForgeGrowthBot/1.0 (+https://litigaforge.com; competitive research, public pages only)"

_BLOG_TOPICS = [
    "Anticipatory bail procedure and recent High Court trends in Telangana/AP",
    "Property partition disputes under Hindu Succession Act — practical checklist",
    "Consumer protection remedies for defective goods/services in India",
    "Cheque bounce cases under Section 138 NI Act — defenses and timelines",
    "Divorce by mutual consent vs contested divorce in Telangana courts",
    "Tenant rights and eviction procedure under AP/Telangana rent laws",
    "GST notice replies and appeal process for small businesses",
    "RTI applications — drafting, appeals, and common rejection grounds",
    "Cyber fraud and online financial scam complaints — legal recourse in India",
    "Employment termination and labour court remedies for private-sector workers",
    "Domestic violence protection orders under the PWDVA — how filing works",
    "Motor accident compensation claims (MACT) — process and typical timelines",
    "Will drafting and succession certificate process in Telangana/AP",
    "Bail vs anticipatory bail vs regular bail — a plain-language explainer",
    "NRI property disputes — power of attorney and remote litigation basics",
]


def _http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=_HTTP_TIMEOUT, follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    )


async def _fetch_snippet(client: httpx.AsyncClient, url: str) -> dict:
    """Best-effort fetch of a single public page's title/meta-description,
    truncated to a body-size cap. Never raises — a blocked/slow competitor
    site (LawRato/LegalKart-style bot protection, Cloudflare challenges) just
    yields an 'unavailable this run' entry instead of failing the whole
    snapshot."""
    try:
        resp = await client.get(url)
        body = resp.text[:_MAX_BODY_BYTES]
        if resp.status_code >= 400:
            return {"url": url, "status": resp.status_code, "available": False}
        title = ""
        if "<title" in body.lower():
            start = body.lower().find("<title")
            start = body.find(">", start) + 1
            end = body.lower().find("</title>", start)
            if start > 0 and end > start:
                title = body[start:end].strip()[:200]
        meta_desc = ""
        lower_body = body.lower()
        idx = lower_body.find('name="description"')
        if idx == -1:
            idx = lower_body.find("name='description'")
        if idx != -1:
            content_idx = lower_body.find("content=", idx)
            if content_idx != -1:
                quote_char = body[content_idx + 8] if content_idx + 8 < len(body) else '"'
                if quote_char in ("'", '"'):
                    end_idx = body.find(quote_char, content_idx + 9)
                    meta_desc = body[content_idx + 9:end_idx][:300] if end_idx != -1 else ""
        return {
            "url": url, "status": resp.status_code, "available": True,
            "title": title, "meta_description": meta_desc,
        }
    except Exception as e:
        logger.info("growth_program: competitor fetch failed for %s: %s", url, e)
        return {"url": url, "available": False, "error": str(e)[:200]}


async def _scrape_competitors() -> dict:
    async with _http_client() as client:
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*[
                    _fetch_snippet(client, url) for url in _COMPETITORS.values()
                ], return_exceptions=True),
                timeout=20.0,
            )
        except asyncio.TimeoutError:
            logger.warning("growth_program: competitor scrape budget (20s) exceeded — partial results")
            results = [{"available": False, "error": "timed out"} for _ in _COMPETITORS]

    snapshot = {}
    for name, result in zip(_COMPETITORS.keys(), results):
        if isinstance(result, Exception):
            snapshot[name] = {"available": False, "error": str(result)[:200]}
        else:
            snapshot[name] = result
    return snapshot


async def get_competitor_snapshot(force_refresh: bool = False) -> dict:
    """TTL-cached (~20h) competitor snapshot in forgeos_memory, shared by
    Business Pulse and the competitor-watchlist/content-gap missions so we
    don't scrape the same 5 public sites on every consumer's own cadence."""
    cached = await memory.get_value(_MEMORY_NAMESPACE, "competitor_snapshot")
    if not force_refresh and cached:
        fetched_at = cached.get("fetched_at")
        if fetched_at:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(fetched_at)).total_seconds()
            if age < _SNAPSHOT_TTL_SECONDS:
                return cached

    fresh = await _scrape_competitors()
    fresh_wrapped = {"fetched_at": datetime.now(timezone.utc).isoformat(), "sites": fresh}

    if cached:
        await memory.set_value(_MEMORY_NAMESPACE, "competitor_snapshot_prev", cached)
    await memory.set_value(_MEMORY_NAMESPACE, "competitor_snapshot", fresh_wrapped)
    return fresh_wrapped


def _diff_snapshots(prev: dict | None, current: dict) -> list[str]:
    """Plain-language list of what changed since the last cached snapshot —
    used both by Business Pulse and the watchlist mission."""
    if not prev:
        return ["No prior snapshot to compare against yet (first run)."]
    changes = []
    prev_sites = prev.get("sites", {})
    curr_sites = current.get("sites", {})
    for name, curr_info in curr_sites.items():
        prev_info = prev_sites.get(name, {})
        if curr_info.get("available") and not prev_info.get("available"):
            changes.append(f"{name}: back online (was unreachable last check).")
        elif not curr_info.get("available") and prev_info.get("available"):
            changes.append(f"{name}: unreachable this check (was up before) — may be a bot-block, not necessarily downtime.")
        elif curr_info.get("available") and prev_info.get("available"):
            if curr_info.get("title") and curr_info.get("title") != prev_info.get("title"):
                changes.append(f"{name}: homepage title changed — possible repositioning. New: \"{curr_info['title']}\"")
            if curr_info.get("meta_description") and curr_info.get("meta_description") != prev_info.get("meta_description"):
                changes.append(f"{name}: meta description changed — possible messaging/SEO update.")
    if not changes:
        changes.append("No detected homepage title/description changes since the last snapshot.")
    return changes


async def _seo_self_check() -> dict:
    """Real (not hallucinated) checks against our own public site: sitemap
    reachability + URL count, robots.txt presence, and homepage
    meta/JSON-LD/latency. This is NOT a full Core Web Vitals field-data audit
    (that needs Google PageSpeed Insights/CrUX API access, not configured
    here) — the mission prompt says so explicitly rather than faking it."""
    checks = {}
    async with _http_client() as client:
        for path in ("/sitemap.xml", "/robots.txt"):
            url = f"{_PUBLIC_SITE_URL}{path}"
            try:
                resp = await client.get(url)
                body = resp.text[:_MAX_BODY_BYTES]
                checks[path] = {
                    "status": resp.status_code,
                    "ok": resp.status_code == 200,
                    "url_count": body.count("<loc>") if path == "/sitemap.xml" else None,
                    "bytes": len(resp.content),
                }
            except Exception as e:
                checks[path] = {"ok": False, "error": str(e)[:200]}

        for path in ("/", "/lawyers", "/ask"):
            url = f"{_PUBLIC_SITE_URL}{path}"
            try:
                start = datetime.now(timezone.utc)
                resp = await client.get(url)
                latency_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
                body = resp.text[:_MAX_BODY_BYTES]
                checks[path] = {
                    "status": resp.status_code,
                    "ok": resp.status_code == 200,
                    "latency_ms": round(latency_ms, 1),
                    "has_jsonld": 'application/ld+json' in body,
                    "has_meta_description": 'name="description"' in body.lower(),
                    "has_viewport_meta": 'name="viewport"' in body.lower(),
                }
            except Exception as e:
                checks[path] = {"ok": False, "error": str(e)[:200]}
    return checks


async def _next_topic(memory_key: str, topics: list[str]) -> str:
    """Rotates through `topics` using a persisted cursor in forgeos_memory —
    robust to mission titles changing, unlike scanning forgeos_missions."""
    state = await memory.get_value(_MEMORY_NAMESPACE, memory_key) or {"cursor": 0}
    cursor = state.get("cursor", 0) % len(topics)
    topic = topics[cursor]
    await memory.set_value(_MEMORY_NAMESPACE, memory_key, {"cursor": (cursor + 1) % len(topics)})
    return topic


async def _kpi_context_lines() -> list[str]:
    """A few live numbers to keep recurring design/strategy missions
    grounded in the current state of the business instead of feeling like a
    static repeated no-op each cycle."""
    revenue = await dashboard._revenue_summary()
    rows = await fetch(
        """SELECT
             (SELECT COUNT(*) FROM lawyers WHERE verification_status = 'pending') AS pending_verifications,
             (SELECT COUNT(*) FROM lawyers WHERE verified = TRUE) AS verified_lawyers,
             (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS signups_7d
        """
    )
    counts = dict(rows[0]) if rows else {}
    return [
        f"Current MRR: Rs {revenue.get('mrr_rupees', 0):,.0f} across {revenue.get('paid_subscribers', 0)} paying subscribers.",
        f"Verified lawyers on platform: {counts.get('verified_lawyers', 0)}; pending verification queue: {counts.get('pending_verifications', 0)}.",
        f"New signups in the last 7 days: {counts.get('signups_7d', 0)}.",
    ]


async def _guarded(fn):
    spent_today = await _daily_cost_cap_exceeded()
    if spent_today is not None:
        logger.info("growth_program: skipping %s — daily cost cap already reached ($%.4f)",
                    fn.__name__, spent_today)
        return None
    return await fn()


COMPETITOR_LIST_LABEL = "LawRato, LegalKart, Lawyered, Jhana.ai, and MyKase"


async def build_content_drafting() -> tuple[str, str] | None:
    async def _run():
        topic = await _next_topic("content_topic_cursor", _BLOG_TOPICS)
        lines = [
            f"Growth Program — Blog Content Brief ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            f"Topic for this cycle: {topic}",
            "",
            "This is a RECURRING weekly content mission, not a one-off. Produce a "
            "detailed, E-E-A-T-compliant brief for this topic: a working title, a "
            "structured outline (H2/H3s), at least one concrete original insight or "
            "case-law reference (not generic advice), the specific real-world "
            "questions an Indian reader would search, and drafted copy for the "
            "introduction and one key section. This feeds LitigaForge's existing "
            "automated blog pipeline (a separate system already publishing ~7 "
            "articles/day) as a brief a human editor can expand and schedule — it "
            "does not publish anything itself. Keep it grounded in real Indian law "
            "(Telangana/AP where relevant); no invented case citations.",
        ]
        return "Growth Program: Blog Content Brief", "\n".join(lines)
    return await _guarded(_run)


async def build_content_structure_review() -> tuple[str, str] | None:
    async def _run():
        kpis = await _kpi_context_lines()
        lines = [
            f"Growth Program — Content Structure vs AI Overview Review ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            "Current state:",
            *[f"- {line}" for line in kpis],
            "",
            "This is a RECURRING monthly review, not a one-off. Google's AI Overviews "
            "increasingly answer legal questions directly, cannibalizing clicks from "
            "informational content. Design/refine a content structure playbook for "
            "LitigaForge's legal articles and /ask answers that maximizes the chance "
            "of (a) being the cited/linked source inside an AI Overview and (b) still "
            "earning a click when it isn't: clear extractable definitions near the "
            "top, structured Q&A blocks, original data/case-analysis AI Overviews "
            "can't synthesize, and a strong reason to click through (personalized "
            "next step, tools, or verified-lawyer contact). Give 5 concrete, "
            "actionable structural rules, not generic SEO advice.",
        ]
        return "Growth Program: Content Structure vs AI Overview", "\n".join(lines)
    return await _guarded(_run)


async def build_seo_technical_audit() -> tuple[str, str] | None:
    async def _run():
        checks = await _seo_self_check()
        lines = [
            f"Growth Program — Technical SEO & Core Web Vitals Audit ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            "Live self-check results just fetched against the production site "
            f"({_PUBLIC_SITE_URL}):",
            json.dumps(checks, indent=2, default=str),
            "",
            "NOTE: this covers sitemap/robots reachability, meta/JSON-LD presence, "
            "and page response latency only — it is NOT a full Core Web Vitals field "
            "audit (LCP/INP/CLS from real users needs Google PageSpeed Insights/CrUX "
            "API access, which isn't configured). Flag that gap explicitly.",
            "",
            "This is a RECURRING weekly audit, not a one-off. Based on the checks "
            "above, list every concrete issue found (missing schema, slow page, "
            "missing meta description, etc.), prioritize by likely SEO/CWV impact, "
            "and write a specific, actionable fix for each — precise enough that a "
            "backend engineer could implement it directly. You cannot make code "
            "changes yourself; this report is the deliverable.",
        ]
        return "Growth Program: Technical SEO & CWV Audit", "\n".join(lines)
    return await _guarded(_run)


async def build_onboarding_flow_design() -> tuple[str, str] | None:
    async def _run():
        kpis = await _kpi_context_lines()
        lines = [
            f"Growth Program — Advocate Onboarding Flow Design ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            "Current state:",
            *[f"- {line}" for line in kpis],
            "",
            "This is a RECURRING monthly design review, not a one-off. Design (or "
            "refine, if a prior version exists) a credential-verification-first "
            "onboarding flow for advocates that leads with trust and compliance: "
            "what's collected (bar registration number, enrollment certificate, "
            "practice area proof), the verification sequence and states (submitted "
            "-> under review -> verified/rejected), what a lawyer sees while pending, "
            "and how to keep the pending-verification queue from becoming a growth "
            "bottleneck given the current queue size above. Output a concrete step-by"
            "-step flow plus the UI states needed, not abstract principles.",
        ]
        return "Growth Program: Advocate Onboarding Flow Design", "\n".join(lines)
    return await _guarded(_run)


async def build_bar_verification_api_design() -> tuple[str, str] | None:
    async def _run():
        kpis = await _kpi_context_lines()
        lines = [
            f"Growth Program — Bar Registration Verification API Design ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            "Current state:",
            *[f"- {line}" for line in kpis],
            "",
            "IMPORTANT CONSTRAINT: there is no public Bar Council of India API for "
            "live registration lookups, and no such credential is configured here. "
            "Do not assume one exists.",
            "",
            "This is a RECURRING design review (every 2 weeks), not a one-off build. "
            "Produce/refine a technical design for a bar-registration verification "
            "step in advocate onboarding given that constraint: what fields to "
            "capture (bar council, enrollment number, state, certificate upload), a "
            "realistic verification workflow given no live official API (e.g. "
            "document upload + manual admin review queue, with format/checksum "
            "validation of the enrollment number where a pattern exists, and a clear "
            "audit trail), and what would change if/when an official verification "
            "API became available later. Output a concrete endpoint/data-model "
            "sketch a backend engineer could implement directly.",
        ]
        return "Growth Program: Bar Verification API Design", "\n".join(lines)
    return await _guarded(_run)


async def build_competitor_watchlist() -> tuple[str, str] | None:
    async def _run():
        current = await get_competitor_snapshot()
        prev = await memory.get_value(_MEMORY_NAMESPACE, "competitor_snapshot_prev")
        changes = _diff_snapshots(prev, current)
        lines = [
            f"Growth Program — Competitor Watchlist ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            f"Tracking (public info only): {COMPETITOR_LIST_LABEL}.",
            "",
            "Live snapshot just fetched from each competitor's public homepage:",
            json.dumps(current.get("sites", {}), indent=2, default=str),
            "",
            "Changes since the last snapshot:",
            *[f"- {c}" for c in changes],
            "",
            "This is a RECURRING weekly watchlist, not a one-off. Using only the "
            "public information above (never invent pricing/features you can't see "
            "here), update LitigaForge's competitive positioning notes: what each "
            "competitor appears to be emphasizing right now, any notable "
            "positioning/messaging shift, and one specific thing LitigaForge should "
            "watch or respond to this cycle. If a site is unreachable, say so rather "
            "than guessing why.",
        ]
        return "Growth Program: Competitor Watchlist", "\n".join(lines)
    return await _guarded(_run)


async def build_content_gap_analysis() -> tuple[str, str] | None:
    async def _run():
        current = await get_competitor_snapshot()
        topic = await _next_topic("content_gap_topic_cursor", _BLOG_TOPICS)
        lines = [
            f"Growth Program — Competitor Content-Gap Analysis ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            f"Competitors tracked (public info only): {COMPETITOR_LIST_LABEL}.",
            "Latest homepage snapshot for context (titles/meta only — full content "
            "audits of competitor blogs are out of scope for an automated public "
            "scrape):",
            json.dumps(current.get("sites", {}), indent=2, default=str),
            "",
            f"This cycle's focus topic area: {topic}",
            "",
            "This is a RECURRING content-gap analysis (every 2 weeks), not a "
            "one-off. Based on general knowledge of what these Indian legal "
            "marketplaces typically publish (directories, generic explainers) "
            "versus what LitigaForge could credibly publish with deeper legal "
            "rigor, identify 5 specific, high-search-intent Indian legal topics "
            "in or near the focus area above that are likely under-served by "
            "competitor content, and explain briefly why each is a realistic SEO "
            "opportunity. Be specific (exact topic/question), not generic ('write "
            "more content').",
        ]
        return "Growth Program: Competitor Content-Gap Analysis", "\n".join(lines)
    return await _guarded(_run)


async def build_launch_plan() -> tuple[str, str] | None:
    async def _run():
        kpis = await _kpi_context_lines()
        lines = [
            f"Growth Program — Multi-Channel Launch Plan ({datetime.now(timezone.utc).strftime('%d %b %Y')})",
            "",
            "Current state:",
            *[f"- {line}" for line in kpis],
            "",
            f"Competitive context: {COMPETITOR_LIST_LABEL} are the main comparable "
            "Indian legal marketplaces.",
            "",
            "This is a RECURRING monthly refresh, not a one-off. Draft/refine a "
            "multi-channel launch and growth plan for LitigaForge covering: (1) "
            "social — concrete LinkedIn/X/Instagram content angles and cadence for "
            "reaching both clients and advocates, (2) email/lifecycle sequences — "
            "specific sequences for new advocate signups (onboarding to first case) "
            "and new client signups (first case post to first match), and (3) PR/"
            "backlink pitch angles for Indian legal press/publications. Be concrete: "
            "each item needs a specific angle/subject line/pitch, not a category "
            "label.",
        ]
        return "Growth Program: Multi-Channel Launch Plan", "\n".join(lines)
    return await _guarded(_run)


BUILDERS = {
    "growth_content_drafting": build_content_drafting,
    "growth_content_structure": build_content_structure_review,
    "growth_seo_audit": build_seo_technical_audit,
    "growth_onboarding_flow": build_onboarding_flow_design,
    "growth_bar_verification": build_bar_verification_api_design,
    "growth_competitor_watchlist": build_competitor_watchlist,
    "growth_content_gap": build_content_gap_analysis,
    "growth_launch_plan": build_launch_plan,
}
