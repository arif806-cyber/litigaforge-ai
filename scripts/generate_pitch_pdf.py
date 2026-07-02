#!/usr/bin/env python3
"""Generate LitigaForge AI pitch deck PDF — Hub71 / Abu Dhabi focus."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import os

W, H = A4  # 595.27 x 841.89 pts

# ── Brand palette ────────────────────────────────────────────────────────────
BG       = HexColor("#0A0B10")
SURFACE  = HexColor("#14151F")
AMBER    = HexColor("#F5B754")
EMERALD  = HexColor("#34D399")
VIOLET   = HexColor("#8B5CF6")
BLUE     = HexColor("#3B82F6")
SLATE    = HexColor("#1E293B")
MUTED    = HexColor("#64748B")
LIGHT    = HexColor("#E2E8F0")
HUB71    = HexColor("#0041CC")  # Hub71 blue

OUT_PATH = "litigaforge_hub71_pitchdeck.pdf"

# ── Helper drawing functions ─────────────────────────────────────────────────

def set_bg(c, color=None):
    c.setFillColor(color or BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def accent_bar(c, color=AMBER, x=0, y=H-6, w=W, h=6):
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)

def card(c, x, y, w, h, color=SURFACE, radius=6):
    c.setFillColor(color)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=0)

def label(c, text, x, y, size=9, color=MUTED, align="left", bold=False):
    c.setFillColor(color)
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font, size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

def title(c, text, x, y, size=28, color=white, align="left"):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

def subtitle(c, text, x, y, size=13, color=LIGHT):
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    c.drawString(x, y, text)

def wrap_text(c, text, x, y, max_width, size=10, color=LIGHT, line_height=16, bold=False):
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line = ""
    cy = y
    for word in words:
        test = (line + " " + word).strip()
        if c.stringWidth(test, font, size) <= max_width:
            line = test
        else:
            if line:
                c.drawString(x, cy, line)
                cy -= line_height
            line = word
    if line:
        c.drawString(x, cy, line)
    return cy

def bullet(c, items, x, y, max_width=380, size=10, color=LIGHT, dot_color=AMBER, line_height=18):
    for item in items:
        c.setFillColor(dot_color)
        c.circle(x + 4, y + 3, 2.5, fill=1, stroke=0)
        c.setFont("Helvetica", size)
        c.setFillColor(color)
        # wrap long bullets
        words = item.split()
        line = ""
        first = True
        cy = y
        for word in words:
            test = (line + " " + word).strip()
            if c.stringWidth(test, "Helvetica", size) <= max_width:
                line = test
            else:
                if line:
                    draw_x = x + 14 if first else x + 14
                    c.drawString(draw_x, cy, line)
                    cy -= line_height - 4
                    first = False
                line = word
        if line:
            c.drawString(x + 14, cy, line)
        y = cy - line_height
    return y

def page_footer(c, page_num, total=12):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(20*mm, 8*mm, "LitigaForge AI — Confidential | litigaforge.com")
    c.drawRightString(W - 20*mm, 8*mm, f"Slide {page_num} / {total}")
    # thin separator line
    c.setStrokeColor(MUTED)
    c.setLineWidth(0.5)
    c.line(20*mm, 12*mm, W - 20*mm, 12*mm)

def stat_card(c, x, y, w, h, value, label_text, color=AMBER):
    card(c, x, y, w, h, SURFACE)
    # left accent strip
    c.setFillColor(color)
    c.rect(x, y, 4, h, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(color)
    c.drawCentredString(x + w/2, y + h - 32, value)
    c.setFont("Helvetica", 8)
    c.setFillColor(LIGHT)
    c.drawCentredString(x + w/2, y + 10, label_text)

# ── SLIDE GENERATORS ─────────────────────────────────────────────────────────

def slide_cover(c):
    set_bg(c)
    # large gradient-like decorative circle top-right
    c.setFillColor(HexColor("#1a1040"))
    c.circle(W, H, 220, fill=1, stroke=0)
    c.setFillColor(HexColor("#0d0829"))
    c.circle(W - 30, H + 10, 150, fill=1, stroke=0)

    accent_bar(c, AMBER)

    # Hub71 badge
    card(c, 20*mm, H - 38*mm, 55*mm, 14*mm, HUB71, 4)
    label(c, "HUB71 APPLICATION DECK", 20*mm + 3*mm, H - 38*mm + 4*mm, 8.5, white, bold=True)

    # Main title
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 42)
    c.drawString(20*mm, H - 60*mm, "LitigaForge AI")

    c.setFillColor(VIOLET)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20*mm, H - 72*mm, "AI-Powered Legal Platform for MENA & Global Markets")

    # Tagline
    c.setFillColor(LIGHT)
    c.setFont("Helvetica", 13)
    c.drawString(20*mm, H - 84*mm, "Connecting people to legal help through AI — faster, smarter, fairer.")

    # Divider
    c.setStrokeColor(AMBER)
    c.setLineWidth(1.5)
    c.line(20*mm, H - 90*mm, 80*mm, H - 90*mm)

    # Key metrics row
    metrics = [
        ("8", "Markets Live"),
        ("3", "Languages"),
        ("₹2,499", "Pro Plan / mo"),
        ("∞", "AI Queries"),
    ]
    mx = 20*mm
    for val, lbl in metrics:
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(AMBER)
        c.drawString(mx, H - 105*mm, val)
        c.setFont("Helvetica", 8)
        c.setFillColor(MUTED)
        c.drawString(mx, H - 112*mm, lbl)
        mx += 38*mm

    # Website
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20*mm, H - 125*mm, "litigaforge.com")

    # Bottom presentation note
    label(c, "Prepared for Hub71 — Abu Dhabi, UAE", 20*mm, 28*mm, 9, MUTED)
    label(c, "Sector: Artificial Intelligence · LegalTech", 20*mm, 20*mm, 9, MUTED)

    page_footer(c, 1)
    c.showPage()


def slide_problem(c):
    set_bg(c)
    accent_bar(c, AMBER)

    label(c, "THE PROBLEM", 20*mm, H - 22*mm, 9, AMBER, bold=True)
    title(c, "Legal Access is Broken\nfor 5 Billion People", 20*mm, H - 42*mm, 26)

    # Three pain cards
    pains = [
        (AMBER,  "80%",  "of people cannot afford\na qualified lawyer"),
        (VIOLET, "2.5B", "people face at least one\nlegal problem per year"),
        (EMERALD,"$1T+", "addressable legal services\nmarket globally"),
    ]
    cx = 20*mm
    for color, stat, desc in pains:
        card(c, cx, H - 120*mm, 53*mm, 65*mm, SURFACE)
        c.setFillColor(color)
        c.rect(cx, H - 120*mm, 53*mm, 4, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(color)
        c.drawCentredString(cx + 26.5*mm, H - 75*mm, stat)
        c.setFont("Helvetica", 9)
        c.setFillColor(LIGHT)
        for i, line in enumerate(desc.split("\n")):
            c.drawCentredString(cx + 26.5*mm, H - 88*mm - i*13, line)
        cx += 57*mm

    # Abu Dhabi specific
    card(c, 20*mm, H - 165*mm, W - 40*mm, 38*mm, HexColor("#0d1930"))
    c.setFillColor(HUB71)
    c.rect(20*mm, H - 165*mm, 4, 38*mm, fill=1, stroke=0)
    label(c, "ABU DHABI / UAE CONTEXT", 28*mm, H - 132*mm, 8, AMBER, bold=True)
    bullet(c, [
        "UAE has 3M+ expatriates (Indians, Pakistanis, Filipinos) navigating unfamiliar legal systems daily",
        "Arabic-first courts create a language barrier for 88% of the expat population",
        "Average lawyer consultation in Abu Dhabi: AED 1,000–3,000/hr — unaffordable for most",
        "ADGM and DIFC courts handle complex cross-border commercial disputes with limited AI tooling",
    ], 28*mm, H - 144*mm, W - 56*mm, 9, LIGHT, HUB71, 15)

    page_footer(c, 2)
    c.showPage()


def slide_solution(c):
    set_bg(c)
    accent_bar(c, VIOLET)

    label(c, "OUR SOLUTION", 20*mm, H - 22*mm, 9, VIOLET, bold=True)
    title(c, "LitigaForge AI", 20*mm, H - 40*mm, 30, AMBER)
    subtitle(c, "One platform. Every legal need. Any country.", 20*mm, H - 55*mm, 13)

    features = [
        (AMBER,   "AI Lawyer Matching",    "Post a case → AI scores lawyers 0–100 by fit, experience & speciality"),
        (VIOLET,  "Legal Q&A (AI Answers)","Instant, jurisdiction-aware answers in English, Hindi, Arabic (coming)"),
        (EMERALD, "Document Analyzer",     "AI risk scoring, missing-clause detection, plain-language summary"),
        (BLUE,    "Judgment Finder",       "Search case law from UAE, India, UK, US courts — AI-summarised"),
        (AMBER,   "Case Management",       "CNR tracking, hearing dates, document vault for advocates"),
        (VIOLET,  "Free Legal Aid Finder", "Eligibility wizard + contacts for NALSA, DIFC Pro Bono, ADGM"),
    ]

    col1 = features[:3]
    col2 = features[3:]
    for col, bx in [(col1, 20*mm), (col2, 105*mm)]:
        by = H - 80*mm
        for color, feat, desc in col:
            card(c, bx, by - 42*mm, 80*mm, 38*mm, SURFACE)
            c.setFillColor(color)
            c.circle(bx + 6*mm, by - 26*mm, 4, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(color)
            c.drawString(bx + 12*mm, by - 28*mm, feat)
            c.setFont("Helvetica", 8.5)
            c.setFillColor(LIGHT)
            wrap_text(c, desc, bx + 4*mm, by - 38*mm, 72*mm, 8.5, LIGHT, 13)
            by -= 46*mm

    page_footer(c, 3)
    c.showPage()


def slide_market(c):
    set_bg(c)
    accent_bar(c, EMERALD)

    label(c, "MARKET OPPORTUNITY", 20*mm, H - 22*mm, 9, EMERALD, bold=True)
    title(c, "Massive, Underserved,\nGlobal Market", 20*mm, H - 42*mm, 26)

    # TAM SAM SOM
    markets = [
        (EMERALD, "TAM", "$1 Trillion",  "Global legal services\nmarket (2024)"),
        (AMBER,   "SAM", "$85 Billion",  "AI-addressable legal\ntechnology segment"),
        (VIOLET,  "SOM", "$2.4 Billion", "MENA + South Asia\ndigital legal platforms"),
    ]
    cx = 20*mm
    for color, tier, val, desc in markets:
        card(c, cx, H - 120*mm, 53*mm, 68*mm, SURFACE)
        c.setFillColor(color)
        c.circle(cx + 26.5*mm, H - 80*mm, 18, fill=1, stroke=0)
        c.setFillColor(BG)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(cx + 26.5*mm, H - 83*mm, tier)
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(color)
        c.drawCentredString(cx + 26.5*mm, H - 98*mm, val)
        c.setFont("Helvetica", 8)
        c.setFillColor(LIGHT)
        for i, line in enumerate(desc.split("\n")):
            c.drawCentredString(cx + 26.5*mm, H - 110*mm - i*11, line)
        cx += 57*mm

    # UAE specific market data
    card(c, 20*mm, H - 170*mm, W - 40*mm, 42*mm, HexColor("#0a1a0a"))
    c.setFillColor(EMERALD)
    c.rect(20*mm, H - 170*mm, 4, 42*mm, fill=1, stroke=0)
    label(c, "UAE / ABU DHABI MARKET", 28*mm, H - 133*mm, 8, EMERALD, bold=True)

    uae_stats = [
        ("9.5M",   "UAE population (88% expats)"),
        ("AED 28B","UAE legal services market"),
        ("340+",   "Law firms in Abu Dhabi"),
        ("ADGM",   "World's fastest-growing financial free zone — needs AI legal tools"),
    ]
    sx = 28*mm
    for val, desc in uae_stats:
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(EMERALD)
        c.drawString(sx, H - 148*mm, val)
        c.setFont("Helvetica", 8)
        c.setFillColor(LIGHT)
        c.drawString(sx, H - 158*mm, desc)
        sx += 43*mm

    page_footer(c, 4)
    c.showPage()


def slide_business_model(c):
    set_bg(c)
    accent_bar(c, BLUE)

    label(c, "BUSINESS MODEL", 20*mm, H - 22*mm, 9, BLUE, bold=True)
    title(c, "Freemium SaaS + Marketplace", 20*mm, H - 40*mm, 26)

    # Subscription tiers
    tiers = [
        (MUTED,   "FREE",          "AED 0 / mo",   ["5 AI queries / month", "Legal Q&A", "Judgment search", "Lawyer directory"]),
        (BLUE,    "PROFESSIONAL",  "AED 135 / mo",  ["Unlimited AI queries", "Priority matching", "Document uploads", "Case tracking"]),
        (AMBER,   "ADVOCATE PRO",  "AED 335 / mo",  ["Full practice mgmt", "Client case dashboard", "CNR integration", "Analytics"]),
    ]
    tx = 18*mm
    for color, name, price, features in tiers:
        bh = 130
        by = H - 185*mm
        card(c, tx, by, 52*mm, bh, SURFACE)
        c.setFillColor(color)
        c.rect(tx, by + bh - 4, 52*mm, 4, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(color)
        c.drawCentredString(tx + 26*mm, by + bh - 18, name)
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(white)
        c.drawCentredString(tx + 26*mm, by + bh - 36, price)
        fy = by + bh - 52
        for f in features:
            c.setFillColor(color)
            c.circle(tx + 8*mm, fy + 3, 2, fill=1, stroke=0)
            c.setFont("Helvetica", 8)
            c.setFillColor(LIGHT)
            c.drawString(tx + 11*mm, fy, f)
            fy -= 14
        tx += 56*mm

    # Revenue streams
    label(c, "ADDITIONAL REVENUE STREAMS", 20*mm, H - 202*mm, 8, BLUE, bold=True)
    streams = [
        ("Lawyer Listing Fees", "AED 500–2,000/mo premium placement"),
        ("Document Credits", "Pay-per-use AI document generation"),
        ("B2G Contracts", "Government legal aid digitisation (ADGM, Ministry of Justice)"),
        ("API Licensing", "White-label AI for UAE law firms & insurers"),
    ]
    sx = 20*mm
    for name, desc in streams:
        card(c, sx, H - 235*mm, 70*mm, 28*mm, SLATE)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(BLUE)
        c.drawString(sx + 3*mm, H - 215*mm, name)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(LIGHT)
        wrap_text(c, desc, sx + 3*mm, H - 224*mm, 63*mm, 7.5, LIGHT, 11)
        sx += 74*mm

    page_footer(c, 5)
    c.showPage()


def slide_traction(c):
    set_bg(c)
    accent_bar(c, AMBER)

    label(c, "TRACTION & PRODUCT MILESTONES", 20*mm, H - 22*mm, 9, AMBER, bold=True)
    title(c, "Built, Deployed, Live Today", 20*mm, H - 40*mm, 26)

    # Metric cards
    stats = [
        (AMBER,   "LIVE",   "Product status\nlitigaforge.com"),
        (VIOLET,  "8",      "Countries\nsupported"),
        (EMERALD, "3",      "Languages\n(EN/HI/TE)"),
        (BLUE,    "10+",    "AI-generated\nlegal templates"),
    ]
    sx = 20*mm
    for color, val, lbl in stats:
        stat_card(c, sx, H - 105*mm, 39*mm, 55*mm, val, lbl.replace("\n"," · "), color)
        sx += 43*mm

    # Milestone timeline
    label(c, "PRODUCT MILESTONES", 20*mm, H - 120*mm, 8, AMBER, bold=True)
    milestones = [
        (EMERALD, "✓", "AI Lawyer Matching (0–100 score, Claude Sonnet + Gemini 2.5 Flash)"),
        (EMERALD, "✓", "Legal Q&A with jurisdiction-aware AI answers (India, UAE, UK, US, more)"),
        (EMERALD, "✓", "Document Analyzer — risk scoring, missing clauses, recommendations"),
        (EMERALD, "✓", "eCourts India API integration — live CNR case tracking"),
        (EMERALD, "✓", "Razorpay payments live — Free / Pro / Advocate tiers"),
        (EMERALD, "✓", "PWA — installable on Android & iOS without app store"),
        (EMERALD, "✓", "IndianKanoon judgment search integration"),
        (AMBER,   "→", "Arabic language support — Q4 2025"),
        (AMBER,   "→", "UAE / ADGM court integration — Q1 2026"),
        (VIOLET,  "◎", "MENA lawyer network — 500 verified advocates — Q2 2026"),
    ]
    my = H - 132*mm
    for color, mark, text in milestones:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(color)
        c.drawString(20*mm, my, mark)
        c.setFont("Helvetica", 9)
        c.setFillColor(LIGHT if mark == "✓" else AMBER if mark == "→" else VIOLET)
        c.drawString(27*mm, my, text)
        my -= 14

    page_footer(c, 6)
    c.showPage()


def slide_competition(c):
    set_bg(c)
    accent_bar(c, VIOLET)

    label(c, "COMPETITIVE LANDSCAPE", 20*mm, H - 22*mm, 9, VIOLET, bold=True)
    title(c, "We Win on AI Depth +\nLocal Jurisdiction Focus", 20*mm, H - 42*mm, 24)

    # Comparison table
    headers = ["Feature", "LitigaForge AI", "Harvey AI", "LexisNexis", "Local Firms"]
    col_w   = [52*mm, 46*mm, 36*mm, 36*mm, 36*mm]
    row_h   = 18
    tx      = 12*mm
    ty      = H - 65*mm

    # Header row
    card(c, tx, ty - row_h, W - 24*mm, row_h, VIOLET)
    cx = tx
    for i, h in enumerate(headers):
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(white)
        c.drawString(cx + 2*mm, ty - row_h + 5, h)
        cx += col_w[i]

    rows = [
        ("Multi-jurisdiction AI",          "✓ 8 countries",   "US only",     "✓ global",    "✗"),
        ("Lawyer matching (AI scored)",     "✓ 0–100 score",   "✗",           "✗",           "Manual"),
        ("Document analyzer",               "✓ AI risk score", "✓ enterprise","✓ basic",     "✗"),
        ("Judgment search",                 "✓ AI summary",    "✓",           "✓",           "✗"),
        ("Pricing (MENA accessible)",       "AED 0–335/mo",    "$500+/mo",    "$300+/mo",    "AED 1K+/hr"),
        ("MENA / Arabic support",           "✓ (roadmap Q4)", "✗",           "Limited",     "✗"),
        ("Free legal aid finder",           "✓ built-in",     "✗",           "✗",           "✗"),
        ("Mobile PWA (no app store)",       "✓",               "✗",           "✗",           "✗"),
    ]

    for ri, row in enumerate(rows):
        bg = BG if ri % 2 == 0 else SURFACE
        card(c, tx, ty - row_h * (ri + 2), W - 24*mm, row_h, bg)
        cx = tx
        for ci, cell in enumerate(row):
            color = EMERALD if "✓" in cell else (HexColor("#EF4444") if "✗" == cell.strip() else LIGHT)
            c.setFont("Helvetica-Bold" if ci == 0 else "Helvetica", 7.5)
            c.setFillColor(color if ci > 0 else LIGHT)
            c.drawString(cx + 2*mm, ty - row_h * (ri + 2) + 5, cell)
            cx += col_w[ci]

    # Moat
    card(c, 12*mm, H - 240*mm, W - 24*mm, 30*mm, HexColor("#0d0520"))
    c.setFillColor(VIOLET)
    c.rect(12*mm, H - 240*mm, 4, 30*mm, fill=1, stroke=0)
    label(c, "OUR MOAT", 20*mm, H - 218*mm, 8, VIOLET, bold=True)
    label(c, "Local jurisdiction depth (Indian courts, UAE law, NALSA) + multi-AI cascade (Claude+Gemini+GPT) at consumer pricing. Harvey targets BigLaw ($500+/mo). We own the 99%.", 20*mm, H - 229*mm, 8, LIGHT)

    page_footer(c, 7)
    c.showPage()


def slide_team(c):
    set_bg(c)
    accent_bar(c, EMERALD)

    label(c, "FOUNDING TEAM", 20*mm, H - 22*mm, 9, EMERALD, bold=True)
    title(c, "Built by Practitioners,\nNot Just Engineers", 20*mm, H - 42*mm, 26)

    # Founder card
    card(c, 20*mm, H - 120*mm, W - 40*mm, 65*mm, SURFACE)
    c.setFillColor(EMERALD)
    c.circle(38*mm, H - 82*mm, 18, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(BG)
    c.drawCentredString(38*mm, H - 85*mm, "AR")

    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(EMERALD)
    c.drawString(62*mm, H - 68*mm, "Arif — Founder & CEO")
    c.setFont("Helvetica", 10)
    c.setFillColor(LIGHT)
    c.drawString(62*mm, H - 80*mm, "Full-stack AI engineer · Legal domain expertise")
    c.drawString(62*mm, H - 92*mm, "Built entire LitigaForge stack solo — FastAPI, React, LangGraph, LiteLLM")
    c.drawString(62*mm, H - 104*mm, "Deep knowledge of Indian courts, Telangana/AP jurisdiction, NALSA")

    # Advisors needed
    label(c, "ADVISORY BOARD — SEEKING VIA HUB71", 20*mm, H - 135*mm, 8, AMBER, bold=True)
    advisors = [
        (AMBER,  "UAE Legal Expert",     "Licensed ADGM / UAE advocate for regulatory guidance"),
        (VIOLET, "MENA AI Investor",     "Series A experience in Gulf legaltech / fintech"),
        (BLUE,   "BD / Partnerships",    "UAE Ministry of Justice / ADGM connections"),
        (EMERALD,"CTO / ML Advisor",     "LLM fine-tuning, Arabic NLP, multilingual legal AI"),
    ]
    ax = 20*mm
    for color, role, desc in advisors:
        card(c, ax, H - 175*mm, 68*mm, 34*mm, SLATE)
        c.setFillColor(color)
        c.rect(ax, H - 175*mm, 3, 34*mm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(color)
        c.drawString(ax + 6*mm, H - 151*mm, role)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(LIGHT)
        wrap_text(c, desc, ax + 6*mm, H - 162*mm, 58*mm, 7.5, LIGHT, 11)
        ax += 72*mm

    page_footer(c, 8)
    c.showPage()


def slide_fundraising(c):
    set_bg(c)
    accent_bar(c, AMBER)

    label(c, "FUNDRAISING", 20*mm, H - 22*mm, 9, AMBER, bold=True)
    title(c, "Raising $500K Seed Round", 20*mm, H - 40*mm, 28, AMBER)
    subtitle(c, "To build the legal AI layer for MENA and South Asia", 20*mm, H - 55*mm, 12)

    # Previous
    card(c, 20*mm, H - 115*mm, 75*mm, 50*mm, SURFACE)
    c.setFillColor(MUTED)
    c.rect(20*mm, H - 115*mm, 75*mm, 4, fill=1, stroke=0)
    label(c, "PREVIOUS FUNDING", 24*mm, H - 76*mm, 8, MUTED, bold=True)
    label(c, "Bootstrapped", 24*mm, H - 89*mm, 16, white, bold=True)
    label(c, "Self-funded. Built MVP solo.", 24*mm, H - 101*mm, 8, MUTED)

    # Current round
    card(c, 102*mm, H - 115*mm, 88*mm, 50*mm, HexColor("#1a110a"))
    c.setFillColor(AMBER)
    c.rect(102*mm, H - 115*mm, 88*mm, 4, fill=1, stroke=0)
    label(c, "CURRENT RAISE", 106*mm, H - 76*mm, 8, AMBER, bold=True)
    label(c, "$500,000 USD", 106*mm, H - 89*mm, 18, AMBER, bold=True)
    label(c, "Pre-Seed / Seed · Convertible Note or SAFE", 106*mm, H - 101*mm, 7.5, LIGHT)

    # Use of funds
    label(c, "USE OF FUNDS", 20*mm, H - 130*mm, 8, AMBER, bold=True)
    uses = [
        (40, VIOLET, "Product & Engineering", "Arabic NLP, UAE court API, mobile apps, ADGM integration"),
        (30, BLUE,   "MENA Go-to-Market",     "UAE lawyer network, Abu Dhabi partnerships, marketing"),
        (20, EMERALD,"Team",                   "UAE-based legal advisor, BD lead, ML engineer"),
        (10, AMBER,  "Operations",             "Hub71 costs, legal entity (ADGM/Mainland), compliance"),
    ]
    ux = 20*mm
    for pct, color, use, desc in uses:
        card(c, ux, H - 185*mm, 68*mm, 48*mm, SURFACE)
        # percentage circle
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(ux + 34*mm, H - 155*mm, f"{pct}%")
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(color)
        c.drawCentredString(ux + 34*mm, H - 165*mm, use)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(LIGHT)
        wrap_text(c, desc, ux + 4*mm, H - 176*mm, 60*mm, 7.5, LIGHT, 11)
        ux += 72*mm

    # 18-month targets
    label(c, "18-MONTH TARGETS POST-FUNDING", 20*mm, H - 202*mm, 8, AMBER, bold=True)
    targets = [
        ("500+",    "MENA verified\nlawyers"),
        ("10,000+", "Monthly active\nusers"),
        ("AED 500K","Annual recurring\nrevenue"),
        ("3",       "UAE govt\npartnerships"),
    ]
    tx = 20*mm
    for val, lbl in targets:
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(AMBER)
        c.drawString(tx, H - 215*mm, val)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(MUTED)
        for i, line in enumerate(lbl.split("\n")):
            c.drawString(tx, H - 225*mm - i*10, line)
        tx += 47*mm

    page_footer(c, 9)
    c.showPage()


def slide_abu_dhabi_plan(c):
    set_bg(c)
    accent_bar(c, HUB71)

    label(c, "ABU DHABI STRATEGY", 20*mm, H - 22*mm, 9, HUB71, bold=True)
    title(c, "Why Abu Dhabi is\nOur MENA Launchpad", 20*mm, H - 44*mm, 26)

    # Why AD
    card(c, 20*mm, H - 110*mm, W - 40*mm, 55*mm, SURFACE)
    c.setFillColor(HUB71)
    c.rect(20*mm, H - 110*mm, 4, 55*mm, fill=1, stroke=0)
    label(c, "WHY ABU DHABI?", 28*mm, H - 68*mm, 9, HUB71, bold=True)
    bullet(c, [
        "ADGM is the world's fastest-growing IFC — $150B+ in assets, needs AI legal infrastructure",
        "UAE has 3M Indian expats facing Indian + UAE dual legal challenges daily — our sweet spot",
        "Hub71 ecosystem gives direct access to Ministry of Justice, DIFC, ADGM regulatory sandbox",
        "UAE Vision 2031 AI strategy — government mandates AI adoption across public services incl. justice",
    ], 28*mm, H - 82*mm, W - 56*mm, 9, LIGHT, HUB71, 15)

    # 12-month Abu Dhabi plan
    label(c, "12-MONTH ABU DHABI EXECUTION PLAN", 20*mm, H - 125*mm, 8, HUB71, bold=True)
    plan = [
        (HUB71,   "Month 1–2",  "Establish ADGM entity · Onboard 20 UAE-licensed advocates · Arabic UI beta"),
        (BLUE,    "Month 3–4",  "Launch UAE Legal Q&A (UAE Federal law, Dubai/AD emirate law)"),
        (VIOLET,  "Month 5–6",  "ADGM court integration · DIFC Pro Bono referral programme partnership"),
        (EMERALD, "Month 7–9",  "500 MENA lawyers onboarded · 1,000 MAU target · AED 50K MRR"),
        (AMBER,   "Month 10–12","Ministry of Justice pilot · Series A preparation · Expand to Saudi Arabia"),
    ]
    py = H - 138*mm
    for color, period, action in plan:
        card(c, 20*mm, py - 18*mm, W - 40*mm, 15*mm, SLATE)
        c.setFillColor(color)
        c.rect(20*mm, py - 18*mm, 3, 15*mm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(color)
        c.drawString(26*mm, py - 7*mm, period)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(LIGHT)
        c.drawString(55*mm, py - 7*mm, action)
        py -= 20*mm

    page_footer(c, 10)
    c.showPage()


def slide_hub71_ask(c):
    set_bg(c)
    accent_bar(c, HUB71)

    label(c, "WHAT WE NEED FROM HUB71", 20*mm, H - 22*mm, 9, HUB71, bold=True)
    title(c, "Our Ask from Hub71", 20*mm, H - 40*mm, 30, white)

    asks = [
        (HUB71,   "Incubation & Workspace",
                  "Abu Dhabi base to run UAE operations, meet clients and partners in-person"),
        (BLUE,    "Regulatory Sandbox Access",
                  "ADGM / DIFC introductions for legal AI regulatory approval and pilot programmes"),
        (VIOLET,  "Cloud Credits",
                  "Microsoft Azure + AWS via Hub71 partnerships to scale AI infrastructure (target: $100K+)"),
        (EMERALD, "Investor Network",
                  "Warm intros to Hub71's MENA VC network for our $500K seed round"),
        (AMBER,   "Government Connections",
                  "Ministry of Justice UAE, TAWTEEN (UAE National Programme) for B2G pipeline"),
        (HUB71,   "Mentor Network",
                  "UAE legal domain experts + MENA fintech/legaltech operators for advisory board"),
    ]

    ay = H - 65*mm
    for i, (color, ask, desc) in enumerate(asks):
        cx = 20*mm if i % 2 == 0 else 106*mm
        if i % 2 == 0 and i > 0:
            ay -= 48*mm
        card(c, cx, ay - 40*mm, 82*mm, 38*mm, SURFACE)
        c.setFillColor(color)
        c.rect(cx, ay - 40*mm, 3, 38*mm, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(color)
        c.drawString(cx + 6*mm, ay - 18*mm, ask)
        wrap_text(c, desc, cx + 6*mm, ay - 29*mm, 72*mm, 8, LIGHT, 12)

    # Bottom CTA
    card(c, 20*mm, 25*mm, W - 40*mm, 28*mm, HUB71)
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(white)
    c.drawCentredString(W/2, 44*mm, "LitigaForge AI + Hub71 = Legal AI for 400M Arabic & South Asian speakers in MENA")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#BFD4FF"))
    c.drawCentredString(W/2, 33*mm, "litigaforge.com  ·  hub71@litigaforge.com  ·  Abu Dhabi, UAE")

    page_footer(c, 11)
    c.showPage()


def slide_close(c):
    set_bg(c)
    # Decorative circles
    c.setFillColor(HexColor("#0d0510"))
    c.circle(0, 0, 200, fill=1, stroke=0)
    c.setFillColor(HexColor("#050d18"))
    c.circle(W, H, 250, fill=1, stroke=0)

    accent_bar(c, AMBER)

    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 48)
    c.drawCentredString(W/2, H/2 + 60, "Let's Build the")
    c.setFillColor(VIOLET)
    c.drawCentredString(W/2, H/2 + 10, "Legal OS for MENA.")

    c.setFillColor(LIGHT)
    c.setFont("Helvetica", 13)
    c.drawCentredString(W/2, H/2 - 30, "LitigaForge AI is ready for Abu Dhabi.")

    # Contact
    card(c, W/2 - 70*mm, H/2 - 80, 140*mm, 40*mm, SURFACE)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(AMBER)
    c.drawCentredString(W/2, H/2 - 50, "litigaforge.com")
    c.setFont("Helvetica", 10)
    c.setFillColor(LIGHT)
    c.drawCentredString(W/2, H/2 - 65, "hub71@litigaforge.com")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawCentredString(W/2, H/2 - 78, "Abu Dhabi · Hyderabad · Global")

    # Hub71 badge
    card(c, W/2 - 35*mm, 35*mm, 70*mm, 18*mm, HUB71, 4)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(white)
    c.drawCentredString(W/2, 42*mm, "Applying to Hub71 — Cohort 2025/26")

    page_footer(c, 12)
    c.showPage()


# ── BUILD PDF ─────────────────────────────────────────────────────────────────

def build():
    c = canvas.Canvas(OUT_PATH, pagesize=A4)
    c.setTitle("LitigaForge AI — Hub71 Abu Dhabi Pitch Deck")
    c.setAuthor("LitigaForge AI")
    c.setSubject("Hub71 Investment Deck — AI Legal Platform")

    slide_cover(c)
    slide_problem(c)
    slide_solution(c)
    slide_market(c)
    slide_business_model(c)
    slide_traction(c)
    slide_competition(c)
    slide_team(c)
    slide_fundraising(c)
    slide_abu_dhabi_plan(c)
    slide_hub71_ask(c)
    slide_close(c)

    c.save()
    size = os.path.getsize(OUT_PATH) / 1024
    print(f"✓ PDF saved: {OUT_PATH}  ({size:.0f} KB, 12 slides)")


if __name__ == "__main__":
    build()
