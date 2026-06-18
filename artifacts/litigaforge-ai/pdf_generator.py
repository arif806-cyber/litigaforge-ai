"""
LitigaForge AI — PDF Generation Utilities
Generates court-ready professional PDFs for the Lawyer Package and 2-page Invoice.

Formatting spec (matches attached prompt):
  Paper   : A4
  Font    : Times Roman (fpdf2 built-in, Times New Roman equivalent)
  Body    : 12 pt  |  Headings : 14 pt
  Spacing : 1.5 line height
  Margins : Top/Bottom 2.5 cm  |  Left/Right 4.5 cm
  Align   : Justified body text
"""
from __future__ import annotations

import re
from datetime import datetime

from fpdf import FPDF

# ── Layout constants ──────────────────────────────────────────────────────────
MARGIN_L  = 45.0   # mm (4.5 cm)
MARGIN_R  = 45.0   # mm (4.5 cm)
MARGIN_T  = 25.0   # mm (2.5 cm)
MARGIN_B  = 25.0   # mm (2.5 cm)
LINE_H    = 7.5    # mm ≈ 1.5 × 12 pt
HDNG_H    = 9.0    # mm ≈ 1.5 × 14 pt
F_BODY    = 12
F_HEAD    = 14
F_SMALL   = 10
PAGE_W    = 210.0  # A4 mm
USABLE    = PAGE_W - MARGIN_L - MARGIN_R  # 120 mm

NAVY  = (26,  39,  68)
GOLD  = (176, 141,  33)
GREY  = (110, 110, 110)
BLACK = (0,   0,   0)
WHITE = (255, 255, 255)


# ── Text sanitiser ────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    """Strip markdown markers and convert Unicode to latin-1-safe equivalents."""
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__',     r'\1', text)
    text = re.sub(r'\*([^*]+)\*',     r'\1', text)
    text = re.sub(r'_([^_]+)_',       r'\1', text)
    _MAP = {
        '\u20b9': 'Rs.', '\u2014': '--',   '\u2013': '-',   '\u2019': "'",
        '\u2018': "'",   '\u201c': '"',    '\u201d': '"',   '\u2022': '-',
        '\u00b7': '-',   '\u2026': '...', '\u2192': '->',  '\u2190': '<-',
        '\u2713': '(v)', '\u2714': '(v)', '\u00a0': ' ',   '\u00ae': '(R)',
        '\u2122': '(TM)','\u00b0': ' deg','\u00d7': 'x',   '\u2264': '<=',
        '\u2265': '>=',  '\u00a7': 'S.',  '\u00b6': 'Para','\u2116': 'No.',
        '\u00bc': '1/4', '\u00bd': '1/2', '\u00be': '3/4',
    }
    for u, a in _MAP.items():
        text = text.replace(u, a)
    return text.encode('latin-1', errors='replace').decode('latin-1')


# ── Base PDF class ────────────────────────────────────────────────────────────

class _LFBase(FPDF):
    def __init__(self, doc_title: str = "", case_ref: str = ""):
        super().__init__(format='A4')
        self.doc_title = doc_title or "Lawyer Package"
        self.case_ref  = case_ref or ""
        self.set_margins(MARGIN_L, MARGIN_T, MARGIN_R)
        self.set_auto_page_break(auto=True, margin=MARGIN_B)

    # --- header / footer -------------------------------------------------------

    def header(self):
        self.set_draw_color(*GOLD)
        self.set_line_width(0.6)
        self.line(MARGIN_L, 14, PAGE_W - MARGIN_R, 14)
        self.set_font('Times', 'B', F_SMALL)
        self.set_text_color(*NAVY)
        self.set_xy(MARGIN_L, 7)
        self.cell(USABLE / 2, 5, _clean(self.doc_title[:55]), align='L')
        if self.case_ref:
            self.set_x(MARGIN_L + USABLE / 2)
            self.set_font('Times', '', F_SMALL)
            self.cell(USABLE / 2, 5, _clean(self.case_ref[:55]), align='R')
        self.set_text_color(*BLACK)

    def footer(self):
        self.set_y(-13)
        self.set_font('Times', 'I', F_SMALL - 1)
        self.set_text_color(*GREY)
        self.cell(0, 5,
            f'Page {self.page_no()} | LitigaForge AI | {datetime.now().strftime("%d %b %Y")}',
            align='C')
        self.set_text_color(*BLACK)

    # --- helpers ---------------------------------------------------------------

    def section_heading(self, title: str):
        self.ln(6)
        self.set_font('Times', 'B', F_HEAD)
        self.set_text_color(*NAVY)
        self.multi_cell(USABLE, HDNG_H, _clean(title.upper()), align='L')
        self.set_draw_color(*GOLD)
        self.set_line_width(0.4)
        y = self.get_y()
        self.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)
        self.ln(4)
        self.set_text_color(*BLACK)

    def body(self, text: str, align: str = 'J'):
        self.set_font('Times', '', F_BODY)
        self.set_text_color(*BLACK)
        for raw_line in _clean(text).split('\n'):
            line = raw_line.strip()
            if not line:
                self.ln(3)
                continue
            if (re.match(r'^[A-Z][A-Z\s/&.()\-]{4,}:$', line)
                    or re.match(r'^Phase \d+', line, re.I)
                    or re.match(r'^\([a-z]\)\s', line)):
                self.set_font('Times', 'B', F_BODY)
                self.multi_cell(USABLE, LINE_H, line, align='L')
                self.set_font('Times', '', F_BODY)
            else:
                self.multi_cell(USABLE, LINE_H, line, align=align)

    def rule(self):
        self.ln(2)
        self.set_draw_color(*GREY)
        self.set_line_width(0.2)
        self.line(MARGIN_L, self.get_y(), PAGE_W - MARGIN_R, self.get_y())
        self.ln(2)


# ── Section parser ────────────────────────────────────────────────────────────

_KEYS = [
    "EXECUTIVE SUMMARY",
    "CLIENT ADVISORY",
    "DOCUMENT CHECKLIST",
    "ACTION PLAN",
    "DRAFT PETITION",
    "FEE RECOMMENDATION",
]


def _parse_sections(text: str) -> dict[str, str]:
    pat = r'(?:^|\n)(' + '|'.join(re.escape(k) for k in _KEYS) + r'):\s*'
    parts = re.split(pat, text, flags=re.IGNORECASE)
    result: dict[str, str] = {}
    i = 1
    while i < len(parts) - 1:
        key   = parts[i].upper().strip()
        value = parts[i + 1].strip()
        if key in _KEYS:
            result[key] = value
        i += 2
    return result


# ── Lawyer Package PDF ────────────────────────────────────────────────────────

def generate_lawyer_package_pdf(
    case_description: str,
    drafting_text: str,
    lawyer_name: str = "",
    client_name: str = "",
) -> bytes:
    """Generate a complete court-ready Lawyer Package PDF from Drafting Agent output."""

    sections  = _parse_sections(drafting_text)
    case_short = (case_description[:68] + '…') if len(case_description) > 68 else case_description

    pdf = _LFBase(
        doc_title="LitigaForge AI -- Lawyer Package",
        case_ref=case_short,
    )

    # ── Cover page ────────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.ln(22)

    pdf.set_font('Times', 'B', 22)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, 14, 'LAWYER PACKAGE', align='C')
    pdf.set_font('Times', 'I', 13)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, 8, 'Prepared by LitigaForge AI', align='C')
    pdf.ln(4)

    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(1.0)
    cx = MARGIN_L + USABLE / 2 - 30
    pdf.line(cx, pdf.get_y(), cx + 60, pdf.get_y())
    pdf.ln(14)

    pdf.set_font('Times', '', F_BODY)
    pdf.set_text_color(*BLACK)
    if client_name:
        pdf.multi_cell(USABLE, LINE_H, f'Client: {_clean(client_name)}', align='L')
    pdf.multi_cell(USABLE, LINE_H, f'Case: {_clean(case_description[:220])}', align='L')
    pdf.multi_cell(USABLE, LINE_H, f'Date: {datetime.now().strftime("%d %B %Y")}', align='L')
    if lawyer_name:
        pdf.multi_cell(USABLE, LINE_H, f'Prepared for: {_clean(lawyer_name)}', align='L')
    pdf.ln(10)

    # Table of contents
    pdf.set_font('Times', 'B', F_BODY)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, LINE_H, 'CONTENTS', align='L')
    pdf.set_text_color(*BLACK)
    pdf.set_font('Times', '', F_BODY)
    pdf.ln(2)

    _TOC = [
        ("EXECUTIVE SUMMARY",  "1.  Executive Summary & Strategy"),
        ("CLIENT ADVISORY",    "2.  Client Advisory Note"),
        ("DOCUMENT CHECKLIST", "3.  Document Checklist"),
        ("ACTION PLAN",        "4.  Action Plan & Timeline"),
        ("DRAFT PETITION",     "5.  Draft Petition"),
        ("FEE RECOMMENDATION", "6.  Fee Recommendation"),
    ]
    for key, label in _TOC:
        if key in sections:
            pdf.multi_cell(USABLE, LINE_H, f'    {label}', align='L')

    # ── Content pages ─────────────────────────────────────────────────────────
    _LABELS = {
        "EXECUTIVE SUMMARY":  "Executive Summary & Strategy",
        "CLIENT ADVISORY":    "Client Advisory Note",
        "DOCUMENT CHECKLIST": "Document Checklist",
        "ACTION PLAN":        "Action Plan & Timeline",
        "DRAFT PETITION":     "Draft Petition",
        "FEE RECOMMENDATION": "Fee Recommendation",
    }
    for key in _KEYS:
        content = sections.get(key, "")
        if not content:
            continue
        pdf.add_page()
        pdf.section_heading(_LABELS[key])
        pdf.body(content)

    # ── Verification block ────────────────────────────────────────────────────
    pdf.ln(10)
    pdf.rule()
    pdf.set_font('Times', 'B', F_BODY)
    pdf.multi_cell(USABLE, LINE_H, 'VERIFICATION', align='L')
    pdf.ln(2)
    pdf.set_font('Times', '', F_BODY)
    pdf.multi_cell(USABLE, LINE_H,
        'I, the Advocate, hereby verify that the contents of this package are '
        'prepared based on the facts provided and applicable laws, to the best '
        'of my knowledge and belief.',
        align='J')
    pdf.ln(8)
    pdf.multi_cell(USABLE, LINE_H,
        f'Place: Hyderabad / [City]               Date: {datetime.now().strftime("%d/%m/%Y")}',
        align='L')
    pdf.ln(10)
    pdf.multi_cell(USABLE, LINE_H, '_' * 30, align='R')
    pdf.multi_cell(USABLE, LINE_H,
        _clean(lawyer_name) if lawyer_name else '[Advocate Name & Seal]', align='R')
    pdf.multi_cell(USABLE, LINE_H, 'Advocate', align='R')

    return bytes(pdf.output())


# ── Invoice PDF ───────────────────────────────────────────────────────────────

def generate_invoice_pdf(
    client_name:      str,
    lawyer_name:      str,
    lawyer_firm:      str,
    lawyer_contact:   str,
    case_description: str,
    amount:           float,
    payment_mode:     str,
    invoice_date:     str,
    case_type:        str,
    fee_tier:         str,
    fee_recommendation: str = "",
) -> bytes:
    """Generate a 2-page professional invoice PDF (client-facing + internal analyst page)."""

    pdf = _LFBase(
        doc_title="LitigaForge AI -- Invoice",
        case_ref=_clean(client_name[:40]) if client_name else "Client",
    )
    date_str = invoice_date or datetime.now().strftime('%d %B %Y')

    # ── Page 1: Client-Facing Invoice ────────────────────────────────────────
    pdf.add_page()
    pdf.ln(6)

    pdf.set_font('Times', 'B', 18)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, 12, 'LEGAL SERVICES INVOICE', align='C')
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.8)
    pdf.line(MARGIN_L, pdf.get_y() + 2, PAGE_W - MARGIN_R, pdf.get_y() + 2)
    pdf.ln(10)
    pdf.set_text_color(*BLACK)

    def _row(label: str, value: str):
        y0 = pdf.get_y()
        pdf.set_font('Times', 'B', F_BODY)
        pdf.set_xy(MARGIN_L, y0)
        pdf.cell(38, LINE_H, _clean(label), align='L')
        pdf.set_font('Times', '', F_BODY)
        pdf.set_xy(MARGIN_L + 40, y0)
        pdf.multi_cell(USABLE - 40, LINE_H, _clean(value), align='L')

    _row('From:',         f'{lawyer_name}\n{lawyer_firm}\n{lawyer_contact}')
    pdf.ln(2)
    _row('To (Client):', client_name)
    pdf.ln(1)
    _row('Invoice Date:', date_str)
    _row('Matter:',      case_description[:80])
    pdf.ln(6)

    # Fee table
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font('Times', 'B', F_BODY)
    pdf.cell(USABLE, 8, '  PROFESSIONAL FEE DETAILS', fill=True, ln=True)
    pdf.set_text_color(*BLACK)
    pdf.set_font('Times', '', F_BODY)

    desc = f'Legal representation -- {case_type}' if case_type else 'Legal representation'
    pdf.cell(USABLE * 0.72, LINE_H, f'  {_clean(desc)}', border='B')
    pdf.cell(USABLE * 0.28, LINE_H, f'Rs. {amount:,.0f}', border='B', align='R', ln=True)

    pdf.set_font('Times', 'B', F_BODY)
    pdf.cell(USABLE * 0.72, LINE_H + 2, '  TOTAL (all inclusive)', border='T')
    pdf.cell(USABLE * 0.28, LINE_H + 2, f'Rs. {amount:,.0f}/-', border='T', align='R', ln=True)
    pdf.ln(6)

    pdf.set_font('Times', '', F_BODY)
    mode = payment_mode or 'UPI / NEFT / Cash (receipt issued on payment)'
    pdf.multi_cell(USABLE, LINE_H, f'Payment Mode: {_clean(mode)}', align='L')
    pdf.ln(3)

    pdf.set_font('Times', 'I', F_SMALL)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, LINE_H - 1,
        'GST @ 18% applicable if Advocate\'s annual turnover exceeds Rs. 20 lakhs.', align='J')
    pdf.set_text_color(*BLACK)
    pdf.ln(6)

    pdf.set_font('Times', 'I', F_BODY)
    pdf.multi_cell(USABLE, LINE_H,
        'Thank you for entrusting us with your legal matter. '
        'We remain committed to the highest standards of legal representation.',
        align='J')
    pdf.ln(10)
    pdf.set_font('Times', '', F_BODY)
    pdf.multi_cell(USABLE, LINE_H, '_' * 30, align='R')
    pdf.multi_cell(USABLE, LINE_H, _clean(lawyer_name or '[Advocate Name]'), align='R')
    pdf.multi_cell(USABLE, LINE_H, 'Advocate (Signature & Seal)', align='R')

    # ── Page 2: Internal Analyst Page ────────────────────────────────────────
    pdf.add_page()
    pdf.ln(4)

    pdf.set_font('Times', 'B', 14)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, HDNG_H, 'INTERNAL -- FEE ANALYSIS & CASE NOTES', align='C')
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.4)
    pdf.line(MARGIN_L, pdf.get_y() + 2, PAGE_W - MARGIN_R, pdf.get_y() + 2)
    pdf.ln(8)
    pdf.set_text_color(*BLACK)

    pdf.set_font('Times', 'B', F_BODY)
    pdf.multi_cell(USABLE, LINE_H, 'Case Type & Fee Tier Selected:', align='L')
    pdf.set_font('Times', '', F_BODY)
    pdf.multi_cell(USABLE, LINE_H,
        f'{_clean(case_type) or "[Case Type]"}  |  Fee Tier: {_clean(fee_tier) or "Standard"}',
        align='L')
    pdf.ln(4)

    pdf.set_font('Times', 'B', F_BODY)
    pdf.multi_cell(USABLE, LINE_H, 'AI Fee Recommendation (LitigaForge Analysis):', align='L')
    pdf.set_font('Times', '', F_BODY)
    if fee_recommendation:
        pdf.multi_cell(USABLE, LINE_H, _clean(fee_recommendation[:700]), align='J')
    else:
        pdf.multi_cell(USABLE, LINE_H,
            'Conservative (minimum): Rs. [AI-suggested min]\n'
            'Standard (recommended): Rs. [AI-suggested std]\n'
            'Premium (complex / senior): Rs. [AI-suggested prem]\n'
            f'Selected: Rs. {amount:,.0f} -- within Hyderabad/Telangana market range.',
            align='J')
    pdf.ln(4)

    pdf.set_font('Times', 'B', F_BODY)
    pdf.multi_cell(USABLE, LINE_H, 'Important Reminders:', align='L')
    pdf.set_font('Times', '', F_BODY)
    pdf.multi_cell(USABLE, LINE_H,
        '1. Retain a signed copy of this invoice in the client file.\n'
        '2. Issue a separate receipt once payment is received.\n'
        '3. Maintain a ledger entry for this matter.\n'
        '4. If GST-registered, issue a proper tax invoice with GSTIN.\n'
        '5. Keep all expense vouchers (court fees, stamp duty, filing charges).',
        align='J')
    pdf.ln(10)
    pdf.rule()
    pdf.set_font('Times', 'I', F_SMALL)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, LINE_H - 1,
        f'Generated by LitigaForge AI -- {datetime.now().strftime("%d %B %Y at %H:%M")} IST. '
        'AI-assisted document -- verify all figures before use.',
        align='C')

    return bytes(pdf.output())


# ── Vakalatnama (Power of Attorney) PDF ───────────────────────────────────────

def generate_vakalatnama_pdf(
    case_description: str,
    client_name:      str = "",
    lawyer_name:      str = "",
    bar_number:       str = "",
    court_name:       str = "",
) -> bytes:
    """Generate a standard Indian Vakalatnama (Power of Attorney) PDF."""

    pdf = _LFBase(
        doc_title="Vakalatnama -- Power of Attorney",
        case_ref=_clean(client_name[:40]) if client_name else "Client",
    )
    pdf.add_page()

    pdf.ln(10)
    pdf.set_font('Times', 'B', 20)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, 13, 'VAKALATNAMA', align='C')
    pdf.set_font('Times', 'I', 12)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, 8, '(Power of Attorney -- Authority to Appear and Act)', align='C')
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.8)
    pdf.line(MARGIN_L, pdf.get_y() + 3, PAGE_W - MARGIN_R, pdf.get_y() + 3)
    pdf.ln(12)
    pdf.set_text_color(*BLACK)

    cn  = _clean(client_name  or "[Client Full Name]")
    ln_ = _clean(lawyer_name  or "[Advocate Full Name]")
    bar = _clean(bar_number   or "[Bar Enrolment No.]")
    ct  = _clean(court_name   or "the Honourable Court / Tribunal")
    cd  = _clean((case_description[:200] + '...') if len(case_description) > 200 else case_description)

    paras = [
        f"I / We, {cn}, the Petitioner(s)/Complainant(s)/Applicant(s)/Defendant(s) "
        f"in the above-mentioned case, do hereby appoint, nominate and authorise "
        f"Advocate {ln_} (Bar Enrolment No. {bar}) as my/our counsel to appear, "
        f"plead and act for me/us in {ct} in connection with the following matter:",

        f"SUBJECT MATTER: {cd}",

        "I/We hereby authorise the said Advocate to:",
        "(a) Appear, plead and act for and on my/our behalf in all proceedings in "
        "the above-referenced matter, including any appeals or revisions arising therefrom;",
        "(b) File, sign and present any petitions, applications, affidavits, documents, "
        "written statements, written arguments, and all other papers in the said Court or Tribunal;",
        "(c) Withdraw, compromise, settle or refer the said matter to arbitration or "
        "mediation with my/our prior written consent;",
        "(d) Receive notice, summons and processes on my/our behalf;",
        "(e) Take all steps and do all acts and things necessary or expedient for "
        "the conduct and prosecution/defence of the said case.",

        "I/We agree to ratify and confirm all acts, deeds and proceedings lawfully "
        "done or caused to be done by the said Advocate in pursuance of this authority.",

        "This Vakalatnama is valid until revoked in writing or until the conclusion "
        "of the proceedings in the above-referenced matter, including any appeals.",
    ]
    pdf.set_font('Times', '', F_BODY)
    for p in paras:
        pdf.multi_cell(USABLE, LINE_H, p, align='J')
        pdf.ln(3)

    pdf.ln(8)
    pdf.rule()
    pdf.ln(6)
    pdf.set_font('Times', '', F_BODY)
    pdf.multi_cell(USABLE, LINE_H,
        f'Place: Hyderabad / [City]               Date: {datetime.now().strftime("%d/%m/%Y")}',
        align='L')
    pdf.ln(10)

    half = USABLE / 2
    y0 = pdf.get_y()
    pdf.set_font('Times', 'B', F_BODY)
    pdf.set_xy(MARGIN_L, y0)
    pdf.cell(half, LINE_H, 'CLIENT SIGNATURE', align='C')
    pdf.set_xy(MARGIN_L + half, y0)
    pdf.cell(half, LINE_H, 'ADVOCATE ACCEPTANCE', align='C')
    pdf.ln(12)

    y1 = pdf.get_y()
    pdf.set_font('Times', '', F_BODY)
    pdf.set_xy(MARGIN_L, y1)
    pdf.multi_cell(half, LINE_H,
        '_' * 25 + '\n' + cn + '\n(Signature / Thumb Impression)\n\n'
        'Witness 1: ___________________\nWitness 2: ___________________',
        align='C')
    pdf.set_xy(MARGIN_L + half, y1)
    pdf.multi_cell(half, LINE_H,
        '_' * 25 + '\n' + ln_ + '\n' + bar + '\n(Signature & Seal)',
        align='C')

    pdf.ln(12)
    pdf.set_font('Times', 'I', F_SMALL)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, LINE_H - 1,
        f'Generated by LitigaForge AI -- {datetime.now().strftime("%d %B %Y")}. '
        'Verify all details with your Advocate before signing. '
        'This document has no legal force until signed by both parties.',
        align='C')

    return bytes(pdf.output())


# ── Analysis Report PDF ───────────────────────────────────────────────────────

_AGENT_META = {
    "research":   ("Research Agent",       "Case Law & Legal Framework"),
    "strategy":   ("Strategy Agent",       "Winning Strategy & Arguments"),
    "risk":       ("Risk & Counter Agent", "Risk Assessment & Counter-Arguments"),
    "drafting":   ("Drafting Agent",       "Lawyer Package & Documents"),
    "compliance": ("Compliance Agent",     "Compliance & Procedural Checklist"),
}

def generate_analysis_report_pdf(
    case_description: str,
    agent_outputs:    dict,
) -> bytes:
    """Generate a combined Analysis Report PDF from all agents' outputs."""

    pdf = _LFBase(
        doc_title="LitigaForge AI -- Full Analysis Report",
        case_ref=_clean((case_description[:55] + '...') if len(case_description) > 55 else case_description),
    )

    # Cover page
    pdf.add_page()
    pdf.ln(22)
    pdf.set_font('Times', 'B', 22)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, 14, 'AI LEGAL ANALYSIS REPORT', align='C')
    pdf.set_font('Times', 'I', 13)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, 8, 'Multi-Agent Legal Intelligence -- LitigaForge AI', align='C')
    pdf.ln(4)
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(1.0)
    cx = MARGIN_L + USABLE / 2 - 30
    pdf.line(cx, pdf.get_y(), cx + 60, pdf.get_y())
    pdf.ln(14)
    pdf.set_font('Times', '', F_BODY)
    pdf.set_text_color(*BLACK)
    pdf.multi_cell(USABLE, LINE_H, f'Case Summary: {_clean(case_description[:300])}', align='J')
    pdf.ln(4)
    pdf.multi_cell(USABLE, LINE_H, f'Report Date: {datetime.now().strftime("%d %B %Y at %H:%M")} IST', align='L')
    pdf.multi_cell(USABLE, LINE_H, f'Agents Run: {len(agent_outputs)} of 5', align='L')
    pdf.ln(10)

    pdf.set_font('Times', 'B', F_BODY)
    pdf.set_text_color(*NAVY)
    pdf.multi_cell(USABLE, LINE_H, 'CONTENTS', align='L')
    pdf.set_text_color(*BLACK)
    pdf.set_font('Times', '', F_BODY)
    pdf.ln(2)
    ordered_ids = ["research", "strategy", "risk", "drafting", "compliance"]
    for i, aid in enumerate(ordered_ids, 1):
        if aid in agent_outputs:
            name, subtitle = _AGENT_META.get(aid, (aid.title(), ""))
            pdf.multi_cell(USABLE, LINE_H, f'    {i}. {name} -- {subtitle}', align='L')

    pdf.ln(4)
    pdf.set_font('Times', 'I', F_SMALL)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(USABLE, LINE_H - 1,
        'DISCLAIMER: This report is AI-generated and is intended solely as a research '
        'aid for qualified legal professionals. It does not constitute legal advice and '
        'must be reviewed and validated by a registered Advocate before use.',
        align='J')

    # One page per agent
    for aid in ordered_ids:
        text = agent_outputs.get(aid, "")
        if not text:
            continue
        name, subtitle = _AGENT_META.get(aid, (aid.title(), ""))
        pdf.add_page()
        pdf.section_heading(name)
        pdf.set_font('Times', 'I', F_BODY)
        pdf.set_text_color(*GREY)
        pdf.multi_cell(USABLE, LINE_H, _clean(subtitle), align='L')
        pdf.set_text_color(*BLACK)
        pdf.ln(4)
        pdf.body(text)

    return bytes(pdf.output())
