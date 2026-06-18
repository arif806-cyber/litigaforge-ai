"""
LitigaForge AI — Professional User Guide PDF Generator
Uses fpdf2 (2.8.3). Run: python3 scripts/generate_user_guide.py
Output: litigaforge_user_guide.pdf
"""
from fpdf import FPDF
import datetime

# ── Brand colours ──────────────────────────────────────────────────────────────
NAVY   = (26,  39,  68)    # #1a2744
AMBER  = (245, 158, 11)    # #f59e0b
TEAL   = (20,  184, 166)   # #14b8a6
WHITE  = (255, 255, 255)
LIGHT  = (248, 250, 252)   # #f8fafc
MUTED  = (100, 116, 139)   # #64748b
DARK   = (15,  23,  42)    # #0f172a
PURPLE = (168, 85,  247)   # #a855f7

TODAY  = datetime.date.today().strftime("%B %Y")

# ── Features data ──────────────────────────────────────────────────────────────
FEATURES = [
    {
        "num": "01",
        "icon": "FORGE WORKSPACE",
        "name": "AI Workspace (ForgeBoard)",
        "tagline": "5 specialised AI agents analyse your case on a live canvas",
        "overview": (
            "The ForgeBoard is LitigaForge AI's flagship feature — a multi-agent legal "
            "intelligence canvas. Five specialist AI agents (Research, Strategy, Risk & Counter, "
            "Drafting, and Predictive) work in parallel to analyse your case, surface relevant "
            "precedents from Indian Kanoon, build an argument map, and produce a consensus "
            "strategy score out of 100."
        ),
        "steps": [
            "Log in and click Workspace (lightning bolt icon) in the sidebar.",
            "Click '+ New Workspace' to create a session, or open an existing one.",
            "Type your case facts in the 'Describe your case' box on the left panel.",
            "Click the green 'Run Agent Analysis' button.",
            "Watch the five agents run in real-time — each card fills with analysis.",
            "After completion, explore the canvas nodes. Run 'What-If Simulation' to test scenarios.",
            "Your session auto-saves. A Case Folder is created with all outputs.",
        ],
        "usecase_title": "Case: Family Pension Rejection — Lalitha Devi v. State of Telangana",
        "usecase": (
            "Lalitha Devi's family pension claim was rejected because Form-5 was filed 7 days "
            "beyond the 90-day window after her late husband's retirement. She described the "
            "situation in ForgeBoard. The Research Agent surfaced CCS Pension Rules 1972 (Rule 54) "
            "and three CAT Hyderabad judgments where courts condoned similar delays. The Strategy "
            "Agent recommended filing a writ petition seeking quashing of the rejection order "
            "with a prayer for retrospective pension release. Consensus score: 78/100 — strong case."
        ),
        "tip": "Use the 'Twin' tab to build a Legal Twin profile for ongoing personalised guidance.",
    },
    {
        "num": "02",
        "icon": "MATCH & CONNECT",
        "name": "Client-Lawyer Matching",
        "tagline": "AI matches you with verified advocates — scored 0 to 100",
        "overview": (
            "LitigaForge AI's matching engine analyses your case requirements against the profiles "
            "of all verified advocates on the platform. Each match is assigned an AI score from "
            "0–100 based on practice area alignment, district proximity, language preference, "
            "experience, and availability. You can accept or decline proposals, and communicate "
            "directly via the in-platform chat."
        ),
        "steps": [
            "Go to 'Post a Case' from the sidebar and fill in the case type, description, budget range, and preferred district.",
            "Optionally enable 'Anonymous posting' to hide your identity until you accept a match.",
            "Submit the case. The AI engine scans all verified advocates and generates proposals within minutes.",
            "Visit 'My Cases' and click 'View Proposals' to see your matches.",
            "Click on an advocate's card to see their AI explanation, bar number, ratings, and hourly rate.",
            "Click 'Accept' to connect — a secure chat thread opens automatically.",
            "Communicate, share documents, and confirm engagement — all within LitigaForge AI.",
        ],
        "usecase_title": "Case: Hit-and-Run Accident Compensation — Ravi Kumar, Secunderabad",
        "usecase": (
            "Ravi Kumar's motorcycle was struck by a fleeing vehicle on NH-65. He posted a "
            "Motor Accident Claims case with a budget of Rs 5,000–10,000 and preferred Telugu "
            "communication. The AI matched him with an advocate from Secunderabad (score: 89/100) "
            "specialising in MACT cases with 14 years' experience. The AI explanation noted "
            "alignment on location, language, and 12 previously won MACT petitions. Ravi accepted "
            "the proposal and received a case assessment within the same day."
        ),
        "tip": "Verified advocates show a blue badge. Always check bar number and district before accepting.",
    },
    {
        "num": "03",
        "icon": "LEGAL Q&A",
        "name": "Legal Q&A",
        "tagline": "Instant AI answers to any legal question — community knowledge base",
        "overview": (
            "The Legal Q&A section lets anyone — even without an account — ask a legal question "
            "and receive an AI-generated answer within seconds. Answers are sourced through a "
            "multi-model AI cascade (Claude, Gemini, Groq) and draw on Indian statute law, court "
            "precedents, and regulatory guidelines. Answered questions are added to a community "
            "knowledge base that grows richer over time."
        ),
        "steps": [
            "Click 'Ask' in the sidebar (no login required for basic queries).",
            "Type your legal question in plain language — Hindi, Telugu, or English.",
            "Click 'Ask'. The AI provides an answer with citations within 10–15 seconds.",
            "Browse past answers by category (Consumer, Property, Labour, Criminal, etc.).",
            "Upvote helpful answers to surface them for other users.",
            "Log in to save your questions and receive follow-up updates.",
        ],
        "usecase_title": "Query: GST Input Tax Credit Reversal — Priya Textiles, Warangal",
        "usecase": (
            "Priya Sharma, proprietor of Priya Textiles, asked: 'Can a trader reverse ITC claimed "
            "on goods returned by buyer under GST?' The AI answered citing Section 16(2) and Rule "
            "37 of CGST Rules, explaining the ITC reversal obligation on buyer's part when credit "
            "notes are issued, and the 180-day payment rule. It recommended filing GSTR-2B "
            "reconciliation first. The question was saved to the Tax category and upvoted 14 times "
            "by other Warangal traders facing the same issue."
        ),
        "tip": "Prefix your question with your state for more localised answers (e.g., 'In Telangana...').",
    },
    {
        "num": "04",
        "icon": "DOCUMENT ANALYZER",
        "name": "Document Analyzer",
        "tagline": "Risk scoring, missing clauses, and recommendations for any legal document",
        "overview": (
            "Upload any legal document — an agreement, notice, contract, or court order — and "
            "the AI will analyse it for risk exposure, missing standard clauses, non-standard "
            "terms, and compliance gaps. Each document receives a risk score (0–100) and a "
            "prioritised recommendation list. No account required for basic scans."
        ),
        "steps": [
            "Click 'Review' (document icon) in the sidebar.",
            "Paste the document text into the analysis box, or type a summary.",
            "Click 'Analyse Document'.",
            "Review the Risk Score card — red (high risk), amber (medium), green (low).",
            "Read the 'Missing Clauses' section to identify gaps.",
            "Expand each 'Recommendation' card for plain-language explanations.",
            "Download or copy the full report for your records.",
        ],
        "usecase_title": "Document: Rental Agreement — Syed Iqbal, Hyderabad",
        "usecase": (
            "Syed Iqbal received a rental agreement for a commercial property in Banjara Hills. "
            "He pasted the 12-page document into the Analyzer. The AI flagged a Risk Score of "
            "67/100 — citing: (1) no force majeure clause, (2) unclear lock-in period language, "
            "(3) no dispute resolution mechanism, and (4) missing TDS deduction clause under "
            "Section 194-I. Recommendations included negotiating a 3-year lock-in cap and adding "
            "a mandatory arbitration clause under the Arbitration & Conciliation Act, 1996. "
            "Syed used the report to negotiate three amendments before signing."
        ),
        "tip": "For best results, paste the full document text — the AI can process up to 20,000 characters.",
    },
    {
        "num": "05",
        "icon": "JUDGMENT FINDER",
        "name": "Judgment Finder",
        "tagline": "Search Indian case law — precedents from SC, HC, and Tribunals",
        "overview": (
            "The Judgment Finder connects to India's largest legal database (Indian Kanoon) to "
            "surface relevant case law for your matter. You can search by keyword, party name, "
            "statute, or court. Each result includes a digest summary, key legal principles, and "
            "a link to the full judgment. The AI also highlights how each precedent applies to "
            "your specific facts."
        ),
        "steps": [
            "Click 'Judgments' in the sidebar.",
            "Enter keywords, party names, or the section of law you need precedents for.",
            "Click 'Search'. The AI returns up to 10 curated precedents.",
            "Click any result to see the full digest: facts, held, principle, and citation.",
            "Click 'View on Indian Kanoon' for the full text.",
            "Bookmark important judgments (logged-in users only).",
            "Inside ForgeBoard, the Research Agent automatically surfaces judgments during analysis.",
        ],
        "usecase_title": "Search: Consumer Forum Deficiency in Service — Vijaya Electronics, Nellore",
        "usecase": (
            "T. Subrahmanyam purchased a refrigerator from Vijaya Electronics, Nellore, that "
            "broke down within 6 months. The seller refused to honour the warranty. He searched "
            "for 'deficiency in service consumer forum refrigerator warranty' on the Judgment "
            "Finder. The AI surfaced National Consumer Disputes Redressal Commission orders "
            "including Whirlpool of India Ltd. v. Pooja Enterprises where compensation was "
            "awarded for warranty refusal. The digest noted the 2-year limitation period under "
            "the Consumer Protection Act, 2019. Subrahmanyam filed in the Nellore DCDRC with "
            "the citation and received an ex-parte order within 90 days."
        ),
        "tip": "Bookmark judgments inside ForgeBoard sessions — they become part of your case strategy.",
    },
    {
        "num": "06",
        "icon": "AI LEGAL CHAT",
        "name": "AI Legal Chat & Drafting",
        "tagline": "Draft legal notices, plaints, petitions, and responses in minutes",
        "overview": (
            "The AI Legal Chat is a real-time drafting assistant trained on Indian legal templates. "
            "Select from four starter templates (Demand Notice, Reply to Notice, Bail Application, "
            "Legal Opinion) or start a free-form conversation. The AI adapts the draft to your "
            "facts and jurisdiction. All outputs carry an automatic legal disclaimer."
        ),
        "steps": [
            "Click 'Legal Chat' (chat bubble icon) in the sidebar.",
            "Choose a template: Demand Notice, Reply to Notice, Bail Application, or Legal Opinion — or type freely.",
            "Describe your situation in the chat box.",
            "The AI generates a draft in standard legal format.",
            "Ask follow-up questions to refine specific clauses or add parties.",
            "Click 'Copy' to copy the draft, or paste it into any document editor.",
            "Always have a licensed advocate review the final draft before filing.",
        ],
        "usecase_title": "Draft: Legal Notice for Cheque Dishonour — K. Raghunath, Vijayawada",
        "usecase": (
            "K. Raghunath lent Rs 3,00,000 to a business associate whose cheque bounced on "
            "presentation. He opened AI Legal Chat, selected 'Demand Notice', and described "
            "the transaction dates, cheque number, and drawee's address. The AI generated a "
            "Section 138 Negotiable Instruments Act notice within 60 seconds — correctly "
            "formatted with a 15-day demand period, return memo details, and Vijayawada "
            "jurisdiction. Raghunath's advocate made two minor edits and dispatched it by "
            "registered post. The associate paid within the notice period."
        ),
        "tip": "Use the chat history to build on previous drafts — the AI remembers the thread context.",
    },
    {
        "num": "07",
        "icon": "CLIENT DASHBOARD",
        "name": "Client Dashboard & Case Tracking",
        "tagline": "Track every stage of your active cases with a visual timeline",
        "overview": (
            "The Client Dashboard is your command centre for all active legal matters. Each case "
            "shows a real-time stage timeline (Intake → Filed → Hearing → Judgment), upcoming "
            "hearing dates, assigned advocate details, match proposals awaiting decision, and "
            "all documents linked to the case. You can upload new documents directly and message "
            "your advocate through the in-platform chat."
        ),
        "steps": [
            "Log in as a Client and you land on the Client Dashboard automatically.",
            "The left sidebar shows all your active cases. Click any case to expand.",
            "The stage timeline bar shows the current stage highlighted in amber.",
            "Click 'Proposals' to see and act on pending match proposals.",
            "Click 'Documents' to upload case documents (PDF, JPG, PNG, DOCX).",
            "Tap the advocate's 'Contact' button to open the in-platform secure chat.",
            "The NALSA helpline number is always shown at the bottom for free legal aid.",
        ],
        "usecase_title": "Case: Cheque Bounce Recovery — M. Anitha, Karimnagar",
        "usecase": (
            "M. Anitha had a Section 138 NI Act complaint filed in the Karimnagar Judicial "
            "Magistrate Court. Her advocate updated the case stage to 'Hearing' after the "
            "summons was served. Anitha could see on her Client Dashboard that the next hearing "
            "was on 22 July, and the case was at 'Stage 3 of 5'. She uploaded the original "
            "cheque image and bank return memo directly to the case folder from her phone. "
            "Her advocate acknowledged receipt via the in-platform chat and confirmed the "
            "documents were sufficient for the next date."
        ),
        "tip": "Enable push notifications for hearing date reminders — go to Settings > Notifications.",
    },
    {
        "num": "08",
        "icon": "ADVOCATE DIRECTORY",
        "name": "Advocate Directory",
        "tagline": "Find and contact verified advocates across Telangana & Andhra Pradesh",
        "overview": (
            "The Advocate Directory lists all verified lawyers on the platform with their bar "
            "council registration, practice areas, districts covered, languages spoken, "
            "experience in years, hourly rate, and availability status. Each advocate has "
            "a rating from past clients. You can filter by any combination of these criteria "
            "to find the right advocate for your matter."
        ),
        "steps": [
            "Click 'Lawyers' in the sidebar.",
            "Use the filter row to select: District, Practice Area, Language, and Budget.",
            "Browse the advocate cards — verified advocates show a blue shield badge.",
            "Click an advocate's card to see full profile: bio, bar number, ratings, and hourly rate.",
            "Click 'Post a Case' to formally submit a case requirement that the advocate can respond to.",
            "Alternatively, advocates can register directly via 'Register as Advocate' for free.",
        ],
        "usecase_title": "Search: Property Dispute Lawyer — S. Padmavathi, Guntur",
        "usecase": (
            "S. Padmavathi needed an advocate for a property partition suit in Guntur District "
            "Court. She filtered the directory for District: Guntur, Practice Area: Property, "
            "Language: Telugu. Six verified advocates appeared. She selected one with 22 years' "
            "experience and a 4.8 rating from 31 clients. His bar number was verified against "
            "the Bar Council of Andhra Pradesh register. She posted the case and received his "
            "proposal within 4 hours with a fee estimate of Rs 8,000 for the first hearing."
        ),
        "tip": "Advocates with 'Verified' badge have had their bar number checked by the LitigaForge team.",
    },
    {
        "num": "09",
        "icon": "LEGAL AID",
        "name": "Legal Aid Finder",
        "tagline": "Free legal help through NALSA, TSLSA, and all 8 district legal services authorities",
        "overview": (
            "LitigaForge AI provides a built-in legal aid eligibility checker and directory. "
            "If you qualify under NALSA / TSLSA income criteria, you are entitled to free legal "
            "representation. The platform lists all 8 Telangana DLSA (District Legal Services "
            "Authority) contacts, the national NALSA helpline (1516), and the State helpline, "
            "so help is always one tap away."
        ),
        "steps": [
            "Click 'Legal Aid' in the sidebar.",
            "Run the Eligibility Wizard: answer 5 questions about income, category (SC/ST/Women/Disabled/Child), and case type.",
            "The wizard shows whether you qualify for free legal aid under Legal Services Authorities Act, 1987.",
            "If eligible, the nearest DLSA address, phone number, and email are shown.",
            "Call NALSA Toll-Free: 1516 (24x7) for immediate guidance.",
            "All TSLSA DLSA contacts are listed — Hyderabad, Warangal, Karimnagar, Nalgonda, Nizamabad, Khammam, Medak, Adilabad.",
        ],
        "usecase_title": "Eligibility Check: Domestic Violence Protection — Sunita Bai, Adilabad",
        "usecase": (
            "Sunita Bai, a tribal woman from Adilabad with monthly income below Rs 1 lakh, "
            "was facing domestic violence and needed urgent legal protection. She ran the "
            "Legal Aid Eligibility Wizard on LitigaForge AI. The wizard confirmed she qualified "
            "on two grounds: Scheduled Tribe category and domestic violence case type. The "
            "platform showed the Adilabad DLSA contact and address. She called 1516, was "
            "connected to a duty advocate within 20 minutes, and filed for a Protection Order "
            "under the Protection of Women from Domestic Violence Act, 2005 — at zero cost."
        ),
        "tip": "Women, children, SC/ST, and persons with disabilities always qualify regardless of income.",
    },
    {
        "num": "10",
        "icon": "FREE TEMPLATES",
        "name": "Free Document Templates",
        "tagline": "10 AI-powered legal document templates — filled dynamically with your facts",
        "overview": (
            "LitigaForge AI provides 10 free, professionally drafted document templates that "
            "the AI fills with your specific case details. Templates cover the most common "
            "Indian legal documents. Each template generates a ready-to-print PDF with all "
            "standard clauses, proper formatting, and party details auto-populated."
        ),
        "steps": [
            "Click 'Free Documents' in the sidebar.",
            "Browse the 10 template cards — each shows the document type and typical use case.",
            "Click 'Generate' on your chosen template.",
            "Fill in the dynamic form — the AI pre-populates fields based on your profile.",
            "Review the preview pane on the right.",
            "Click 'Download PDF' for the finished document.",
            "For more complex or custom documents, use the AI Legal Chat feature (Feature 06).",
        ],
        "usecase_title": "Template: Affidavit of Income — Ramesh Goud, Nizamabad",
        "usecase": (
            "Ramesh Goud needed an affidavit of income to apply for an OBC non-creamy layer "
            "certificate in Nizamabad. He opened Free Documents, selected the 'Affidavit of "
            "Income' template, and filled in his name, father's name, address, and annual "
            "income details. The AI generated a properly formatted affidavit on Rs 100 stamp "
            "paper template, mentioning the Telangana jurisdiction. Ramesh printed it, got "
            "it notarised, and submitted — saving the Rs 500 he would have paid a local "
            "typing centre."
        ),
        "tip": "Available templates: Demand Notice, Affidavit, Rent Agreement, Power of Attorney, Partnership Deed, NDA, Sale Agreement, Legal Heir Certificate application, Bail Application draft, and Consumer Complaint.",
    },
    {
        "num": "11",
        "icon": "SUBSCRIPTION",
        "name": "Subscription Plans",
        "tagline": "Choose the plan that matches your legal needs",
        "overview": (
            "LitigaForge AI offers three plans. The Free plan gives full access to Legal Q&A, "
            "Judgment Finder, Legal Aid, and basic templates. The Professional plan (Rs 999/month) "
            "adds unlimited AI analysis, document uploads, and priority matching. The Advocate Pro "
            "plan (Rs 2,499/month) is for practising advocates and adds case management tools, "
            "client portal access, and the full Lawyer Dashboard."
        ),
        "steps": [
            "Click your plan badge (top right) or go to 'Subscription' in the sidebar.",
            "Compare the three plan tiers on the plan comparison table.",
            "Click 'Upgrade' on your chosen plan.",
            "Pay securely via Razorpay (UPI, card, net banking, wallets all supported).",
            "Your new tier activates instantly after payment verification.",
            "To downgrade, visit Subscription and select a lower tier — effective from next billing cycle.",
        ],
        "usecase_title": "Upgrade: From Free to Professional — Meera Reddy, Hyderabad",
        "usecase": (
            "Meera Reddy used the Free plan for two months to research her property dispute. "
            "When her advocate requested 14 document uploads (Free limit: 5) and she needed "
            "priority matching for a second opinion, she upgraded to Professional at Rs 999/month "
            "via UPI. The upgrade confirmed instantly. She uploaded all 14 documents within "
            "minutes and received three new advocate proposals within 2 hours. The Professional "
            "plan paid for itself in the first month — a comparable consultation would have "
            "cost Rs 3,000."
        ),
        "tip": "Advocates on Advocate Pro get a verified badge, higher placement in search results, and the full Lawyer Dashboard for case and document management.",
    },
    {
        "num": "12",
        "icon": "DIGEST ALERTS",
        "name": "Judgment Digest & Email Alerts",
        "tagline": "Daily legal intelligence delivered to your inbox every morning at 7 AM",
        "overview": (
            "LitigaForge AI sends a curated Judgment Digest email every morning with new Supreme "
            "Court, High Court, and tribunal judgments relevant to your subscribed categories. "
            "Subscribe once, choose your areas of interest, and receive concise summaries with "
            "key principles and citation links — no full-text reading required. Double opt-in "
            "confirms your subscription."
        ),
        "steps": [
            "Go to 'Judgments' in the sidebar and scroll to 'Subscribe to Daily Digest'.",
            "Enter your email and select your preferred legal categories (e.g., Property, Criminal, Consumer, Labour).",
            "Click 'Subscribe'. A confirmation email arrives within 2 minutes — click the link to confirm.",
            "Every morning at 7:00 AM IST, you receive a digest with 3–5 new judgments.",
            "Each judgment in the email includes: case name, court, date, key principle, and a 'Read More' link.",
            "To unsubscribe, click 'Unsubscribe' in any digest email — takes effect immediately.",
        ],
        "usecase_title": "Alert: Property Law Update — Advocate Srikanth, Warangal",
        "usecase": (
            "Advocate G. Srikanth from Warangal subscribed to the Property and Revenue Law "
            "categories. On a Tuesday morning, the digest included a fresh Telangana High Court "
            "judgment on Section 89 Transfer of Property Act interpretation. He opened the "
            "summary before court, noted the key principle, and cited it in his arguments in "
            "the Warangal District Court that afternoon — a judgment his opponent had not yet "
            "encountered. The client complimented him on his thorough preparation. Srikanth "
            "credits the daily digest for keeping him ahead in a fast-moving practice."
        ),
        "tip": "The digest is free for all users. You can manage category preferences at any time from your profile settings.",
    },
]

# ── PDF class ──────────────────────────────────────────────────────────────────

class LitigaForgePDF(FPDF):

    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 10, 'F')
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*AMBER)
        self.set_xy(10, 2)
        self.cell(0, 6, 'LITIGAFORGE AI  |  USER GUIDE', ln=0, align='L')
        self.set_text_color(*WHITE)
        self.set_xy(0, 2)
        self.cell(200, 6, TODAY, ln=0, align='R')

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-12)
        self.set_fill_color(*NAVY)
        self.rect(0, 285, 210, 15, 'F')
        self.set_font('Helvetica', '', 7)
        self.set_text_color(*MUTED)
        self.set_xy(10, 287)
        self.cell(0, 6, 'For legal advice, always consult a qualified advocate. LitigaForge AI is an informational platform.', align='L')
        self.set_xy(0, 287)
        self.set_text_color(*AMBER)
        self.cell(200, 6, f'Page {self.page_no()}', align='R')


def make_pdf():
    pdf = LitigaForgePDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 18, 18)

    # ── COVER PAGE ──────────────────────────────────────────────────────────────
    pdf.add_page()

    # Full navy background
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 297, 'F')

    # Amber top stripe
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 0, 210, 3, 'F')

    # Brand mark (geometric square)
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, 28, 18, 18, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(22, 32, 10, 10, 'F')
    pdf.set_fill_color(*NAVY)
    pdf.rect(25, 35, 4, 4, 'F')

    # LitigaForge AI wordmark
    pdf.set_font('Helvetica', 'B', 26)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(40, 28)
    pdf.cell(0, 10, 'LitigaForge', ln=0)
    pdf.set_text_color(*AMBER)
    pdf.set_font('Helvetica', 'B', 26)
    pdf.cell(0, 10, ' AI', ln=1)

    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(148, 163, 184)
    pdf.set_xy(40, 40)
    pdf.cell(0, 6, 'Legal Intelligence for Telangana & Andhra Pradesh', ln=1)

    # Amber separator line
    pdf.set_fill_color(*AMBER)
    pdf.rect(18, 58, 60, 1.5, 'F')

    # Main title
    pdf.set_xy(18, 68)
    pdf.set_font('Helvetica', 'B', 38)
    pdf.set_text_color(*WHITE)
    pdf.multi_cell(174, 14, 'Complete\nUser Guide', align='L')

    # Subtitle
    pdf.set_xy(18, 108)
    pdf.set_font('Helvetica', '', 13)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, '12 Features  |  12 Real Case Studies', ln=1)

    # Feature pills row
    pills = ['AI Workspace', 'Lawyer Matching', 'Legal Q&A', 'Document Analyzer',
             'Judgment Finder', 'AI Drafting', 'Case Tracking', 'Legal Aid']
    pdf.set_xy(18, 126)
    x = 18
    for p in pills:
        pdf.set_fill_color(255, 255, 255, )
        pdf.set_fill_color(30, 50, 90)
        pdf.set_text_color(*TEAL)
        pdf.set_font('Helvetica', 'B', 7.5)
        w = pdf.get_string_width(p) + 10
        pdf.set_xy(x, 126)
        pdf.cell(w, 7, p, border=0, fill=True, align='C')
        x += w + 4
        if x > 170:
            x = 18
            pdf.set_xy(x, 135)

    # Large decorative element
    pdf.set_fill_color(20, 40, 80)
    pdf.ellipse(130, 150, 120, 120, 'F')
    pdf.set_fill_color(15, 30, 65)
    pdf.ellipse(150, 170, 80, 80, 'F')
    pdf.set_text_color(*TEAL)
    pdf.set_font('Helvetica', 'B', 60)
    pdf.set_xy(138, 178)
    pdf.cell(60, 20, '\u26a1', align='C')

    # Stats bar
    pdf.set_fill_color(20, 40, 80)
    pdf.rect(0, 230, 210, 30, 'F')
    stats = [('12', 'Features'), ('5', 'AI Agents'), ('3', 'AI Models'), ('2', 'States Covered')]
    for i, (num, label) in enumerate(stats):
        x = 18 + i * 46
        pdf.set_xy(x, 234)
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(*AMBER)
        pdf.cell(40, 8, num, align='C')
        pdf.set_xy(x, 243)
        pdf.set_font('Helvetica', '', 7.5)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(40, 6, label, align='C')

    # Bottom amber bar
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 265, 210, 1, 'F')

    # Version / date
    pdf.set_xy(18, 270)
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, f'Version 1.0  |  {TODAY}  |  litigaforge.com', align='L')
    pdf.set_xy(0, 270)
    pdf.set_text_color(*TEAL)
    pdf.cell(192, 6, 'legal@litigaforge.com', align='R')

    # ── ABOUT PAGE ─────────────────────────────────────────────────────────────
    pdf.add_page()

    # Section title
    _section_title(pdf, 'About LitigaForge AI')

    pdf.set_font('Helvetica', '', 10.5)
    pdf.set_text_color(*DARK)
    about_text = (
        "LitigaForge AI is an end-to-end legal technology platform built specifically for "
        "litigants, advocates, and legal professionals in Telangana and Andhra Pradesh. "
        "It combines cutting-edge AI (Claude Sonnet, Gemini 2.5 Flash, Groq Llama) with "
        "deep knowledge of Indian statute law, court procedures, and regional legal nuances "
        "to provide intelligence that is both legally accurate and locally relevant.\n\n"
        "Whether you are a first-time litigant who needs free legal aid, a seasoned advocate "
        "who wants AI-powered case strategy, or a business owner who needs a contract reviewed — "
        "LitigaForge AI has a feature built for your exact situation."
    )
    pdf.multi_cell(174, 6, about_text)
    pdf.ln(5)

    # Three pillars
    pillars = [
        (TEAL,   'Find', 'Discover verified advocates, precedents, legal aid contacts, and government resources in seconds.'),
        (AMBER,  'Analyse', 'Run 5-agent AI analysis on your case. Score arguments. Simulate what-if scenarios.'),
        (PURPLE, 'Act', 'Draft notices, file complaints, track hearings, and collaborate securely with your advocate.'),
    ]
    col_w = 54
    pdf.set_xy(18, pdf.get_y())
    start_y = pdf.get_y()
    for i, (color, title, desc) in enumerate(pillars):
        x = 18 + i * (col_w + 6)
        pdf.set_fill_color(*color)
        pdf.rect(x, start_y, col_w, 2, 'F')
        pdf.set_xy(x, start_y + 5)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(*color)
        pdf.cell(col_w, 7, title, align='L')
        pdf.set_xy(x, start_y + 13)
        pdf.set_font('Helvetica', '', 8.5)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(col_w, 5, desc)
    pdf.set_y(start_y + 44)
    pdf.ln(4)

    # Getting started box
    pdf.set_fill_color(248, 250, 252)
    box_y = pdf.get_y()
    pdf.rect(18, box_y, 174, 45, 'F')
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, box_y, 3, 45, 'F')
    pdf.set_xy(25, box_y + 5)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 6, 'Getting Started in 3 Steps', ln=1)
    steps = [
        ('1', 'Create your free account at litigaforge.com — no credit card required.'),
        ('2', 'Choose your role: Client (I need legal help) or Advocate (I am a lawyer).'),
        ('3', 'Explore any feature from the sidebar — everything is accessible immediately.'),
    ]
    for num, step in steps:
        pdf.set_xy(25, pdf.get_y())
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*TEAL)
        pdf.cell(7, 6, num + '.', ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(160, 6, step)

    pdf.ln(8)

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────────────
    _section_title(pdf, 'Table of Contents')
    pdf.ln(2)

    for i, f in enumerate(FEATURES):
        y = pdf.get_y()
        pdf.set_fill_color(*LIGHT)
        if i % 2 == 0:
            pdf.rect(18, y, 174, 9, 'F')
        pdf.set_xy(18, y + 1.5)
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(12, 6, f['num'], ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*DARK)
        pdf.cell(130, 6, f['name'], ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(32, 6, f'Feature {f["num"]}', align='R', ln=1)

    # ── FEATURE PAGES ──────────────────────────────────────────────────────────
    for f in FEATURES:
        pdf.add_page()

        # Feature number banner (navy bar)
        pdf.set_fill_color(*NAVY)
        pdf.rect(0, 0, 210, 22, 'F')
        pdf.set_fill_color(*AMBER)
        pdf.rect(0, 22, 210, 2, 'F')

        # Feature number
        pdf.set_xy(18, 4)
        pdf.set_font('Helvetica', 'B', 28)
        pdf.set_text_color(*AMBER)
        pdf.cell(22, 15, f['num'], ln=0)

        # Feature category badge
        pdf.set_xy(42, 5)
        pdf.set_font('Helvetica', 'B', 6.5)
        pdf.set_text_color(*TEAL)
        pdf.cell(0, 5, f['icon'], ln=0)

        # Feature name
        pdf.set_xy(42, 11)
        pdf.set_font('Helvetica', 'B', 14)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 7, f['name'], ln=0)

        pdf.set_y(28)

        # Tagline
        pdf.set_fill_color(*LIGHT)
        pdf.rect(18, 27, 174, 10, 'F')
        pdf.set_fill_color(*TEAL)
        pdf.rect(18, 27, 2, 10, 'F')
        pdf.set_xy(24, 28)
        pdf.set_font('Helvetica', 'I', 9.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 8, f['tagline'], ln=1)

        pdf.ln(4)

        # Overview
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, 'OVERVIEW', ln=1)
        pdf.set_font('Helvetica', '', 9.5)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(174, 5.5, f['overview'])
        pdf.ln(5)

        # How to use
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, 'HOW TO USE — STEP BY STEP', ln=1)

        for idx, step in enumerate(f['steps']):
            step_y = pdf.get_y()
            # Circle bullet
            pdf.set_fill_color(*TEAL)
            pdf.rect(18, step_y + 0.5, 5, 5, 'F')
            pdf.set_xy(18, step_y + 0.5)
            pdf.set_font('Helvetica', 'B', 6.5)
            pdf.set_text_color(*WHITE)
            pdf.cell(5, 5, str(idx + 1), align='C', ln=0)
            pdf.set_xy(26, step_y)
            pdf.set_font('Helvetica', '', 9.5)
            pdf.set_text_color(*DARK)
            pdf.multi_cell(166, 5.5, step)
            pdf.ln(1)

        pdf.ln(4)

        # Use case box
        uc_y = pdf.get_y()
        box_h_est = 55
        # Navy header
        pdf.set_fill_color(*NAVY)
        pdf.rect(18, uc_y, 174, 10, 'F')
        pdf.set_xy(18, uc_y + 1.5)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_text_color(*AMBER)
        pdf.cell(6, 7, '\u2605', ln=0)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 7, '  REAL-WORLD USE CASE', ln=1)

        # Case title
        pdf.set_fill_color(240, 245, 255)
        pdf.set_xy(18, uc_y + 10)
        pdf.set_font('Helvetica', 'B', 8.5)
        pdf.set_text_color(*NAVY)
        pdf.multi_cell(174, 5.5, f['usecase_title'])
        pdf.ln(2)

        # Case narrative
        pdf.set_xy(18, pdf.get_y())
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(174, 5.5, f['usecase'])
        pdf.ln(3)

        # Tip banner
        tip_y = pdf.get_y()
        pdf.set_fill_color(245, 158, 11, )
        pdf.set_fill_color(255, 251, 235)
        pdf.rect(18, tip_y, 174, 14, 'F')
        pdf.set_fill_color(*AMBER)
        pdf.rect(18, tip_y, 2, 14, 'F')
        pdf.set_xy(24, tip_y + 1.5)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_text_color(*AMBER)
        pdf.cell(0, 5, 'PRO TIP', ln=1)
        pdf.set_xy(24, pdf.get_y())
        pdf.set_font('Helvetica', '', 8.5)
        pdf.set_text_color(92, 73, 10)
        pdf.multi_cell(166, 5, f['tip'])

    # ── BACK COVER ─────────────────────────────────────────────────────────────
    pdf.add_page()

    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 297, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 0, 210, 3, 'F')

    pdf.set_xy(18, 40)
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 10, 'LitigaForge AI', ln=1)
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(*TEAL)
    pdf.set_xy(18, 52)
    pdf.cell(0, 6, 'Legal Intelligence for Telangana & Andhra Pradesh', ln=1)

    pdf.set_fill_color(*AMBER)
    pdf.rect(18, 62, 50, 1.5, 'F')
    pdf.ln(14)

    contacts = [
        ('\u2022 Website', 'litigaforge.com'),
        ('\u2022 Legal Email', 'legal@litigaforge.com'),
        ('\u2022 NALSA Helpline', '1516 (Toll-Free, 24x7)'),
        ('\u2022 Platform', 'Available in English, Telugu, Hindi'),
    ]
    pdf.set_xy(18, 72)
    for label, val in contacts:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*AMBER)
        pdf.cell(40, 7, label, ln=0)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 7, val, ln=1)

    pdf.set_xy(18, 110)
    pdf.set_fill_color(20, 40, 80)
    pdf.rect(18, 110, 174, 35, 'F')
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, 110, 2, 35, 'F')
    pdf.set_xy(25, 115)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_text_color(*TEAL)
    pdf.cell(0, 6, 'LEGAL DISCLAIMER', ln=1)
    pdf.set_xy(25, pdf.get_y())
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(148, 163, 184)
    disc = (
        "LitigaForge AI provides legal information and AI-generated analysis for educational "
        "and informational purposes only. It does not constitute legal advice. Always consult "
        "a qualified and enrolled advocate before taking any legal action. LitigaForge AI is "
        "not responsible for outcomes based on reliance on platform content alone."
    )
    pdf.multi_cell(162, 5.5, disc)

    pdf.set_xy(18, 260)
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, f'(c) {datetime.date.today().year} LitigaForge AI. All rights reserved. Version 1.0  |  {TODAY}', ln=1)

    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 294, 210, 3, 'F')

    return pdf


def _section_title(pdf: LitigaForgePDF, title: str):
    y = pdf.get_y()
    pdf.set_fill_color(*NAVY)
    pdf.rect(18, y, 174, 10, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(18, y, 3, 10, 'F')
    pdf.set_xy(25, y + 1.5)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 7, title.upper(), ln=1)
    pdf.ln(5)


if __name__ == '__main__':
    pdf = make_pdf()
    out = 'litigaforge_user_guide.pdf'
    pdf.output(out)
    print(f'PDF saved: {out}')
