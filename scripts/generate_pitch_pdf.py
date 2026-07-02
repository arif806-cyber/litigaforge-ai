#!/usr/bin/env python3
"""
LitigaForge AI — Hub71 Abu Dhabi Pitch Deck
Professional PDF with data visualisations, aligned layout, Abu Dhabi focus.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.graphics.shapes import Drawing, Rect, Circle, Line, String, Polygon
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF
from reportlab.lib import colors
import os, math

W, H = A4  # 595 x 842 pts  (1 mm = 2.835 pts)

# ── Design tokens ─────────────────────────────────────────────────────────────
C_BG      = HexColor("#070810")   # near-black page background
C_SURF    = HexColor("#0F1120")   # card surface
C_SURF2   = HexColor("#161828")   # slightly lighter card
C_GOLD    = HexColor("#D4AF37")   # UAE gold
C_TEAL    = HexColor("#00B4A6")   # accent teal
C_GREEN   = HexColor("#22C55E")   # positive green
C_VIOLET  = HexColor("#7C3AED")   # AI purple
C_RED     = HexColor("#EF4444")   # warning red
C_MUTED   = HexColor("#64748B")
C_TEXT    = HexColor("#E2E8F0")
C_SUBTEXT = HexColor("#94A3B8")
C_HUB71   = HexColor("#0041CC")
C_WHITE   = white

MARGIN = 18*mm
INNER_W = W - 2*MARGIN

SLIDE_TOTAL = 13

# ── Low-level primitives ──────────────────────────────────────────────────────

def fill_bg(c):
    c.setFillColor(C_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def top_bar(c, color=C_GOLD, h=5):
    c.setFillColor(color)
    c.rect(0, H - h, W, h, fill=1, stroke=0)

def bottom_bar(c, color=C_GOLD, h=3):
    c.setFillColor(color)
    c.rect(0, 0, W, h, fill=1, stroke=0)

def rounded_rect(c, x, y, w, h, r=5, fill_color=None, stroke_color=None, stroke_w=0.5):
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_w)
    c.roundRect(x, y, w, h, r, fill=1 if fill_color else 0,
                stroke=1 if stroke_color else 0)

def pill(c, x, y, w, h, color, text, font_size=7, text_color=C_WHITE):
    rounded_rect(c, x, y, w, h, h/2, fill_color=color)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", font_size)
    c.drawCentredString(x + w/2, y + (h - font_size)/2 + 1, text)

def txt(c, text, x, y, size=10, color=C_TEXT, font="Helvetica", align="left"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

def heading(c, text, x, y, size=22, color=C_WHITE):
    txt(c, text, x, y, size, color, "Helvetica-Bold")

def subheading(c, text, x, y, size=11, color=C_SUBTEXT):
    txt(c, text, x, y, size, color, "Helvetica")

def section_tag(c, label, x, y, color=C_GOLD):
    """Small uppercase tag above section headings."""
    pill(c, x, y, len(label)*5.5 + 10, 13, color, label, 7)

def divider(c, x, y, w, color=C_GOLD, lw=1):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y, x + w, y)

def footer(c, n):
    c.setFillColor(C_MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN, 9*mm, "LitigaForge AI · Confidential · litigaforge.com")
    c.drawRightString(W - MARGIN, 9*mm, f"{n}  /  {SLIDE_TOTAL}")
    divider(c, MARGIN, 13*mm, INNER_W, C_MUTED, 0.4)

def two_col_bullets(c, items, x, y, col_w, size=9, color=C_TEXT, bullet_color=C_GOLD, lh=16):
    """Draw a two-column bullet list and return the lowest y reached."""
    half = len(items) // 2 + len(items) % 2
    col1, col2 = items[:half], items[half:]
    cy1, cy2 = y, y
    for item in col1:
        c.setFillColor(bullet_color)
        c.circle(x + 4, cy1 + 3, 2, fill=1, stroke=0)
        txt(c, item, x + 10, cy1, size, color)
        cy1 -= lh
    x2 = x + col_w / 2 + 4*mm
    for item in col2:
        c.setFillColor(bullet_color)
        c.circle(x2 + 4, cy2 + 3, 2, fill=1, stroke=0)
        txt(c, item, x2 + 10, cy2, size, color)
        cy2 -= lh
    return min(cy1, cy2)

def wrap(c, text, x, y, max_w, size=9, color=C_TEXT, lh=14, font="Helvetica"):
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line = ""
    cy = y
    for word in words:
        test = (line + " " + word).strip()
        if c.stringWidth(test, font, size) <= max_w:
            line = test
        else:
            if line:
                c.drawString(x, cy, line)
                cy -= lh
            line = word
    if line:
        c.drawString(x, cy, line)
    return cy

def icon_stat(c, x, y, val, label, color=C_GOLD, w=42*mm, h=36*mm):
    rounded_rect(c, x, y, w, h, 5, C_SURF2)
    # colour accent left bar
    c.setFillColor(color)
    c.rect(x, y, 3, h, fill=1, stroke=0)
    txt(c, val, x + w/2, y + h - 22, 18, color, "Helvetica-Bold", "center")
    txt(c, label, x + w/2, y + 8, 7.5, C_SUBTEXT, "Helvetica", "center")

# ── PIE CHART helper ──────────────────────────────────────────────────────────

def pie_chart(c, x, y, size, data, labels, colors_list, title_text=""):
    d = Drawing(size, size)
    pie = Pie()
    pie.x = 10
    pie.y = 10
    pie.width = size - 20
    pie.height = size - 20
    pie.data = data
    pie.labels = None
    pie.sideLabels = False
    for i, col in enumerate(colors_list):
        pie.slices[i].fillColor = col
        pie.slices[i].strokeColor = C_BG
        pie.slices[i].strokeWidth = 1.5
    d.add(pie)
    renderPDF.draw(d, c, x, y)
    # legend to the right
    lx = x + size + 6*mm
    ly = y + size - 10
    for i, (lbl, pct) in enumerate(zip(labels, data)):
        total = sum(data)
        pct_val = pct / total * 100
        c.setFillColor(colors_list[i])
        c.rect(lx, ly - 4, 8, 8, fill=1, stroke=0)
        txt(c, f"{lbl}  {pct_val:.0f}%", lx + 12, ly, 8, C_TEXT)
        ly -= 15

# ── BAR CHART helper ─────────────────────────────────────────────────────────

def bar_chart(c, x, y, bw, bh, categories, values, bar_color=C_GOLD,
              y_label="", max_val=None):
    if max_val is None:
        max_val = max(values) * 1.15
    n = len(values)
    bar_w = (bw - 20) / n - 6
    bar_x = x + 10
    # Y axis
    c.setStrokeColor(C_MUTED)
    c.setLineWidth(0.5)
    c.line(x + 10, y, x + 10, y + bh)
    c.line(x + 10, y, x + bw, y)
    # Grid lines + y labels (4 lines)
    for i in range(5):
        gy = y + i * bh / 4
        c.setStrokeColor(HexColor("#1E293B"))
        c.setLineWidth(0.3)
        c.line(x + 10, gy, x + bw, gy)
        val = max_val * i / 4
        txt(c, f"{val:.0f}" if val < 1000 else f"{val/1000:.0f}K",
            x + 8, gy - 3, 6.5, C_MUTED, align="right")
    # Bars
    for i, (cat, val) in enumerate(zip(categories, values)):
        bx = bar_x + i * (bar_w + 6)
        bar_h = (val / max_val) * bh
        # bar shadow
        c.setFillColor(HexColor("#0A0B10"))
        c.rect(bx + 2, y + 1, bar_w, bar_h, fill=1, stroke=0)
        # bar
        c.setFillColor(bar_color)
        c.rect(bx, y, bar_w, bar_h, fill=1, stroke=0)
        # value on top
        txt(c, str(val) if val < 1000 else f"{val/1000:.0f}K",
            bx + bar_w/2, y + bar_h + 3, 7, C_GOLD, align="center")
        # category label
        # wrap category into two lines if needed
        words = cat.split()
        if len(words) <= 2:
            txt(c, cat, bx + bar_w/2, y - 12, 6.5, C_SUBTEXT, align="center")
        else:
            txt(c, " ".join(words[:2]), bx + bar_w/2, y - 10, 6, C_SUBTEXT, align="center")
            txt(c, " ".join(words[2:]), bx + bar_w/2, y - 18, 6, C_SUBTEXT, align="center")
    if y_label:
        txt(c, y_label, x - 2*mm, y + bh/2, 7, C_SUBTEXT)

def multi_bar_chart(c, x, y, bw, bh, categories, datasets, colors_list, legend_labels, max_val=None):
    """Grouped bar chart for multiple series."""
    if max_val is None:
        max_val = max(max(d) for d in datasets) * 1.2
    n = len(categories)
    ns = len(datasets)
    group_w = (bw - 20) / n
    bar_w = group_w / ns - 3
    # Grid
    c.setStrokeColor(C_MUTED)
    c.setLineWidth(0.5)
    c.line(x + 10, y, x + 10, y + bh)
    c.line(x + 10, y, x + bw, y)
    for i in range(5):
        gy = y + i * bh / 4
        c.setStrokeColor(HexColor("#1E293B"))
        c.setLineWidth(0.3)
        c.line(x + 10, gy, x + bw, gy)
        val = max_val * i / 4
        txt(c, f"{val:.0f}K" if val >= 1000 else f"{val:.0f}",
            x + 8, gy - 3, 6.5, C_MUTED, align="right")
    # Bars
    for gi, cat in enumerate(categories):
        gx = x + 10 + gi * group_w
        for si, (dataset, color) in enumerate(zip(datasets, colors_list)):
            bx = gx + si * (bar_w + 1) + 2
            bh_val = (dataset[gi] / max_val) * bh
            c.setFillColor(color)
            c.rect(bx, y, bar_w, bh_val, fill=1, stroke=0)
        txt(c, cat, gx + group_w/2, y - 12, 7, C_SUBTEXT, align="center")
    # Legend
    lx = x + bw - 30*mm
    ly = y + bh + 4
    for label, color in zip(legend_labels, colors_list):
        c.setFillColor(color)
        c.rect(lx, ly, 8, 8, fill=1, stroke=0)
        txt(c, label, lx + 11, ly + 1, 7, C_SUBTEXT)
        lx += 25*mm

# ═════════════════════════════════════════════════════════════════════════════
# SLIDES
# ═════════════════════════════════════════════════════════════════════════════

def s01_cover(c):
    fill_bg(c)
    top_bar(c, C_GOLD, 6)

    # Right side decorative radial
    for r in [260, 200, 140, 80]:
        alpha = 0.04 if r == 260 else 0.06 if r == 200 else 0.08 if r == 140 else 0.12
        c.setFillColor(Color(0.49, 0.38, 0.21, alpha))
        c.circle(W + 20, H * 0.55, r, fill=1, stroke=0)

    # HUB71 badge
    rounded_rect(c, MARGIN, H - 30*mm, 52*mm, 12*mm, 3, C_HUB71)
    txt(c, "HUB71  ·  ABU DHABI", MARGIN + 26*mm, H - 23*mm, 8, C_WHITE, "Helvetica-Bold", "center")

    # Main wordmark
    c.setFont("Helvetica-Bold", 46)
    c.setFillColor(C_GOLD)
    c.drawString(MARGIN, H - 55*mm, "LitigaForge AI")

    # Tagline
    txt(c, "Abu Dhabi's AI Legal Intelligence Platform", MARGIN, H - 66*mm,
        14, C_TEXT, "Helvetica")

    divider(c, MARGIN, H - 72*mm, 90*mm, C_GOLD, 1.5)

    # Three lines of positioning
    lines = [
        ("Serving 3.5M+ migrants & expats who face the UAE legal system daily",   C_TEXT),
        ("Powered by frontier LLMs — Claude 4 · Gemini 2.5 · GPT-5",           C_SUBTEXT),
        ("Regulated AI  ·  Arabic-ready  ·  ADGM & Federal law coverage",        C_SUBTEXT),
    ]
    ly = H - 80*mm
    for line, col in lines:
        txt(c, line, MARGIN, ly, 10, col)
        ly -= 14

    # 4 stat pills in a row
    stats = [
        ("3.5M+",  "UAE Migrants\nUnderserved"),
        ("AED 28B","UAE Legal\nMarket"),
        ("89%",    "Abu Dhabi Pop.\nAre Expats"),
        ("$500K",  "Seed Round\nRaising Now"),
    ]
    sx = MARGIN
    sw = (INNER_W - 9*mm) / 4
    for val, lbl in stats:
        rounded_rect(c, sx, H - 125*mm, sw, 28*mm, 5, C_SURF)
        c.setFillColor(C_GOLD)
        c.rect(sx, H - 97*mm, sw, 2, fill=1, stroke=0)
        txt(c, val, sx + sw/2, H - 112*mm, 16, C_GOLD, "Helvetica-Bold", "center")
        for i, part in enumerate(lbl.split("\n")):
            txt(c, part, sx + sw/2, H - 122*mm + i*(-9), 7, C_SUBTEXT, "Helvetica", "center")
        sx += sw + 3*mm

    # Technology stack strip
    rounded_rect(c, MARGIN, H - 158*mm, INNER_W, 22*mm, 5, C_SURF2)
    txt(c, "TECHNOLOGY STACK", MARGIN + 5*mm, H - 141*mm, 7.5, C_GOLD, "Helvetica-Bold")
    techs = ["Claude Sonnet 4  ·  LLM Reasoning",
             "Gemini 2.5 Flash  ·  Vision + Docs",
             "GPT-5  ·  Fallback",
             "LangGraph  ·  Agent Orchestration",
             "RAG  ·  UAE Law Corpus"]
    tx = MARGIN + 44*mm
    for t in techs:
        txt(c, t, tx, H - 141*mm, 7.5, C_SUBTEXT)
        tx += 40*mm

    # URL
    txt(c, "litigaforge.com", MARGIN, H - 172*mm, 11, C_TEAL, "Helvetica-Bold")
    txt(c, "Sector: Artificial Intelligence  ·  LegalTech  ·  GovTech",
        MARGIN, H - 183*mm, 8.5, C_MUTED)

    footer(c, 1)
    c.showPage()


def s02_abu_dhabi_problem(c):
    fill_bg(c)
    top_bar(c, C_GOLD)

    section_tag(c, "THE PROBLEM", MARGIN, H - 22*mm, C_RED)
    heading(c, "Abu Dhabi Has a Legal Access Crisis", MARGIN, H - 38*mm, 22)
    subheading(c, "89% of residents are expats — most cannot navigate UAE law alone.", MARGIN, H - 50*mm)

    # PIE chart — population breakdown
    pie_x = MARGIN
    pie_y = H - 145*mm
    pie_size = 80
    pie_data   = [11, 58, 31]
    pie_labels = ["UAE Nationals", "South Asian Expats\n(Indian/Pak/BD/Sri Lanka)", "Other Expats\n(Filipino/Western/Arab)"]
    pie_colors = [C_GOLD, C_TEAL, C_VIOLET]
    pie_chart(c, pie_x, pie_y, pie_size, pie_data, pie_labels, pie_colors)
    txt(c, "Abu Dhabi Population Breakdown", pie_x + pie_size/2, pie_y - 10,
        7.5, C_MUTED, align="center")

    # Problem cards — right of pie
    problems = [
        (C_RED,    "Language Barrier",
                   "All UAE court proceedings are in Arabic. 88% of expats\nneed paid translation — AED 500–3,000 per hearing."),
        (C_GOLD,   "Cost of Legal Help",
                   "Abu Dhabi lawyer fees: AED 1,000–5,000/hour.\nMigrant worker monthly salary avg: AED 1,200."),
        (C_TEAL,   "Dual Legal Systems",
                   "Expats navigate UAE Federal law + emirate-level rules\n+ ADGM/DIFC common-law courts simultaneously."),
        (C_VIOLET, "Migrant Vulnerability",
                   "Labour disputes, visa cancellations, rental evictions —\n650,000 cases filed in UAE courts per year."),
    ]
    px = MARGIN + 75*mm
    py = H - 60*mm
    pw = (INNER_W - 77*mm) / 2 - 2*mm
    for i, (col, title, desc) in enumerate(problems):
        bx = px + (i % 2) * (pw + 4*mm)
        by = py - (i // 2) * 46*mm
        rounded_rect(c, bx, by - 38*mm, pw, 36*mm, 5, C_SURF)
        c.setFillColor(col)
        c.rect(bx, by - 2*mm, pw, 2, fill=1, stroke=0)
        txt(c, title, bx + 4*mm, by - 10*mm, 9, col, "Helvetica-Bold")
        for j, line in enumerate(desc.split("\n")):
            txt(c, line, bx + 4*mm, by - 19*mm - j*11, 7.5, C_SUBTEXT)

    # Bottom stat row
    stats = [
        (C_RED,    "650,000", "Court cases/year\nin UAE"),
        (C_GOLD,   "AED 1K+", "Avg lawyer\nconsultation fee"),
        (C_TEAL,   "72hrs",   "Avg wait for\nlegal aid appt"),
        (C_VIOLET, "34%",     "Labour disputes go\nunrepresented"),
    ]
    sx = MARGIN
    sw = (INNER_W - 9*mm) / 4
    sy = H - 165*mm
    for col, val, lbl in stats:
        rounded_rect(c, sx, sy, sw, 26*mm, 5, C_SURF)
        txt(c, val, sx + sw/2, sy + 19*mm, 14, col, "Helvetica-Bold", "center")
        for i, part in enumerate(lbl.split("\n")):
            txt(c, part, sx + sw/2, sy + 10*mm - i*9, 7, C_SUBTEXT, align="center")
        sx += sw + 3*mm

    footer(c, 2)
    c.showPage()


def s03_ai_solution(c):
    fill_bg(c)
    top_bar(c, C_TEAL)

    section_tag(c, "THE SOLUTION", MARGIN, H - 22*mm, C_TEAL)
    heading(c, "LitigaForge AI — Built for Abu Dhabi", MARGIN, H - 38*mm, 22)
    subheading(c, "The only AI legal platform that understands UAE law, Arabic context, and the migrant experience.",
               MARGIN, H - 50*mm, 10)

    # 6 feature cards in 3×2 grid
    features = [
        (C_TEAL,   "AI Legal Q&A",
                   "Ask any UAE legal question in English or Arabic. AI answers grounded in UAE Federal Law, Penal Code, Labour Law, tenancy regulations — instantly."),
        (C_GOLD,   "UAE Lawyer Matching",
                   "Post your case. AI scores Abu Dhabi lawyers 0–100 by speciality, language, and case type. Match in minutes, not days."),
        (C_VIOLET, "Document Analyzer",
                   "Upload a tenancy contract, employment offer letter, or MOA. AI flags risks, missing clauses, and highlights what migrants commonly miss."),
        (C_TEAL,   "Labour Dispute AI",
                   "Specialised flow for UAE labour disputes: MOHRE complaints, gratuity calculation, visa cancellation rights, WPS salary protection."),
        (C_GOLD,   "ADGM / DIFC Layer",
                   "Dedicated AI for Abu Dhabi Global Market and DIFC common-law jurisdiction — used by fintech startups and international businesses."),
        (C_VIOLET, "Free Legal Aid Finder",
                   "Eligibility wizard for ADGM Pro Bono Bureau, Abu Dhabi Judicial Dept aid, UNHCR legal assistance for asylum seekers and refugees."),
    ]
    col_w = (INNER_W - 4*mm) / 3
    row_h = 54*mm
    for i, (col, ftitle, fdesc) in enumerate(features):
        col_i = i % 3
        row_i = i // 3
        fx = MARGIN + col_i * (col_w + 2*mm)
        fy = H - 65*mm - row_i * (row_h + 2*mm) - row_h
        rounded_rect(c, fx, fy, col_w, row_h, 6, C_SURF)
        c.setFillColor(col)
        c.rect(fx, fy + row_h - 3, col_w, 3, fill=1, stroke=0)
        # small icon circle
        c.setFillColor(col)
        c.circle(fx + 6*mm, fy + row_h - 12, 5, fill=1, stroke=0)
        txt(c, ftitle, fx + 13*mm, fy + row_h - 14, 9.5, col, "Helvetica-Bold")
        wrap(c, fdesc, fx + 4*mm, fy + row_h - 26, col_w - 8*mm, 7.5, C_SUBTEXT, 12)

    footer(c, 3)
    c.showPage()


def s04_llm_tech(c):
    fill_bg(c)
    top_bar(c, C_VIOLET)

    section_tag(c, "AI & LLM TECHNOLOGY", MARGIN, H - 22*mm, C_VIOLET)
    heading(c, "How the AI Works — Under the Hood", MARGIN, H - 38*mm, 22)
    subheading(c, "A multi-model cascade with UAE-law RAG, not a generic chatbot.",
               MARGIN, H - 50*mm, 10)

    # Architecture flow diagram (horizontal)
    flow_y = H - 78*mm
    flow_h = 20*mm
    steps = [
        (C_TEAL,   "User Query\n(EN / AR)",       "Natural language\nUAE legal question"),
        (C_GOLD,   "UAE Law RAG\nRetrieval",       "Semantic search over\nUAE Federal Code +\nADGM Rules + Labour Law"),
        (C_VIOLET, "LLM Cascade\nClaude 4 → Gemini → GPT-5", "Frontier model picks\nbest jurisdiction-aware\nanswer"),
        (C_TEAL,   "Safety &\nDisclaimer Layer",   "AI Safety wrapper\nadds mandatory\nlegal disclaimers"),
        (C_GOLD,   "Structured\nResponse",         "JSON + plain-language\nanswer delivered\nto user"),
    ]
    sw = (INNER_W - (len(steps)-1)*8) / len(steps)
    sx = MARGIN
    for i, (col, stitle, sdesc) in enumerate(steps):
        rounded_rect(c, sx, flow_y - flow_h, sw, flow_h, 5, col)
        for j, line in enumerate(stitle.split("\n")):
            txt(c, line, sx + sw/2, flow_y - 9 - j*10, 8, C_BG, "Helvetica-Bold", "center")
        # Arrow
        if i < len(steps) - 1:
            ax = sx + sw + 1
            c.setFillColor(C_MUTED)
            c.setStrokeColor(C_MUTED)
            c.setLineWidth(0.8)
            c.line(ax, flow_y - flow_h/2, ax + 6, flow_y - flow_h/2)
            # arrowhead
            c.setFillColor(C_MUTED)
            p = c.beginPath()
            p.moveTo(ax + 6, flow_y - flow_h/2 - 3)
            p.lineTo(ax + 6, flow_y - flow_h/2 + 3)
            p.lineTo(ax + 9, flow_y - flow_h/2)
            p.close()
            c.drawPath(p, fill=1)
        sx += sw + 9

    # Below flow — desc
    sx2 = MARGIN
    for i, (col, _, sdesc) in enumerate(steps):
        for j, line in enumerate(sdesc.split("\n")):
            txt(c, line, MARGIN + i*(sw+9) + sw/2, flow_y - flow_h - 12 - j*10, 7, C_SUBTEXT, align="center")

    # Three differentiators
    divider(c, MARGIN, H - 125*mm, INNER_W, C_VIOLET, 0.5)
    txt(c, "WHY THIS AI IS DIFFERENT FROM GENERIC CHATGPT / CHATBOTS", MARGIN, H - 130*mm,
        8, C_VIOLET, "Helvetica-Bold")

    diffs = [
        (C_GOLD, "UAE Law Corpus",
                 "RAG over UAE Federal Decree Laws, Ministerial Decisions, ADGM Regulations, "
                 "DIFC Laws, MOL circulars — updated quarterly. Not trained on general web data."),
        (C_TEAL, "Multi-LLM Cascade",
                 "Claude Sonnet 4 as primary for legal reasoning depth. Gemini 2.5 Flash for "
                 "document vision (scanned contracts, Arabic PDFs). GPT-5 as final fallback. "
                 "Each model is auto-selected by question type — never one-size-fits-all."),
        (C_VIOLET, "Arabic-First NLP",
                 "Arabic query parsing, transliteration handling, mixed Arabic-English legal "
                 "terminology (e.g. 'kafala', 'mawqif', 'mulkiya'). Responses in the user's "
                 "chosen language. Q4 2025: full Arabic UI + Arabic LLM fine-tune."),
        (C_GOLD, "AI Safety Layer",
                 "Every response wrapped with jurisdiction disclaimer, non-advice notice, "
                 "and a referral to a licensed UAE lawyer. Compliant with UAE AI Ethics framework "
                 "and ADGM AI governance guidelines."),
    ]
    dx = MARGIN
    dw = (INNER_W - 6*mm) / 4
    dy_top = H - 140*mm
    for col, dtitle, ddesc in diffs:
        rounded_rect(c, dx, dy_top - 62*mm, dw, 60*mm, 5, C_SURF)
        c.setFillColor(col)
        c.circle(dx + 6*mm, dy_top - 10, 5, fill=1, stroke=0)
        txt(c, dtitle, dx + 13*mm, dy_top - 12, 9, col, "Helvetica-Bold")
        wrap(c, ddesc, dx + 4*mm, dy_top - 24, dw - 8*mm, 7.5, C_SUBTEXT, 12)
        dx += dw + 2*mm

    footer(c, 4)
    c.showPage()


def s05_market(c):
    fill_bg(c)
    top_bar(c, C_GOLD)

    section_tag(c, "MARKET OPPORTUNITY", MARGIN, H - 22*mm, C_GOLD)
    heading(c, "Massive Legal Market,\nAlmost Zero AI Penetration", MARGIN, H - 40*mm, 22)

    # TAM/SAM/SOM cards
    tsm = [
        (C_GREEN,  "TAM",  "$1 Trillion",  "Global legal services (2024)"),
        (C_GOLD,   "SAM",  "$85 Billion",  "AI-addressable LegalTech"),
        (C_TEAL,   "SOM",  "$2.8 Billion", "MENA digital legal platforms"),
        (C_VIOLET, "UAE",  "AED 28B",      "UAE legal services market"),
    ]
    sw2 = (INNER_W - 9*mm) / 4
    sx2 = MARGIN
    for col, tier, val, desc in tsm:
        rounded_rect(c, sx2, H - 80*mm, sw2, 28*mm, 5, C_SURF)
        c.setFillColor(col)
        c.circle(sx2 + 6*mm, H - 57*mm, 7, fill=1, stroke=0)
        txt(c, tier, sx2 + 6*mm, H - 60*mm, 6, C_BG, "Helvetica-Bold", "center")
        txt(c, val, sx2 + sw2/2, H - 68*mm, 13, col, "Helvetica-Bold", "center")
        txt(c, desc, sx2 + sw2/2, H - 77*mm, 7, C_SUBTEXT, align="center")
        sx2 += sw2 + 3*mm

    # BAR CHART — UAE Legal Cases by Category
    divider(c, MARGIN, H - 95*mm, INNER_W, C_MUTED, 0.4)
    txt(c, "UAE COURT CASES BY CATEGORY (2023, thousands)",
        MARGIN, H - 100*mm, 8, C_GOLD, "Helvetica-Bold")

    cats   = ["Labour\nDisputes", "Tenancy\nDisputes", "Commercial\nClaims", "Criminal\nCases",
              "Family\n& Personal", "Civil\nClaims"]
    vals   = [210, 165, 140, 120, 95, 80]
    bar_chart(c, MARGIN, H - 175*mm, INNER_W * 0.56, 68*mm, cats, vals, C_TEAL)

    # PIE — Abu Dhabi migrant workforce by origin
    txt(c, "ABU DHABI EXPATS BY ORIGIN", MARGIN + INNER_W * 0.60, H - 100*mm,
        8, C_GOLD, "Helvetica-Bold")
    pie_data2   = [31, 14, 12, 9, 24]
    pie_labels2 = ["Indian", "Pakistani", "Bangladeshi", "Filipino", "Other"]
    pie_colors2 = [C_TEAL, C_GOLD, C_VIOLET, C_GREEN, C_MUTED]
    pie_chart(c, MARGIN + INNER_W * 0.60, H - 172*mm, 70, pie_data2,
              pie_labels2, pie_colors2)

    # Bottom insight
    rounded_rect(c, MARGIN, H - 200*mm, INNER_W, 18*mm, 5, HexColor("#0d1020"))
    c.setFillColor(C_TEAL)
    c.rect(MARGIN, H - 200*mm, 3, 18*mm, fill=1, stroke=0)
    txt(c, "KEY INSIGHT",
        MARGIN + 6*mm, H - 187*mm, 7.5, C_TEAL, "Helvetica-Bold")
    txt(c, ("Labour disputes (210K/yr) and tenancy cases (165K/yr) are the top two categories — "
            "both disproportionately affecting South Asian migrants who are our primary user segment."),
        MARGIN + 6*mm, H - 197*mm, 8, C_TEXT)

    footer(c, 5)
    c.showPage()


def s06_use_cases(c):
    fill_bg(c)
    top_bar(c, C_TEAL)

    section_tag(c, "REAL USE CASES — ABU DHABI", MARGIN, H - 22*mm, C_TEAL)
    heading(c, "Who Uses LitigaForge in Abu Dhabi", MARGIN, H - 38*mm, 22)
    subheading(c, "Real scenarios that 3.5M Abu Dhabi expats face every week.", MARGIN, H - 50*mm)

    personas = [
        (C_TEAL, "Rajan, Indian Construction Worker",
                 "Salary unpaid for 3 months by employer. Visa expires in 15 days.",
                 [
                     "Asks LitigaForge: 'Can my employer cancel my visa while my salary is unpaid?'",
                     "AI answers: UAE Labour Law Art. 61 protects against arbitrary termination",
                     "AI guides him to file MOHRE complaint online — free, takes 5 mins",
                     "Matched with Arabic-speaking labour lawyer, AED 0 for initial consult",
                     "Result: Salary recovered, visa extended pending case — without paying AED 3,000/hr",
                 ]),
        (C_GOLD, "Priya, Filipino Domestic Worker",
                 "Employer withheld passport, refusing to give NOC for new job.",
                 [
                     "Asks LitigaForge: 'Is it legal for my employer to hold my passport in UAE?'",
                     "AI: UAE Federal Law No.6/1973 — passport confiscation is illegal",
                     "Document: AI generates a formal letter demanding passport return",
                     "Legal Aid finder: ADGM Pro Bono Bureau + UNHCR Dubai referral",
                     "Kafala reform 2021 — AI explains her right to change jobs",
                 ]),
        (C_VIOLET, "Amira, Egyptian SME Owner",
                 "Commercial lease dispute with landlord, ADGM jurisdiction contract.",
                 [
                     "Uploads 40-page ADGM lease contract to Document Analyzer",
                     "AI flags: 3 clauses missing mandatory ADGM disclosure requirements",
                     "Identifies: penalty clause exceeds ADGM cap — potentially unenforceable",
                     "Matched with ADGM-licensed commercial lawyer within 2 hours",
                     "Saved AED 25,000 in avoidable penalties with early legal intervention",
                 ]),
    ]

    pw = (INNER_W - 4*mm) / 3
    for i, (col, name, situation, steps) in enumerate(personas):
        px = MARGIN + i * (pw + 2*mm)
        py_top = H - 62*mm
        ph = 148*mm
        rounded_rect(c, px, py_top - ph, pw, ph, 6, C_SURF)
        c.setFillColor(col)
        c.rect(px, py_top - ph + ph - 3, pw, 3, fill=1, stroke=0)
        # avatar circle
        c.setFillColor(col)
        c.circle(px + pw/2, py_top - 10*mm, 9, fill=1, stroke=0)
        txt(c, name[0], px + pw/2, py_top - 12*mm, 10, C_BG, "Helvetica-Bold", "center")
        txt(c, name, px + pw/2, py_top - 22*mm, 8, col, "Helvetica-Bold", "center")
        wrap(c, situation, px + 4*mm, py_top - 33*mm, pw - 8*mm, 7.5, C_SUBTEXT, 11)
        sy = py_top - 47*mm
        for j, step in enumerate(steps):
            c.setFillColor(col)
            c.circle(px + 5*mm, sy + 3, 3, fill=1, stroke=0)
            c.setFillColor(C_BG)
            c.setFont("Helvetica-Bold", 6)
            c.drawCentredString(px + 5*mm, sy + 1, str(j+1))
            wrap(c, step, px + 10*mm, sy, pw - 14*mm, 7.5, C_TEXT, 11)
            sy -= 26

    footer(c, 6)
    c.showPage()


def s07_business_model(c):
    fill_bg(c)
    top_bar(c, C_GOLD)

    section_tag(c, "BUSINESS MODEL", MARGIN, H - 22*mm, C_GOLD)
    heading(c, "Freemium SaaS + Marketplace", MARGIN, H - 38*mm, 22)
    subheading(c, "Multiple monetisation streams — B2C subscriptions, B2B API, B2G contracts.", MARGIN, H - 50*mm)

    # Subscription tiers
    tiers = [
        (C_MUTED,   "FREE",         "AED 0",   "/month",
         ["5 AI queries/month", "UAE Legal Q&A", "Lawyer directory", "Judgment search"]),
        (C_TEAL,    "PROFESSIONAL", "AED 139", "/month",
         ["Unlimited AI queries", "Priority matching", "Document uploads", "Case tracking"]),
        (C_GOLD,    "ADVOCATE PRO", "AED 349", "/month",
         ["Practice management", "Client dashboard", "ADGM integration", "Analytics"]),
        (C_VIOLET,  "ENTERPRISE",   "Custom",  "/month",
         ["White-label AI", "API access", "UAE law fine-tune", "SLA support"]),
    ]
    tw = (INNER_W - 9*mm) / 4
    tx2 = MARGIN
    for col, name, price, period, feats in tiers:
        th = 95*mm
        ty = H - 60*mm
        rounded_rect(c, tx2, ty - th, tw, th, 6, C_SURF)
        c.setFillColor(col)
        c.rect(tx2, ty, tw, 3, fill=1, stroke=0)
        pill(c, tx2 + tw/2 - 18*mm, ty - 14*mm, 36*mm, 11, col, name, 7.5)
        txt(c, price, tx2 + tw/2, ty - 28*mm, 20, C_WHITE, "Helvetica-Bold", "center")
        txt(c, period, tx2 + tw/2, ty - 37*mm, 8, C_SUBTEXT, align="center")
        fy = ty - 48*mm
        for feat in feats:
            c.setFillColor(col)
            c.circle(tx2 + 4*mm, fy + 3, 2, fill=1, stroke=0)
            txt(c, feat, tx2 + 8*mm, fy, 7.5, C_TEXT)
            fy -= 13
        tx2 += tw + 3*mm

    # Revenue streams row
    divider(c, MARGIN, H - 170*mm, INNER_W, C_MUTED, 0.4)
    txt(c, "ADDITIONAL REVENUE STREAMS", MARGIN, H - 175*mm, 8, C_GOLD, "Helvetica-Bold")
    streams = [
        (C_GOLD,   "Lawyer Listing",
                   "AED 800–3,000/mo\npremium placement"),
        (C_TEAL,   "Document Credits",
                   "AED 15 per AI\ndocument generated"),
        (C_VIOLET, "B2G Contracts",
                   "Ministry of Justice\nADGM digitisation"),
        (C_GOLD,   "API Licensing",
                   "White-label for UAE\nlaw firms & insurers"),
        (C_TEAL,   "Referral Fees",
                   "5–10% of first month\nfor lawyer leads"),
    ]
    sx3 = MARGIN
    sw3 = (INNER_W - 8*mm) / 5
    for col, sname, sdesc in streams:
        rounded_rect(c, sx3, H - 210*mm, sw3, 28*mm, 5, C_SURF2)
        c.setFillColor(col)
        c.rect(sx3, H - 210*mm, sw3, 2, fill=1, stroke=0)
        txt(c, sname, sx3 + sw3/2, H - 196*mm, 8.5, col, "Helvetica-Bold", "center")
        for j, line in enumerate(sdesc.split("\n")):
            txt(c, line, sx3 + sw3/2, H - 206*mm + j*(-9), 7, C_SUBTEXT, align="center")
        sx3 += sw3 + 2*mm

    footer(c, 7)
    c.showPage()


def s08_traction(c):
    fill_bg(c)
    top_bar(c, C_GREEN)

    section_tag(c, "TRACTION & MILESTONES", MARGIN, H - 22*mm, C_GREEN)
    heading(c, "Live Product. Real Traction.", MARGIN, H - 38*mm, 22)
    subheading(c, "Built solo, deployed globally, ready to scale from Abu Dhabi.", MARGIN, H - 50*mm)

    # Milestone checkmarks
    milestones = [
        (True,  C_GREEN,  "Full-stack AI platform live at litigaforge.com — 8 countries, 3 languages"),
        (True,  C_GREEN,  "Multi-LLM cascade: Claude Sonnet 4 → Gemini 2.5 Flash → GPT-5 in production"),
        (True,  C_GREEN,  "AI Lawyer Matching live: 0–100 scoring with AI explanation"),
        (True,  C_GREEN,  "Document Analyzer live: PDF, DOCX, image scan — risk scoring + clause detection"),
        (True,  C_GREEN,  "Judgment search: IndianKanoon API + AI summarisation"),
        (True,  C_GREEN,  "Payment live: Razorpay subscriptions (Free / Pro / Advocate tiers)"),
        (True,  C_GREEN,  "PWA installed as mobile app (Android + iOS, no app store required)"),
        (True,  C_GREEN,  "eCourts India CNR case tracking API integrated"),
        (False, C_GOLD,   "Arabic UI + Arabic legal Q&A — Q4 2025"),
        (False, C_GOLD,   "UAE Federal Law RAG corpus + ADGM court integration — Q1 2026"),
        (False, C_VIOLET, "500 verified MENA lawyers onboarded — Q2 2026"),
        (False, C_VIOLET, "UAE Ministry of Justice pilot programme — Q2 2026"),
    ]
    my = H - 62*mm
    for done, col, text in milestones:
        c.setFillColor(col)
        if done:
            c.circle(MARGIN + 3*mm, my + 3.5, 4, fill=1, stroke=0)
            c.setFillColor(C_BG)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(MARGIN + 3*mm, my + 1.5, "✓")
        else:
            c.circle(MARGIN + 3*mm, my + 3.5, 4, fill=0, stroke=1)
            c.setLineWidth(1)
        txt(c, text, MARGIN + 8*mm, my, 9, C_TEXT if done else C_SUBTEXT)
        my -= 16

    # Revenue projection bar chart
    divider(c, MARGIN, H - 235*mm, INNER_W, C_MUTED, 0.4)
    txt(c, "PROJECTED ANNUAL REVENUE (AED, post-Hub71 funding)",
        MARGIN, H - 240*mm, 8, C_GOLD, "Helvetica-Bold")

    rev_cats = ["Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "FY 2027"]
    rev_vals = [80, 180, 350, 600, 950, 2500]
    bar_chart(c, MARGIN, H - 295*mm, INNER_W * 0.62, 48*mm,
              rev_cats, rev_vals, C_GOLD, "AED '000")

    # Key financial KPIs
    kpis = [
        (C_GOLD,   "AED 500K", "MRR Target\n12 months"),
        (C_TEAL,   "AED 2.5M", "ARR Target\n18 months"),
        (C_GREEN,  "500+",     "MENA Lawyers\non Platform"),
        (C_VIOLET, "10,000",   "Monthly Active\nUsers Target"),
    ]
    kx = MARGIN + INNER_W * 0.65
    kw = INNER_W * 0.35 / 2 - 2*mm
    ky = H - 250*mm
    for i, (col, val, lbl) in enumerate(kpis):
        bx = kx + (i % 2) * (kw + 3*mm)
        by = ky - (i // 2) * 26*mm
        rounded_rect(c, bx, by - 22*mm, kw, 20*mm, 4, C_SURF)
        txt(c, val, bx + kw/2, by - 8*mm, 12, col, "Helvetica-Bold", "center")
        for j, line in enumerate(lbl.split("\n")):
            txt(c, line, bx + kw/2, by - 17*mm + j*(-8), 7, C_SUBTEXT, align="center")

    footer(c, 8)
    c.showPage()


def s09_competition(c):
    fill_bg(c)
    top_bar(c, C_VIOLET)

    section_tag(c, "COMPETITIVE LANDSCAPE", MARGIN, H - 22*mm, C_VIOLET)
    heading(c, "No One Owns MENA LegalTech AI", MARGIN, H - 38*mm, 22)
    subheading(c, "Global players ignore migrants. Local firms ignore AI. We do both.", MARGIN, H - 50*mm)

    # Table
    headers = ["Feature", "LitigaForge AI", "Harvey AI", "LexisNexis", "Local UAE Firms", "ChatGPT"]
    col_widths = [50*mm, 45*mm, 32*mm, 32*mm, 32*mm, 28*mm]
    row_h = 17
    table_x = MARGIN
    table_y = H - 63*mm

    # Header
    cx = table_x
    c.setFillColor(C_VIOLET)
    c.rect(cx, table_y, INNER_W, row_h, fill=1, stroke=0)
    for i, (h, cw) in enumerate(zip(headers, col_widths)):
        txt(c, h, cx + 3, table_y + 5, 8, C_WHITE, "Helvetica-Bold")
        cx += cw

    rows = [
        ("UAE / MENA Law coverage",  "✓ Deep",   "✗ None", "✓ Partial", "✓ Manual", "✗ Hallucinate"),
        ("Arabic language support",  "✓ Q4 '25", "✗",      "Limited",   "✓ Manual", "Partial"),
        ("Migrant-focused features", "✓ Built-in","✗",      "✗",         "✗",        "✗"),
        ("AI lawyer matching",       "✓ 0–100",  "✗",       "✗",         "✗",        "✗"),
        ("Document risk scoring",    "✓ AI",     "✓ Enterprise","✓ Basic","Manual",  "Not safe"),
        ("Labour dispute AI",        "✓ MOHRE",  "✗",       "✗",         "✗",        "Unsafe"),
        ("Free legal aid finder",    "✓ Built-in","✗",      "✗",         "✗",        "✗"),
        ("Pricing (MENA consumer)",  "AED 0–349","$500+/mo","$300+/mo", "AED 1K+/hr","$20/mo"),
        ("ADGM / DIFC coverage",     "✓ Roadmap","Partial", "✓ Partial", "Manual",   "✗"),
        ("Mobile PWA",               "✓",        "✗",       "✗",         "✗",        "Partial"),
    ]

    for ri, row in enumerate(rows):
        bg = C_BG if ri % 2 == 0 else C_SURF
        cx = table_x
        c.setFillColor(bg)
        c.rect(cx, table_y - row_h*(ri+1), INNER_W, row_h, fill=1, stroke=0)
        for ci, (cell, cw) in enumerate(zip(row, col_widths)):
            col = C_GREEN if cell.startswith("✓") else (C_RED if cell == "✗" else C_TEXT)
            f = "Helvetica-Bold" if ci == 0 else "Helvetica"
            c.setFont(f, 7.5)
            c.setFillColor(C_SUBTEXT if ci == 0 else col)
            c.drawString(cx + 3, table_y - row_h*(ri+1) + 5, cell)
            cx += cw

    # Moat card
    hy = table_y - row_h*(len(rows)+1) - 6*mm
    rounded_rect(c, MARGIN, hy - 22*mm, INNER_W, 20*mm, 5, HexColor("#100820"))
    c.setFillColor(C_VIOLET)
    c.rect(MARGIN, hy - 22*mm, 3, 20*mm, fill=1, stroke=0)
    txt(c, "OUR MOAT:", MARGIN + 6*mm, hy - 8*mm, 8.5, C_VIOLET, "Helvetica-Bold")
    txt(c, ("UAE-specific law corpus + multilingual AI (Arabic EN HI UR) + migrant-focused UX + "
            "consumer pricing (AED 139/mo vs $500+ for enterprise tools). Harvey targets BigLaw. We own the 99%."),
        MARGIN + 40*mm, hy - 8*mm, 8, C_TEXT)
    txt(c, ("No competitor addresses the 3.5M Abu Dhabi expat market with AI. This is a blue-ocean "
            "category — LegalTech AI for MENA migrants."),
        MARGIN + 6*mm, hy - 18*mm, 7.5, C_SUBTEXT)

    footer(c, 9)
    c.showPage()


def s10_team(c):
    fill_bg(c)
    top_bar(c, C_TEAL)

    section_tag(c, "FOUNDING TEAM", MARGIN, H - 22*mm, C_TEAL)
    heading(c, "Builder Who Understands\nBoth Law and AI", MARGIN, H - 40*mm, 22)

    # Founder card
    rounded_rect(c, MARGIN, H - 110*mm, INNER_W, 58*mm, 6, C_SURF)
    c.setFillColor(C_TEAL)
    c.circle(MARGIN + 18*mm, H - 72*mm, 17, fill=1, stroke=0)
    txt(c, "AR", MARGIN + 18*mm, H - 76*mm, 14, C_BG, "Helvetica-Bold", "center")
    txt(c, "Arif  —  Founder & CEO", MARGIN + 38*mm, H - 62*mm, 14, C_TEAL, "Helvetica-Bold")
    txt(c, "Full-stack AI Engineer · Legal Domain Expertise · Telangana, India",
        MARGIN + 38*mm, H - 73*mm, 9, C_SUBTEXT)
    bullets = [
        "Built entire LitigaForge stack solo — FastAPI, React 19, LangGraph, LiteLLM, PostgreSQL",
        "Deep knowledge of Indian courts, UAE-India dual jurisdiction (3.5M Indian migrants in UAE)",
        "AI integration: Anthropic Claude, Google Gemini, OpenAI GPT via production multi-LLM cascade",
        "LegalTech domain: NALSA, MOHRE complaints, eCourts API, IndianKanoon, ADGM law research",
    ]
    by = H - 86*mm
    for b in bullets:
        c.setFillColor(C_TEAL)
        c.circle(MARGIN + 38*mm + 4, by + 3, 2, fill=1, stroke=0)
        txt(c, b, MARGIN + 38*mm + 10, by, 8.5, C_TEXT)
        by -= 13

    # Hub71 asks for advisory
    txt(c, "ADVISORY BOARD — SEEKING VIA HUB71 NETWORK",
        MARGIN, H - 120*mm, 8, C_GOLD, "Helvetica-Bold")
    advisors = [
        (C_GOLD,   "UAE Licensed Advocate",
                   "ADGM / Federal court licensed lawyer\nfor regulatory guidance & content review"),
        (C_TEAL,   "MENA AI Investor",
                   "Gulf VC with legaltech / fintech\nportfolio for strategic guidance"),
        (C_VIOLET, "Arabic NLP Engineer",
                   "LLM fine-tuning for Arabic legal\ncorpus and MSA / Gulf dialect support"),
        (C_GOLD,   "UAE BD Lead",
                   "Ministry of Justice / ADGM / DIFC\nconnections for B2G pipeline"),
    ]
    aw = (INNER_W - 6*mm) / 4
    ax = MARGIN
    for col, role, desc in advisors:
        rounded_rect(c, ax, H - 175*mm, aw, 48*mm, 5, C_SURF2)
        c.setFillColor(col)
        c.rect(ax, H - 175*mm, aw, 2, fill=1, stroke=0)
        txt(c, role, ax + aw/2, H - 148*mm, 8.5, col, "Helvetica-Bold", "center")
        for i, line in enumerate(desc.split("\n")):
            txt(c, line, ax + aw/2, H - 160*mm - i*11, 7.5, C_SUBTEXT, align="center")
        ax += aw + 2*mm

    # Why now
    rounded_rect(c, MARGIN, H - 210*mm, INNER_W, 28*mm, 5, HexColor("#080d18"))
    c.setFillColor(C_TEAL)
    c.rect(MARGIN, H - 210*mm, 3, 28*mm, fill=1, stroke=0)
    txt(c, "WHY NOW?", MARGIN + 6*mm, H - 188*mm, 8, C_TEAL, "Helvetica-Bold")
    txt(c, ("UAE AI Strategy 2031 mandates AI adoption in public services. ADGM launched its AI governance "
            "framework in 2024. Hub71 has made AI its #1 priority sector. "
            "LitigaForge is the only AI-native legal platform built for the MENA migrant demographic — "
            "a market of 15M+ people with no current digital legal solution."),
        MARGIN + 6*mm, H - 200*mm, 8, C_TEXT)

    footer(c, 10)
    c.showPage()


def s11_fundraising(c):
    fill_bg(c)
    top_bar(c, C_GOLD)

    section_tag(c, "FUNDRAISING", MARGIN, H - 22*mm, C_GOLD)
    heading(c, "Raising $500,000 USD Seed Round", MARGIN, H - 38*mm, 24, C_GOLD)
    subheading(c, "Pre-Seed / Seed  ·  Convertible Note or SAFE  ·  Anchor: Hub71 portfolio",
               MARGIN, H - 51*mm)

    # Previous + Current
    rounded_rect(c, MARGIN, H - 100*mm, 62*mm, 38*mm, 5, C_SURF2)
    txt(c, "PREVIOUS FUNDING", MARGIN + 4*mm, H - 67*mm, 7.5, C_MUTED, "Helvetica-Bold")
    txt(c, "Bootstrapped", MARGIN + 4*mm, H - 78*mm, 16, C_WHITE, "Helvetica-Bold")
    txt(c, "Built MVP solo · Zero external capital", MARGIN + 4*mm, H - 89*mm, 7.5, C_SUBTEXT)

    rounded_rect(c, MARGIN + 66*mm, H - 100*mm, 90*mm, 38*mm, 5, HexColor("#0d1a08"))
    c.setFillColor(C_GOLD)
    c.rect(MARGIN + 66*mm, H - 100*mm, 90*mm, 3, fill=1, stroke=0)
    txt(c, "CURRENT RAISE", MARGIN + 70*mm, H - 67*mm, 7.5, C_GOLD, "Helvetica-Bold")
    txt(c, "$500,000 USD", MARGIN + 70*mm, H - 80*mm, 18, C_GOLD, "Helvetica-Bold")
    txt(c, "SAFE or Convertible Note · 18% discount",
        MARGIN + 70*mm, H - 91*mm, 7.5, C_SUBTEXT)

    # Use of funds pie + legend
    txt(c, "USE OF FUNDS", MARGIN + 160*mm, H - 67*mm, 7.5, C_GOLD, "Helvetica-Bold")
    uof_data   = [35, 30, 25, 10]
    uof_labels = ["Product/Eng 35%", "MENA GTM 30%", "Team 25%", "Ops 10%"]
    uof_colors = [C_VIOLET, C_TEAL, C_GREEN, C_GOLD]
    pie_chart(c, MARGIN + 162*mm, H - 115*mm, 65,
              uof_data, uof_labels, uof_colors)

    # Detailed use of funds table
    txt(c, "DETAILED ALLOCATION", MARGIN, H - 110*mm, 7.5, C_GOLD, "Helvetica-Bold")
    uses = [
        (C_VIOLET, "Product & Engineering  35%  ($175K)",
                   "Arabic NLP fine-tune · UAE law RAG corpus · ADGM/DIFC integration · Mobile app"),
        (C_TEAL,   "MENA Go-to-Market  30%  ($150K)",
                   "UAE lawyer network (500 verified advocates) · BD partnerships · Abu Dhabi office"),
        (C_GREEN,  "Team  25%  ($125K)",
                   "UAE Legal Advisor · Arabic NLP Engineer · MENA BD Lead · Operations Manager"),
        (C_GOLD,   "Operations  10%  ($50K)",
                   "ADGM entity setup · Legal & compliance · Cloud infrastructure scaling"),
    ]
    uy = H - 120*mm
    for col, utitle, udesc in uses:
        rounded_rect(c, MARGIN, uy - 22*mm, INNER_W * 0.75, 20*mm, 4, C_SURF)
        c.setFillColor(col)
        c.rect(MARGIN, uy - 22*mm, 3, 20*mm, fill=1, stroke=0)
        txt(c, utitle, MARGIN + 6*mm, uy - 9*mm, 8.5, col, "Helvetica-Bold")
        txt(c, udesc, MARGIN + 6*mm, uy - 17*mm, 7.5, C_SUBTEXT)
        uy -= 24*mm

    # 18-month targets
    divider(c, MARGIN, H - 230*mm, INNER_W, C_MUTED, 0.4)
    txt(c, "18-MONTH TARGETS POST-FUNDING", MARGIN, H - 235*mm, 7.5, C_GOLD, "Helvetica-Bold")
    targets = [
        (C_TEAL,   "500+",     "MENA Verified\nLawyers"),
        (C_GOLD,   "10,000+",  "Monthly Active\nUsers"),
        (C_GREEN,  "AED 500K", "Monthly Recurring\nRevenue"),
        (C_VIOLET, "3",        "UAE Govt\nPartnerships"),
        (C_TEAL,   "Series A", "Ready by\nMonth 18"),
    ]
    tx3 = MARGIN
    tw3 = (INNER_W - 8*mm) / 5
    for col, val, lbl in targets:
        icon_stat(c, tx3, H - 265*mm, val, lbl.replace("\n"," · "), col, tw3, 25*mm)
        tx3 += tw3 + 2*mm

    footer(c, 11)
    c.showPage()


def s12_hub71_plan(c):
    fill_bg(c)
    top_bar(c, C_HUB71)

    section_tag(c, "HUB71  ·  ABU DHABI PLAN", MARGIN, H - 22*mm, C_HUB71)
    heading(c, "What We'll Build from Abu Dhabi", MARGIN, H - 40*mm, 22)
    subheading(c, "12-month execution roadmap — starting day 1 of Hub71 cohort.", MARGIN, H - 52*mm)

    # Roadmap timeline
    phases = [
        (C_HUB71, "Month 1–2", "Foundation",
         ["Establish ADGM entity",
          "Onboard 20 UAE-licensed advocates",
          "Arabic UI beta launch",
          "UAE Federal Law RAG corpus v1"]),
        (C_TEAL, "Month 3–4", "Product Depth",
         ["UAE Legal Q&A live (Federal + Emirate)",
          "MOHRE Labour Dispute AI flow",
          "ADGM court document analyzer",
          "500 pilot users — Indian/Pak migrants"]),
        (C_GOLD, "Month 5–6", "Partnerships",
         ["ADGM Pro Bono Bureau integration",
          "DIFC court judgment database",
          "Ministry of Justice initial meetings",
          "First B2B API pilot (UAE law firm)"]),
        (C_VIOLET, "Month 7–9", "Scale",
         ["1,000 MAU — paying subscribers",
          "Arabic NLP LLM fine-tune launch",
          "UAE lawyer network: 500+ verified",
          "AED 100K MRR milestone"]),
        (C_GREEN, "Month 10–12", "Series A Prep",
         ["MOJ / ADGM pilot contract signed",
          "Saudi Arabia market entry",
          "AED 500K MRR target",
          "Series A raise initiated"]),
    ]

    pw = (INNER_W - 8*mm) / 5
    px = MARGIN
    for col, period, phase_name, phase_steps in phases:
        ph = 110*mm
        py = H - 68*mm
        rounded_rect(c, px, py - ph, pw, ph, 5, C_SURF)
        c.setFillColor(col)
        c.rect(px, py, pw, 4, fill=1, stroke=0)
        pill(c, px + pw/2 - 18*mm, py - 15, 36*mm, 11, col, period, 7)
        txt(c, phase_name, px + pw/2, py - 28, 9, C_WHITE, "Helvetica-Bold", "center")
        sy = py - 44
        for step in phase_steps:
            c.setFillColor(col)
            c.circle(px + 4*mm, sy + 3, 2, fill=1, stroke=0)
            wrap(c, step, px + 8*mm, sy, pw - 10*mm, 7.5, C_TEXT, 11)
            sy -= 22
        px += pw + 2*mm

    # What we need from Hub71
    rounded_rect(c, MARGIN, H - 195*mm, INNER_W, 78*mm, 6, C_SURF2)
    c.setFillColor(C_HUB71)
    c.rect(MARGIN, H - 195*mm, 3, 78*mm, fill=1, stroke=0)
    txt(c, "WHAT WE NEED FROM HUB71", MARGIN + 6*mm, H - 126*mm, 9, C_HUB71, "Helvetica-Bold")

    asks = [
        (C_HUB71, "Workspace & Incubation",       "Abu Dhabi presence to build UAE lawyer network and meet government partners in person"),
        (C_TEAL,  "Regulatory Sandbox",            "ADGM / DIFC / Ministry of Justice introductions for legal AI regulatory pilot programme"),
        (C_GOLD,  "Cloud Credits",                 "Microsoft Azure + AWS via Hub71 partnerships — target $100K+ for AI infrastructure scaling"),
        (C_VIOLET,"Investor Introductions",        "Warm intros to Hub71 MENA VC network for $500K seed and Series A pipeline"),
        (C_GREEN, "Government Connections",        "UAE Ministry of Justice · TAWTEEN · Abu Dhabi Digital Authority — B2G partnerships"),
        (C_HUB71, "MENA Mentor Network",           "UAE legal domain experts + Arabic NLP engineers + MENA legaltech/fintech operators"),
    ]
    ax2 = MARGIN + 6*mm
    ay = H - 140*mm
    for col, ask, desc in asks:
        c.setFillColor(col)
        c.circle(ax2 + 3, ay + 3, 3, fill=1, stroke=0)
        txt(c, ask + ":", ax2 + 8*mm, ay, 8.5, col, "Helvetica-Bold")
        txt(c, desc, ax2 + 8*mm + c.stringWidth(ask + ":  ", "Helvetica-Bold", 8.5), ay, 8, C_TEXT)
        ay -= 14

    footer(c, 12)
    c.showPage()


def s13_close(c):
    fill_bg(c)
    top_bar(c, C_GOLD, 6)
    bottom_bar(c, C_TEAL, 4)

    # Decorative circles top right
    for r, alpha in [(300, 0.04), (200, 0.06), (100, 0.09)]:
        c.setFillColor(Color(0.49, 0.38, 0.21, alpha))
        c.circle(W + 50, H - 100, r, fill=1, stroke=0)

    # Central message
    txt(c, "The Legal OS for MENA.", W/2, H * 0.72, 38, C_WHITE, "Helvetica-Bold", "center")
    c.setFillColor(C_GOLD)
    c.setFont("Helvetica-Bold", 38)
    c.drawCentredString(W/2, H * 0.63, "Built for Abu Dhabi.")

    txt(c, "3.5 million migrants deserve legal protection in a language they understand.",
        W/2, H * 0.55, 11, C_TEXT, align="center")
    txt(c, "LitigaForge AI makes that possible — with frontier LLMs, UAE law, and Arabic.",
        W/2, H * 0.51, 11, C_SUBTEXT, align="center")

    divider(c, W/2 - 50*mm, H * 0.48, 100*mm, C_GOLD, 1)

    # Contact card
    rounded_rect(c, W/2 - 60*mm, H * 0.33, 120*mm, 50, 6, C_SURF)
    txt(c, "litigaforge.com", W/2, H * 0.37 + 24, 14, C_TEAL, "Helvetica-Bold", "center")
    txt(c, "hub71@litigaforge.com", W/2, H * 0.37 + 10, 10, C_TEXT, align="center")

    # Hub71 badge bottom
    rounded_rect(c, W/2 - 48*mm, H * 0.19, 96*mm, 18*mm, 4, C_HUB71)
    txt(c, "Applying to Hub71 — AI Cohort 2025 / 2026",
        W/2, H * 0.19 + 6*mm, 10, C_WHITE, "Helvetica-Bold", "center")

    # Bottom row stats
    final_stats = [
        ("$500K",   "Seed Round"),
        ("AED 28B", "UAE Legal Market"),
        ("3.5M+",   "Addressable Users\nin Abu Dhabi"),
        ("Day 1",   "UAE Launch\nReady"),
    ]
    fw = 40*mm
    fx = W/2 - 2*fw - 9*mm
    for val, lbl in final_stats:
        txt(c, val, fx + fw/2, H * 0.12, 14, C_GOLD, "Helvetica-Bold", "center")
        for i, line in enumerate(lbl.split("\n")):
            txt(c, line, fx + fw/2, H * 0.12 - 14 - i*10, 7.5, C_SUBTEXT, align="center")
        fx += fw + 6*mm

    footer(c, 13)
    c.showPage()


# ── BUILD ─────────────────────────────────────────────────────────────────────

def build(out_path="litigaforge_hub71_pitchdeck.pdf"):
    c = pdfcanvas.Canvas(out_path, pagesize=A4)
    c.setTitle("LitigaForge AI — Hub71 Abu Dhabi Pitch Deck")
    c.setAuthor("LitigaForge AI")
    c.setSubject("Hub71 Investment Deck · AI Legal Platform · Abu Dhabi")
    c.setCreator("LitigaForge AI Generator")

    s01_cover(c)
    s02_abu_dhabi_problem(c)
    s03_ai_solution(c)
    s04_llm_tech(c)
    s05_market(c)
    s06_use_cases(c)
    s07_business_model(c)
    s08_traction(c)
    s09_competition(c)
    s10_team(c)
    s11_fundraising(c)
    s12_hub71_plan(c)
    s13_close(c)

    c.save()
    kb = os.path.getsize(out_path) / 1024
    print(f"✓  {out_path}  ({kb:.0f} KB, {SLIDE_TOTAL} slides)")


if __name__ == "__main__":
    build()
