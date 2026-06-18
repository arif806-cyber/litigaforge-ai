"""
LitigaForge AI — Professional User Guide PDF Generator
Uses fpdf2 (2.8.3) with DejaVu Sans Unicode font.
Run: python3 scripts/generate_user_guide.py
Output: litigaforge_user_guide.pdf
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
FONT_R    = FONT_DIR + "DejaVuSans.ttf"
FONT_B    = FONT_DIR + "DejaVuSans-Bold.ttf"

NAVY   = (26,  39,  68)
AMBER  = (245, 158, 11)
TEAL   = (20,  184, 166)
WHITE  = (255, 255, 255)
LIGHT  = (248, 250, 252)
MUTED  = (100, 116, 139)
DARK   = (15,  23,  42)
PURPLE = (168, 85,  247)
SLATE  = (30,  41,  59)
AMBER_LIGHT = (255, 251, 235)
AMBER_DARK  = (92,  73,  10)

TODAY  = datetime.date.today().strftime("%B %Y")

FEATURES = [
    {
        "num": "01",
        "cat": "FORGE WORKSPACE",
        "name": "AI Workspace — ForgeBoard",
        "tagline": "5 specialised AI agents analyse your case on a live interactive canvas",
        "overview": (
            "The ForgeBoard is LitigaForge AI's flagship feature — a multi-agent legal intelligence "
            "canvas. Five specialist AI agents work in parallel: Research (surfaces Indian precedents), "
            "Strategy (builds argument maps), Risk & Counter (identifies weaknesses), Drafting (auto-generates "
            "notices and pleadings), and Predictive (estimates outcome probability). Each agent streams "
            "its output live. Results are scored 0–100 and synthesised into a consensus legal strategy."
        ),
        "steps": [
            "Log in and click the Workspace icon (lightning bolt) in the sidebar.",
            "Click '+ New Workspace' to start a session, or open an existing one.",
            "Type your case facts in the 'Describe your case' panel on the left.",
            "Click the green 'Run Agent Analysis' button.",
            "Watch all five agents stream their analysis live on the canvas.",
            "After completion, explore the canvas nodes and run 'What-If Simulation' to test arguments.",
            "A Case Folder is created automatically — it stores all agent outputs and documents.",
        ],
        "usecase_title": "Case: Family Pension Rejection — Lalitha Devi v. State of Telangana",
        "usecase": (
            "Lalitha Devi's family pension claim was rejected because Form-5 was filed 7 days beyond "
            "the 90-day window after her late husband's retirement. She described the situation in "
            "ForgeBoard. The Research Agent surfaced CCS Pension Rules 1972 (Rule 54) and three CAT "
            "Hyderabad orders where courts condoned similar delays on grounds of ignorance. The Strategy "
            "Agent recommended a writ petition seeking quashing of the rejection with a prayer for "
            "retrospective pension release. Consensus strategy score: 78/100 — strong case."
        ),
        "tip": "Use the 'Twin' tab inside Workspace to build a Legal Twin profile for personalised ongoing guidance across all your matters.",
    },
    {
        "num": "02",
        "cat": "MATCH & CONNECT",
        "name": "Client–Lawyer Matching",
        "tagline": "AI matches you with verified advocates — every match scored 0 to 100",
        "overview": (
            "LitigaForge AI's matching engine analyses your case requirements against all verified "
            "advocates on the platform. Each match receives a score from 0–100 based on practice area "
            "alignment, district proximity, language preference, years of experience, and current "
            "availability. You review AI-explained proposals, then accept or decline. Once accepted, "
            "a secure in-platform chat thread opens immediately."
        ),
        "steps": [
            "Go to 'Post a Case' in the sidebar and fill in case type, description, budget, and preferred district.",
            "Enable 'Anonymous posting' to hide your identity until you choose to connect.",
            "Submit. The AI engine scans all verified advocates and generates proposals.",
            "Visit 'My Cases' and click 'View Proposals' to see your scored matches.",
            "Click an advocate's card to read the AI explanation, bar number, ratings, and hourly rate.",
            "Click 'Accept' to connect — a secure chat thread opens automatically.",
            "Communicate, share documents, and confirm your engagement — entirely within LitigaForge AI.",
        ],
        "usecase_title": "Case: Hit-and-Run Accident Compensation — Ravi Kumar, Secunderabad",
        "usecase": (
            "Ravi Kumar's motorcycle was struck by a fleeing vehicle on NH-65. He posted a Motor "
            "Accident Claims case with a budget of Rs 5,000–10,000 and requested Telugu communication. "
            "The AI matched him with a Secunderabad advocate (score: 89/100) who specialises in MACT "
            "cases with 14 years' experience. The AI explanation cited alignment on location, language, "
            "and 12 previously won MACT petitions in the Ranga Reddy district. Ravi accepted the "
            "proposal and received a written case assessment the same afternoon."
        ),
        "tip": "Verified advocates display a blue shield badge. Always confirm bar number and district specialisation before accepting a proposal.",
    },
    {
        "num": "03",
        "cat": "LEGAL Q&A",
        "name": "Legal Q&A",
        "tagline": "Instant AI answers to any legal question — community knowledge base included",
        "overview": (
            "The Legal Q&A section allows anyone to ask a legal question and receive an AI-generated "
            "answer within seconds — no account required for basic queries. Answers draw on a "
            "multi-model AI cascade (Claude Sonnet, Gemini 2.5 Flash, Groq Llama) trained on Indian "
            "statutes, court rules, and regulatory guidelines. All answered questions are added to a "
            "community knowledge base organised by category."
        ),
        "steps": [
            "Click 'Ask' in the sidebar — no login required for basic queries.",
            "Type your question in plain language — Hindi, Telugu, or English all work.",
            "Click 'Ask'. The AI provides an answer with citations within 10–15 seconds.",
            "Browse past answers by category: Consumer, Property, Labour, Criminal, Family, Tax, and more.",
            "Upvote helpful answers to surface them for other users with similar questions.",
            "Log in to save your questions and receive follow-up updates when related cases are decided.",
        ],
        "usecase_title": "Query: GST Input Tax Credit Reversal — Priya Textiles, Warangal",
        "usecase": (
            "Priya Sharma, proprietor of Priya Textiles, asked: 'Can a trader reverse ITC claimed on "
            "goods returned by buyer under GST?' The AI answered citing Section 16(2) and Rule 37 of "
            "CGST Rules 2017, explaining the ITC reversal obligation on the buyer's part when credit "
            "notes are issued, and the 180-day payment rule. It recommended filing a GSTR-2B "
            "reconciliation first and consulting a GST practitioner for Rule 37A implications. The "
            "question was saved to the Tax category and upvoted 14 times by other Warangal traders."
        ),
        "tip": "Prefix your question with your state for localised answers — e.g., 'In Telangana, can a landlord...' gives more relevant jurisdiction-specific guidance.",
    },
    {
        "num": "04",
        "cat": "DOCUMENT ANALYZER",
        "name": "Document Analyzer",
        "tagline": "Risk scoring, missing clauses, and recommendations for any legal document",
        "overview": (
            "Upload any legal document — an agreement, notice, contract, or court order — and the AI "
            "analyses it for risk exposure, missing standard clauses, non-standard terms, and compliance "
            "gaps. Each document receives a risk score from 0–100 and a prioritised recommendation list "
            "with plain-language explanations. No account is required for basic document scans."
        ),
        "steps": [
            "Click 'Review' (document icon) in the sidebar.",
            "Paste the document text into the analysis box, or type a description of its contents.",
            "Click 'Analyse Document'.",
            "Review the Risk Score card: red (high risk 70–100), amber (medium 40–69), green (low 0–39).",
            "Read the 'Missing Clauses' section to identify contractual gaps.",
            "Expand each 'Recommendation' card for specific, actionable improvement suggestions.",
            "Download or copy the full analysis report for use in negotiations or filing.",
        ],
        "usecase_title": "Document: Rental Agreement — Syed Iqbal, Banjara Hills, Hyderabad",
        "usecase": (
            "Syed Iqbal received a rental agreement for a commercial property in Banjara Hills. He "
            "pasted the 12-page document into the Analyzer. The AI flagged a Risk Score of 67/100, "
            "citing four issues: (1) no force majeure clause, (2) ambiguous lock-in period language, "
            "(3) no dispute resolution mechanism, and (4) missing TDS deduction clause under "
            "Section 194-I of the Income Tax Act. Recommendations included negotiating a 3-year "
            "lock-in cap and adding a mandatory arbitration clause under the Arbitration & "
            "Conciliation Act, 1996. Syed used the report to negotiate three amendments before signing."
        ),
        "tip": "For best results, paste the complete document text — the AI can process up to 20,000 characters and detects subtle risks that quick reads miss.",
    },
    {
        "num": "05",
        "cat": "JUDGMENT FINDER",
        "name": "Judgment Finder",
        "tagline": "Search Indian case law — precedents from SC, High Courts, and Tribunals",
        "overview": (
            "The Judgment Finder connects to India's largest legal database (Indian Kanoon) to surface "
            "relevant case law. Search by keyword, party name, statute section, or court. Each result "
            "includes a curated AI digest — facts, ruling, key legal principle, and citation — plus a "
            "direct link to the full judgment text. The AI also highlights how each precedent applies "
            "to your specific facts."
        ),
        "steps": [
            "Click 'Judgments' in the sidebar.",
            "Enter keywords, party names, or the section of law you need precedents for.",
            "Click 'Search'. The AI returns up to 10 curated, relevance-ranked precedents.",
            "Click any result to see the full digest: facts, held, key principle, and citation.",
            "Click 'View on Indian Kanoon' for the full text of the judgment.",
            "Bookmark important judgments from your profile (logged-in users).",
            "Inside ForgeBoard, the Research Agent automatically surfaces judgments during analysis.",
        ],
        "usecase_title": "Search: Consumer Forum — Deficiency in Service, Vijaya Electronics, Nellore",
        "usecase": (
            "T. Subrahmanyam purchased a refrigerator from Vijaya Electronics, Nellore, that broke "
            "down within 6 months. The seller refused to honour the warranty. He searched 'deficiency "
            "in service consumer forum refrigerator warranty' on the Judgment Finder. The AI surfaced "
            "NCDRC orders including Whirlpool of India Ltd. v. Pooja Enterprises where compensation "
            "was awarded for warranty refusal. The digest noted the 2-year limitation period under the "
            "Consumer Protection Act, 2019. Subrahmanyam filed in the Nellore DCDRC with the citation "
            "and received an ex-parte order within 90 days."
        ),
        "tip": "Use the Judgment Finder inside a ForgeBoard session — the Research Agent links precedents directly to your case argument map.",
    },
    {
        "num": "06",
        "cat": "AI LEGAL CHAT",
        "name": "AI Legal Chat & Drafting",
        "tagline": "Draft legal notices, plaints, petitions, and responses in minutes",
        "overview": (
            "The AI Legal Chat is a real-time drafting assistant trained on Indian legal templates and "
            "court formats. Choose from four starter templates — Demand Notice, Reply to Notice, Bail "
            "Application, Legal Opinion — or start a free-form conversation. The AI adapts every draft "
            "to your specific facts and jurisdiction. All outputs carry an automatic legal disclaimer "
            "as required by Bar Council guidelines."
        ),
        "steps": [
            "Click 'Legal Chat' (chat bubble icon) in the sidebar.",
            "Choose a template: Demand Notice, Reply to Notice, Bail Application, or Legal Opinion — or type freely.",
            "Describe your situation, parties involved, dates, and the relief you seek.",
            "The AI generates a draft in standard Indian legal format within seconds.",
            "Ask follow-up questions to refine specific clauses, add parties, or change the tone.",
            "Click 'Copy' to copy the draft text for use in any document editor.",
            "Always have a licensed and enrolled advocate review the final draft before filing or dispatch.",
        ],
        "usecase_title": "Draft: Legal Notice for Cheque Dishonour — K. Raghunath, Vijayawada",
        "usecase": (
            "K. Raghunath lent Rs 3,00,000 to a business associate whose cheque was returned dishonoured "
            "on presentation. He opened AI Legal Chat, selected 'Demand Notice', and described the "
            "transaction dates, cheque number, bank return memo details, and the drawee's Vijayawada "
            "address. The AI generated a Section 138 Negotiable Instruments Act, 1881 notice within "
            "60 seconds — correctly formatted with a 15-day demand period and Vijayawada territorial "
            "jurisdiction. His advocate made two minor edits and dispatched it by registered post. "
            "The associate paid in full within the notice period."
        ),
        "tip": "The AI remembers your chat thread context — reference earlier drafts in the same session to build complex documents incrementally.",
    },
    {
        "num": "07",
        "cat": "CLIENT DASHBOARD",
        "name": "Client Dashboard & Case Tracking",
        "tagline": "Visual timeline for every active case — hearing dates, documents, and advocate chat",
        "overview": (
            "The Client Dashboard is your command centre for all active legal matters. Each case "
            "displays a real-time stage timeline (Intake > Filed > Hearing > Judgment), the next "
            "hearing date, your assigned advocate's contact details, pending match proposals, and "
            "all documents linked to that case. Upload documents directly, and message your advocate "
            "via the secure in-platform chat."
        ),
        "steps": [
            "Log in as a Client — the dashboard is your landing page automatically.",
            "The left panel lists all your active cases. Click any case card to expand the details.",
            "The stage timeline bar highlights the current stage in amber.",
            "Click 'Proposals' to review and act on any pending advocate match proposals.",
            "Click 'Documents' to upload case documents — PDF, JPG, PNG, and DOCX supported.",
            "Tap 'Contact Advocate' to open the secure in-platform chat with your assigned lawyer.",
            "The NALSA helpline (1516) is always displayed at the bottom for free legal aid access.",
        ],
        "usecase_title": "Case Tracking: Cheque Bounce Recovery — M. Anitha, Karimnagar",
        "usecase": (
            "M. Anitha had a Section 138 NI Act complaint filed in the Karimnagar Judicial "
            "Magistrate Court. Her advocate updated the case stage to 'Hearing' after summons was "
            "served. Anitha could see on her dashboard that the next hearing was set for 22 July and "
            "the matter was at Stage 3 of 5. She uploaded the original cheque image and bank return "
            "memo directly to the case folder from her phone. Her advocate acknowledged receipt via "
            "in-platform chat and confirmed the documents were sufficient for the next date."
        ),
        "tip": "Enable push notifications in Settings > Notifications to receive automatic reminders for upcoming hearing dates — never miss a court date.",
    },
    {
        "num": "08",
        "cat": "ADVOCATE DIRECTORY",
        "name": "Advocate Directory",
        "tagline": "Find and contact verified advocates across Telangana and Andhra Pradesh",
        "overview": (
            "The Advocate Directory lists all verified lawyers registered on the platform — complete "
            "with bar council registration number, practice areas, districts covered, languages spoken, "
            "years of experience, hourly rate, and current availability. Client ratings from past "
            "matters are displayed on each profile. Filter by any combination of criteria to find "
            "exactly the right advocate for your situation."
        ),
        "steps": [
            "Click 'Lawyers' in the sidebar.",
            "Use the filter row to narrow by: District, Practice Area, Language, and Budget range.",
            "Browse advocate cards — verified advocates show a blue shield badge.",
            "Click any card to see the full profile: bio, bar number, ratings, hourly rate, and languages.",
            "Click 'Post a Case' to formally submit a requirement that matching advocates can respond to.",
            "Advocates can self-register via 'Register as Advocate' — free for all enrolled lawyers.",
        ],
        "usecase_title": "Search: Property Dispute Advocate — S. Padmavathi, Guntur",
        "usecase": (
            "S. Padmavathi needed an advocate for a property partition suit in the Guntur District "
            "Court. She filtered the directory for District: Guntur, Practice Area: Property Law, "
            "Language: Telugu. Six verified advocates appeared. She selected one with 22 years' "
            "experience and a 4.8 client rating from 31 matters. His Bar Council of Andhra Pradesh "
            "registration number was independently verifiable. She posted the case and received his "
            "proposal within 4 hours with a clear fee estimate for the first two hearings."
        ),
        "tip": "Advocates with the 'Verified' badge have had their bar enrolment number cross-checked by the LitigaForge AI team.",
    },
    {
        "num": "09",
        "cat": "LEGAL AID FINDER",
        "name": "Legal Aid Finder",
        "tagline": "Free legal help via NALSA, TSLSA, and all 8 district legal services authorities",
        "overview": (
            "LitigaForge AI provides a built-in legal aid eligibility checker and a complete DLSA "
            "directory. If you qualify under NALSA / TSLSA income or category criteria, you are "
            "entitled to free legal representation under the Legal Services Authorities Act, 1987. "
            "The platform lists all 8 Telangana District Legal Services Authority offices with "
            "addresses, phone numbers, and emails."
        ),
        "steps": [
            "Click 'Legal Aid' in the sidebar.",
            "Run the Eligibility Wizard — answer 5 questions about income, beneficiary category (SC/ST/Women/Disabled/Child), and case type.",
            "The wizard shows whether you qualify for free legal aid and the legal basis.",
            "If eligible, your nearest DLSA address, phone number, and email are displayed.",
            "Call NALSA Toll-Free: 1516 (available 24x7) for immediate guidance.",
            "TSLSA offices covered: Hyderabad, Warangal, Karimnagar, Nalgonda, Nizamabad, Khammam, Medak, Adilabad.",
        ],
        "usecase_title": "Eligibility Check: Domestic Violence Protection — Sunita Bai, Adilabad",
        "usecase": (
            "Sunita Bai, a Scheduled Tribe woman from Adilabad with a monthly income below Rs 1 lakh, "
            "was facing domestic violence and needed urgent legal protection. She ran the Legal Aid "
            "Eligibility Wizard on LitigaForge AI. The wizard confirmed eligibility on two grounds: "
            "Scheduled Tribe category and domestic violence case type. The platform displayed the "
            "Adilabad DLSA address and direct phone number. She called 1516, was connected to a duty "
            "advocate within 20 minutes, and filed for a Protection Order under the Protection of "
            "Women from Domestic Violence Act, 2005 — at zero cost."
        ),
        "tip": "Women, children, persons belonging to SC/ST communities, and persons with disabilities always qualify for free legal aid regardless of income level.",
    },
    {
        "num": "10",
        "cat": "FREE TEMPLATES",
        "name": "Free Document Templates",
        "tagline": "10 AI-powered legal templates — filled dynamically with your specific facts",
        "overview": (
            "LitigaForge AI provides 10 free, professionally drafted document templates that the AI "
            "fills with your specific case details. Templates cover the most common Indian legal "
            "documents. Each one generates a formatted, ready-to-print document with standard clauses, "
            "proper court heading, and party details auto-populated. No design or drafting experience "
            "required."
        ),
        "steps": [
            "Click 'Free Documents' in the sidebar.",
            "Browse the 10 template cards — each card shows the document type and typical use case.",
            "Click 'Generate' on your chosen template.",
            "Fill the dynamic form — fields are pre-populated where your profile data is available.",
            "Review the live preview on the right panel as you type.",
            "Click 'Download PDF' to save the finished document.",
            "For fully custom documents beyond these templates, use AI Legal Chat (Feature 06).",
        ],
        "usecase_title": "Template: Affidavit of Income — Ramesh Goud, Nizamabad",
        "usecase": (
            "Ramesh Goud needed an affidavit of income to apply for an OBC non-creamy layer "
            "certificate in Nizamabad. He opened Free Documents, selected the 'Affidavit of Income' "
            "template, and filled in his name, father's name, complete address, and annual income "
            "figure. The AI generated a properly formatted affidavit citing the Telangana jurisdiction "
            "with the standard verification clause. Ramesh printed it, got it notarised at the local "
            "Sub-Registrar office, and submitted — saving Rs 500 he would otherwise have paid a "
            "typing centre."
        ),
        "tip": "Templates available: Demand Notice, Income Affidavit, Rent Agreement, Power of Attorney, Partnership Deed, NDA, Sale Agreement, Legal Heir Certificate, Bail Application, and Consumer Complaint.",
    },
    {
        "num": "11",
        "cat": "SUBSCRIPTION",
        "name": "Subscription Plans",
        "tagline": "Three plans — Free, Professional, and Advocate Pro",
        "overview": (
            "LitigaForge AI offers three subscription tiers. The Free plan gives full access to Legal "
            "Q&A, Judgment Finder, Legal Aid, and basic templates. The Professional plan (Rs 999/month) "
            "adds unlimited AI analysis sessions, expanded document uploads, and priority matching. "
            "The Advocate Pro plan (Rs 2,499/month) is for practising advocates — it adds the full "
            "Lawyer Dashboard, case management, client portal access, and a verified badge that "
            "increases placement in search results."
        ),
        "steps": [
            "Click your plan badge (top right corner) or go to 'Subscription' in the sidebar.",
            "Compare the three plan tiers side by side on the plan comparison table.",
            "Click 'Upgrade' on your chosen plan.",
            "Pay securely via Razorpay — UPI, card, net banking, and wallets all accepted.",
            "Your new tier activates instantly after Razorpay payment verification.",
            "To downgrade, select a lower tier — the change takes effect at your next billing cycle.",
        ],
        "usecase_title": "Upgrade: Free to Professional — Meera Reddy, Hyderabad",
        "usecase": (
            "Meera Reddy used the Free plan for two months to research her property dispute and run "
            "three ForgeBoard sessions. When her advocate requested 14 document uploads (Free plan "
            "limit: 5) and she needed priority matching for a second legal opinion, she upgraded to "
            "Professional at Rs 999/month via UPI. The upgrade activated instantly. She uploaded all "
            "14 documents and received three new advocate proposals within 2 hours. The first month's "
            "subscription cost less than a single consultation at a law firm."
        ),
        "tip": "Advocate Pro subscribers receive a verified badge, priority placement in the directory, and the complete Lawyer Dashboard for managing cases, documents, and client communications.",
    },
    {
        "num": "12",
        "cat": "DAILY DIGEST",
        "name": "Judgment Digest & Email Alerts",
        "tagline": "Curated daily legal intelligence delivered to your inbox every morning at 7 AM IST",
        "overview": (
            "LitigaForge AI sends a daily Judgment Digest email every morning with new Supreme Court, "
            "High Court, and tribunal judgments relevant to your chosen categories. Subscribe once, "
            "select your areas of law, and receive concise AI-generated summaries with key principles "
            "and citation links — no full-text reading required. Subscription is confirmed via double "
            "opt-in to ensure only genuine subscribers receive the digest."
        ),
        "steps": [
            "Go to 'Judgments' and scroll to the 'Subscribe to Daily Digest' section.",
            "Enter your email address and select your preferred legal categories.",
            "Click 'Subscribe'. A confirmation email arrives within 2 minutes — click the link to activate.",
            "Every morning at 7:00 AM IST, receive a digest with 3–5 new judgments.",
            "Each digest entry includes: case name, court, date, key holding, and a 'Read Full Judgment' link.",
            "To unsubscribe, click 'Unsubscribe' in any digest email — takes effect immediately with no data retained.",
        ],
        "usecase_title": "Digest Alert: Property Law Update — Advocate G. Srikanth, Warangal",
        "usecase": (
            "Advocate G. Srikanth subscribed to Property Law and Revenue Law categories. On a Tuesday "
            "morning the digest included a fresh Telangana High Court order interpreting Section 89 of "
            "the Transfer of Property Act. He read the 80-word AI summary before reaching the "
            "courthouse, noted the key principle, and cited it in his arguments in the Warangal "
            "District Court that afternoon. His opponent had not yet found the judgment. The client "
            "commented on his thorough preparation. Srikanth credits the daily digest for keeping "
            "him ahead in a fast-moving practice area."
        ),
        "tip": "The Judgment Digest is completely free for all users — no subscription required. Manage your category preferences at any time from your profile settings.",
    },
]


class LitigaForgePDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.add_font('DV',  '', FONT_R)
        self.add_font('DV',  'B', FONT_B)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 18, 18)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 10, 'F')
        self.set_font('DV', 'B', 7)
        self.set_text_color(*AMBER)
        self.set_xy(10, 2)
        self.cell(100, 6, 'LITIGAFORGE AI  |  USER GUIDE')
        self.set_text_color(*WHITE)
        self.set_xy(100, 2)
        self.cell(100, 6, TODAY, align='R',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-12)
        self.set_fill_color(*NAVY)
        self.rect(0, 285, 210, 15, 'F')
        self.set_font('DV', '', 7)
        self.set_text_color(*MUTED)
        self.set_xy(10, 287)
        self.cell(150, 6, 'For legal advice, consult a qualified advocate. LitigaForge AI is an informational platform.')
        self.set_text_color(*AMBER)
        self.set_xy(160, 287)
        self.cell(40, 6, f'Page {self.page_no()}', align='R')


def _sec(pdf: LitigaForgePDF, title: str):
    y = pdf.get_y()
    pdf.set_fill_color(*NAVY)
    pdf.rect(18, y, 174, 11, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(18, y, 3, 11, 'F')
    pdf.set_xy(25, y + 2)
    pdf.set_font('DV', 'B', 11)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 7, title.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)


def make_pdf() -> LitigaForgePDF:
    pdf = LitigaForgePDF()

    # ── COVER PAGE ──────────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 297, 'F')
    # amber top stripe
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 0, 210, 4, 'F')

    # Brand mark — nested rectangles
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, 28, 20, 20, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(22, 32, 12, 12, 'F')
    pdf.set_fill_color(*NAVY)
    pdf.rect(26, 36, 4, 4, 'F')

    # Wordmark
    pdf.set_xy(44, 28)
    pdf.set_font('DV', 'B', 28)
    pdf.set_text_color(*WHITE)
    pdf.cell(60, 11, 'LitigaForge', new_x=XPos.END, new_y=YPos.TOP)
    pdf.set_text_color(*AMBER)
    pdf.cell(20, 11, ' AI', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_xy(44, 42)
    pdf.set_font('DV', '', 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 6, 'Legal Intelligence for Telangana & Andhra Pradesh')

    # Amber rule
    pdf.set_fill_color(*AMBER)
    pdf.rect(18, 60, 70, 1.5, 'F')

    # Main title
    pdf.set_xy(18, 70)
    pdf.set_font('DV', 'B', 40)
    pdf.set_text_color(*WHITE)
    pdf.multi_cell(174, 16, 'Complete\nUser Guide', align='L')

    # Subtitle
    pdf.set_xy(18, 110)
    pdf.set_font('DV', '', 12)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, '12 Features  |  12 Real-World Case Studies from Telangana & AP')

    # Feature label tags
    tags = ['AI Workspace', 'Lawyer Matching', 'Legal Q&A', 'Document Analyzer',
            'Judgment Finder', 'AI Drafting', 'Case Tracking', 'Legal Aid']
    x, y_tag = 18, 128
    for tag in tags:
        pdf.set_fill_color(30, 50, 90)
        pdf.set_text_color(*TEAL)
        pdf.set_font('DV', 'B', 7)
        w = pdf.get_string_width(tag) + 10
        if x + w > 192:
            x = 18; y_tag += 10
        pdf.set_xy(x, y_tag)
        pdf.cell(w, 7, tag, fill=True, align='C')
        x += w + 4

    # Decorative circles
    pdf.set_fill_color(20, 40, 80)
    pdf.ellipse(128, 152, 122, 122, 'F')
    pdf.set_fill_color(15, 30, 65)
    pdf.ellipse(150, 174, 78, 78, 'F')
    pdf.set_fill_color(*TEAL)
    pdf.ellipse(175, 200, 28, 28, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.ellipse(165, 192, 10, 10, 'F')

    # Stats bar
    pdf.set_fill_color(20, 40, 80)
    pdf.rect(0, 232, 210, 30, 'F')
    for i, (num, label) in enumerate([('12','Features'),('5','AI Agents'),('3','AI Models'),('2','States')]):
        bx = 18 + i * 46
        pdf.set_xy(bx, 237)
        pdf.set_font('DV', 'B', 18)
        pdf.set_text_color(*AMBER)
        pdf.cell(40, 8, num, align='C')
        pdf.set_xy(bx, 246)
        pdf.set_font('DV', '', 7.5)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(40, 6, label, align='C')

    # Bottom stripe
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 267, 210, 1, 'F')
    pdf.set_xy(18, 272)
    pdf.set_font('DV', '', 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(120, 6, f'Version 1.0  |  {TODAY}  |  litigaforge.com')
    pdf.set_xy(130, 272)
    pdf.set_text_color(*TEAL)
    pdf.cell(62, 6, 'legal@litigaforge.com', align='R')

    # ── ABOUT PAGE ─────────────────────────────────────────────────────────────
    pdf.add_page()
    _sec(pdf, 'About LitigaForge AI')

    pdf.set_font('DV', '', 10)
    pdf.set_text_color(*DARK)
    pdf.multi_cell(174, 6, (
        "LitigaForge AI is an end-to-end legal technology platform built specifically for "
        "litigants, advocates, and legal professionals in Telangana and Andhra Pradesh. "
        "It combines cutting-edge AI (Claude Sonnet, Gemini 2.5 Flash, Groq Llama) with "
        "deep knowledge of Indian statute law, court procedures, and regional legal nuances "
        "to deliver intelligence that is both legally accurate and locally relevant.\n\n"
        "Whether you are a first-time litigant who needs free legal aid, a seasoned advocate "
        "who wants AI-powered case strategy, or a business owner who needs a contract reviewed "
        "before signing — LitigaForge AI has a feature built for your exact situation."
    ))
    pdf.ln(5)

    # Three pillars
    pillars = [
        (TEAL,   'Find',    'Discover verified advocates, precedents, legal aid contacts, and government resources in seconds.'),
        (AMBER,  'Analyse', 'Run 5-agent AI analysis on your case. Score arguments. Simulate what-if scenarios.'),
        (PURPLE, 'Act',     'Draft notices, file complaints, track hearings, and collaborate securely with your advocate.'),
    ]
    col_w = 54
    sy = pdf.get_y()
    for i, (color, title, desc) in enumerate(pillars):
        cx = 18 + i * (col_w + 6)
        pdf.set_fill_color(*color)
        pdf.rect(cx, sy, col_w, 2, 'F')
        pdf.set_xy(cx, sy + 5)
        pdf.set_font('DV', 'B', 11)
        pdf.set_text_color(*color)
        pdf.cell(col_w, 7, title)
        pdf.set_xy(cx, sy + 14)
        pdf.set_font('DV', '', 8.5)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(col_w, 5, desc)
    pdf.set_y(sy + 46)
    pdf.ln(4)

    # Getting started box
    bx_y = pdf.get_y()
    pdf.set_fill_color(*LIGHT)
    pdf.rect(18, bx_y, 174, 48, 'F')
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, bx_y, 3, 48, 'F')
    pdf.set_xy(25, bx_y + 5)
    pdf.set_font('DV', 'B', 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 6, 'Getting Started in 3 Steps', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    for num, step in [
        ('1', 'Create your free account at litigaforge.com — no credit card required.'),
        ('2', 'Choose your role: Client (I need legal help) or Advocate (I am a lawyer).'),
        ('3', 'Explore any feature from the sidebar — everything is accessible immediately.'),
    ]:
        pdf.set_xy(25, pdf.get_y())
        pdf.set_font('DV', 'B', 9)
        pdf.set_text_color(*TEAL)
        pdf.cell(8, 7, num + '.')
        pdf.set_xy(33, pdf.get_y() - 7)
        pdf.set_font('DV', '', 9)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(159, 6, step)
    pdf.ln(8)

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────────────
    _sec(pdf, 'Table of Contents')
    for i, f in enumerate(FEATURES):
        ry = pdf.get_y()
        if i % 2 == 0:
            pdf.set_fill_color(*LIGHT)
            pdf.rect(18, ry, 174, 9, 'F')
        pdf.set_xy(18, ry + 1.5)
        pdf.set_font('DV', 'B', 9)
        pdf.set_text_color(*NAVY)
        pdf.cell(14, 6, f['num'])
        pdf.set_font('DV', '', 9)
        pdf.set_text_color(*DARK)
        pdf.cell(128, 6, f['name'])
        pdf.set_font('DV', '', 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(32, 6, f'Feature {f["num"]}', align='R',
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── FEATURE PAGES ───────────────────────────────────────────────────────────
    for f in FEATURES:
        pdf.add_page()

        # Header banner
        pdf.set_fill_color(*NAVY)
        pdf.rect(0, 0, 210, 24, 'F')
        pdf.set_fill_color(*AMBER)
        pdf.rect(0, 24, 210, 2, 'F')

        pdf.set_xy(18, 4)
        pdf.set_font('DV', 'B', 28)
        pdf.set_text_color(*AMBER)
        pdf.cell(24, 15, f['num'])

        pdf.set_xy(44, 5)
        pdf.set_font('DV', 'B', 6.5)
        pdf.set_text_color(*TEAL)
        pdf.cell(0, 5, f['cat'])

        pdf.set_xy(44, 12)
        pdf.set_font('DV', 'B', 13)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 7, f['name'])

        pdf.set_y(30)

        # Tagline strip
        pdf.set_fill_color(*LIGHT)
        pdf.rect(18, 29, 174, 11, 'F')
        pdf.set_fill_color(*TEAL)
        pdf.rect(18, 29, 2, 11, 'F')
        pdf.set_xy(24, 31)
        pdf.set_font('DV', '', 9.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 7, f['tagline'])

        pdf.set_y(45)

        # Overview
        pdf.set_font('DV', 'B', 8.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, 'OVERVIEW', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font('DV', '', 9.5)
        pdf.set_text_color(*DARK)
        pdf.multi_cell(174, 5.5, f['overview'])
        pdf.ln(5)

        # Steps
        pdf.set_font('DV', 'B', 8.5)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 6, 'HOW TO USE — STEP BY STEP', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        for idx, step in enumerate(f['steps']):
            sy2 = pdf.get_y()
            pdf.set_fill_color(*TEAL)
            pdf.rect(18, sy2 + 0.5, 5.5, 5.5, 'F')
            pdf.set_xy(18, sy2 + 0.5)
            pdf.set_font('DV', 'B', 6.5)
            pdf.set_text_color(*WHITE)
            pdf.cell(5.5, 5.5, str(idx + 1), align='C')
            pdf.set_xy(27, sy2)
            pdf.set_font('DV', '', 9.5)
            pdf.set_text_color(*DARK)
            pdf.multi_cell(165, 5.5, step)
            pdf.ln(1.5)

        pdf.ln(4)

        # Use case
        uc_y = pdf.get_y()
        pdf.set_fill_color(*NAVY)
        pdf.rect(18, uc_y, 174, 11, 'F')
        pdf.set_xy(18, uc_y + 2)
        pdf.set_font('DV', 'B', 8)
        pdf.set_text_color(*AMBER)
        pdf.cell(8, 7, '*')
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 7, '  REAL-WORLD USE CASE', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf.set_fill_color(240, 245, 255)
        pdf.rect(18, pdf.get_y(), 174, 2, 'F')

        pdf.set_xy(18, pdf.get_y() + 3)
        pdf.set_font('DV', 'B', 8.5)
        pdf.set_text_color(*NAVY)
        pdf.multi_cell(174, 5.5, f['usecase_title'])
        pdf.ln(2)
        pdf.set_xy(18, pdf.get_y())
        pdf.set_font('DV', '', 9)
        pdf.set_text_color(*SLATE)
        pdf.multi_cell(174, 5.5, f['usecase'])
        pdf.ln(3)

        # Tip
        ty = pdf.get_y()
        pdf.set_fill_color(*AMBER_LIGHT)
        pdf.rect(18, ty, 174, 16, 'F')
        pdf.set_fill_color(*AMBER)
        pdf.rect(18, ty, 2, 16, 'F')
        pdf.set_xy(24, ty + 2)
        pdf.set_font('DV', 'B', 8)
        pdf.set_text_color(*AMBER)
        pdf.cell(0, 5, 'PRO TIP', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_xy(24, pdf.get_y())
        pdf.set_font('DV', '', 8.5)
        pdf.set_text_color(*AMBER_DARK)
        pdf.multi_cell(166, 5, f['tip'])

    # ── BACK COVER ──────────────────────────────────────────────────────────────
    pdf.add_page()
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 297, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 0, 210, 4, 'F')

    # Logo repeat
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, 30, 16, 16, 'F')
    pdf.set_fill_color(*AMBER)
    pdf.rect(21, 33, 10, 10, 'F')
    pdf.set_fill_color(*NAVY)
    pdf.rect(24, 36, 4, 4, 'F')

    pdf.set_xy(40, 30)
    pdf.set_font('DV', 'B', 22)
    pdf.set_text_color(*WHITE)
    pdf.cell(60, 10, 'LitigaForge')
    pdf.set_text_color(*AMBER)
    pdf.cell(20, 10, ' AI')

    pdf.set_xy(40, 42)
    pdf.set_font('DV', '', 9)
    pdf.set_text_color(*TEAL)
    pdf.cell(0, 6, 'Legal Intelligence for Telangana & Andhra Pradesh')

    pdf.set_fill_color(*AMBER)
    pdf.rect(18, 56, 55, 1.5, 'F')

    contacts = [
        ('Website',       'litigaforge.com'),
        ('Legal Email',   'legal@litigaforge.com'),
        ('NALSA Helpline','1516  (Toll-Free, 24x7)'),
        ('Platform',      'Available in English, Telugu, and Hindi'),
    ]
    pdf.set_xy(18, 68)
    for label, val in contacts:
        pdf.set_font('DV', 'B', 9)
        pdf.set_text_color(*AMBER)
        pdf.cell(44, 8, label + ':')
        pdf.set_xy(62, pdf.get_y() - 8)
        pdf.set_font('DV', '', 9)
        pdf.set_text_color(*WHITE)
        pdf.cell(0, 8, val, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Disclaimer box
    dby = 115
    pdf.set_fill_color(20, 40, 80)
    pdf.rect(18, dby, 174, 42, 'F')
    pdf.set_fill_color(*TEAL)
    pdf.rect(18, dby, 2, 42, 'F')
    pdf.set_xy(25, dby + 6)
    pdf.set_font('DV', 'B', 9)
    pdf.set_text_color(*TEAL)
    pdf.cell(0, 6, 'LEGAL DISCLAIMER', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_xy(25, pdf.get_y())
    pdf.set_font('DV', '', 8.5)
    pdf.set_text_color(148, 163, 184)
    pdf.multi_cell(162, 5.5, (
        "LitigaForge AI provides legal information and AI-generated analysis for educational "
        "and informational purposes only. It does not constitute legal advice and does not "
        "create an advocate-client relationship. Always consult a qualified and enrolled "
        "advocate registered with the Bar Council before taking any legal action. LitigaForge "
        "AI is not responsible for outcomes based solely on reliance on platform content."
    ))

    pdf.set_xy(18, 265)
    pdf.set_font('DV', '', 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 6, f'(c) {datetime.date.today().year} LitigaForge AI. All rights reserved. Version 1.0  |  {TODAY}')
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 293, 210, 4, 'F')

    return pdf


if __name__ == '__main__':
    pdf = make_pdf()
    out = 'litigaforge_user_guide.pdf'
    pdf.output(out)
    import os
    size_kb = os.path.getsize(out) // 1024
    print(f'PDF saved: {out}  ({size_kb} KB)')
