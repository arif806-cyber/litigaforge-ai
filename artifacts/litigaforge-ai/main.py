"""LitigaForge AI — FastAPI Server
Modular router aggregator: 9 clean routers, lifespan, CORS, rate limiting,
structured logging, request middleware, Sentry (conditional).
"""
import asyncio
import os
import re as _re
import sys
import time
from contextlib import asynccontextmanager

# Ensure imports work when run from project root (production) or script dir (dev)
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

from pathlib import Path as _Path
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from logger import get_logger
from rate_limit import limiter, rate_limit_handler, RateLimitExceeded
from database import get_pool, close_pool, fetchrow as db_fetchrow
from auth import require_user as _require_user
from asyncpg.exceptions import UniqueViolationError as _UniqueViolation

logger = get_logger("litigaforge.main")

# —— Sentry (optional, only if SENTRY_DSN set) ——
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    _sensitive_keys = {
        "password", "password_hash", "token", "authorization",
        "lf_token", "session_secret", "pan", "gstin",
        "aadhaar", "phone", "email", "name",
        "razorpay_key_secret", "twilio_auth_token",
    }

    def _scrub(obj):
        if isinstance(obj, dict):
            return {k: "[REDACTED]" if k.lower() in _sensitive_keys else _scrub(v)
                    for k, v in obj.items()}
        if isinstance(obj, list):
            return [_scrub(i) for i in obj]
        return obj

    def _scrub_sensitive_data(event, hint):
        if "request" in event:
            if "data" in event["request"]:
                event["request"]["data"] = _scrub(event["request"]["data"])
            if "headers" in event["request"]:
                event["request"]["headers"] = _scrub(event["request"]["headers"])
        return event

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("ENVIRONMENT", "development"),
        release=os.environ.get("APP_VERSION", "1.0.0"),
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            CeleryIntegration(),
        ],
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        before_send=_scrub_sensitive_data,
    )
    logger.info("Sentry error tracking initialised")
else:
    logger.info("SENTRY_DSN not set — error tracking disabled")

BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")


# ── Sample judgments (Phase 1 — real landmark cases, accurate holdings) ──────────
# These are genuine, well-documented Supreme Court / High Court precedents seeded so
# the digest UI, URL structure and SEO can be reviewed before any real ingestion is
# wired up. No fabricated holdings. Replaced/augmented by later ingestion phases.
async def _ensure_sample_judgments(conn) -> None:
    """Idempotently ensure the curated landmark judgments exist.

    Runs on EVERY startup (not gated on an empty table) and upserts via
    ``ON CONFLICT (court_slug, year, slug) DO NOTHING``. This is how a
    newly-added curated judgment (e.g. Maneka Gandhi) reaches an
    already-populated database — including the production primary, which we
    cannot write to out-of-band — on the next deploy/restart. Existing rows are
    never modified, and any non-curated (ingested) judgments are left untouched.
    """
    from datetime import date

    samples = [
        {
            "case_name": "Kesavananda Bharati v. State of Kerala",
            "court": "Supreme Court of India",
            "court_slug": "supreme-court-of-india",
            "bench": "13-Judge Constitution Bench",
            "judgment_date": date(1973, 4, 24),
            "year": 1973,
            "slug": "kesavananda-bharati-v-state-of-kerala-basic-structure",
            "citation": "(1973) 4 SCC 225",
            "outcome": "Basic structure doctrine established",
            "acts_cited": [
                "Constitution of India, Article 368",
                "Constitution of India, Article 13",
                "24th Constitutional Amendment",
                "25th Constitutional Amendment",
            ],
            "summary_en": (
                "A 13-judge bench held that while Parliament has wide power under "
                "Article 368 to amend the Constitution, it cannot alter or destroy its "
                "'basic structure'. This established the basic structure doctrine, which "
                "places certain core features — such as the supremacy of the Constitution, "
                "the rule of law, separation of powers and judicial review — beyond the "
                "reach of constitutional amendment."
            ),
            "summary_hi": (
                "13 न्यायाधीशों की पीठ ने माना कि अनुच्छेद 368 के तहत संसद को संविधान में "
                "संशोधन की व्यापक शक्ति है, परंतु वह संविधान के 'मूल ढाँचे' को नष्ट या "
                "परिवर्तित नहीं कर सकती। इसी से 'मूल ढाँचा सिद्धांत' स्थापित हुआ, जो "
                "संविधान की सर्वोच्चता, विधि का शासन, शक्तियों का पृथक्करण और न्यायिक "
                "समीक्षा जैसे मूल तत्वों को संशोधन की पहुँच से बाहर रखता है।"
            ),
            "full_text": (
                "Facts: The petitioner, head of a religious mutt in Kerala, challenged "
                "the Kerala land reform laws and the 24th, 25th and 29th Constitutional "
                "Amendments that curtailed property rights and limited judicial review of "
                "such laws.\n\n"
                "Issue: Whether Parliament's power to amend the Constitution under "
                "Article 368 is unlimited, including the power to abridge or take away "
                "fundamental rights.\n\n"
                "Held: By a 7:6 majority, the Court held that Parliament can amend any "
                "part of the Constitution but cannot alter its 'basic structure' or "
                "essential framework. The Court overruled, in part, the earlier view in "
                "Golak Nath and upheld the validity of the 24th Amendment, while reading "
                "the basic structure limitation into the amending power.\n\n"
                "Significance: The basic structure doctrine has since been the bedrock of "
                "Indian constitutional law, used to test the validity of subsequent "
                "amendments and to protect the Constitution's identity."
            ),
            "source_name": "IndianKanoon",
            "source_url": "https://indiankanoon.org/doc/257876/",
        },
        {
            "case_name": "Justice K.S. Puttaswamy (Retd.) v. Union of India",
            "court": "Supreme Court of India",
            "court_slug": "supreme-court-of-india",
            "bench": "9-Judge Constitution Bench",
            "judgment_date": date(2017, 8, 24),
            "year": 2017,
            "slug": "ks-puttaswamy-v-union-of-india-right-to-privacy",
            "citation": "(2017) 10 SCC 1",
            "outcome": "Right to privacy is a fundamental right",
            "acts_cited": [
                "Constitution of India, Article 21",
                "Constitution of India, Article 14",
                "Constitution of India, Article 19",
            ],
            "summary_en": (
                "A unanimous 9-judge bench held that the right to privacy is a "
                "fundamental right intrinsic to the right to life and personal liberty "
                "under Article 21 and to the freedoms guaranteed by Part III of the "
                "Constitution. The decision overruled earlier rulings (M.P. Sharma and "
                "Kharak Singh) to the extent they held otherwise."
            ),
            "summary_hi": (
                "9 न्यायाधीशों की सर्वसम्मत पीठ ने माना कि निजता का अधिकार अनुच्छेद 21 के "
                "तहत जीवन और व्यक्तिगत स्वतंत्रता के अधिकार तथा संविधान के भाग III द्वारा "
                "प्रदत्त स्वतंत्रताओं का अभिन्न अंग है, और इसलिए एक मौलिक अधिकार है। इस "
                "निर्णय ने एम.पी. शर्मा और खड़क सिंह के विपरीत मतों को निरस्त कर दिया।"
            ),
            "full_text": (
                "Facts: A challenge to the Aadhaar scheme raised the prior question of "
                "whether the Constitution recognises a fundamental right to privacy, given "
                "earlier larger-bench observations suggesting it did not.\n\n"
                "Issue: Whether the right to privacy is a constitutionally protected "
                "fundamental right.\n\n"
                "Held: The nine judges unanimously declared that privacy is a fundamental "
                "right protected under Article 21 and as a part of the freedoms guaranteed "
                "by Part III. Any restriction must satisfy the tests of legality, a "
                "legitimate state aim, and proportionality.\n\n"
                "Significance: The judgment laid the constitutional foundation for data "
                "protection jurisprudence in India and shaped the later analysis of "
                "Aadhaar, surveillance and personal autonomy."
            ),
            "source_name": "IndianKanoon",
            "source_url": "https://indiankanoon.org/doc/91938676/",
        },
        {
            "case_name": "Vishaka v. State of Rajasthan",
            "court": "Supreme Court of India",
            "court_slug": "supreme-court-of-india",
            "bench": "3-Judge Bench",
            "judgment_date": date(1997, 8, 13),
            "year": 1997,
            "slug": "vishaka-v-state-of-rajasthan-workplace-harassment",
            "citation": "(1997) 6 SCC 241",
            "outcome": "Guidelines against workplace sexual harassment laid down",
            "acts_cited": [
                "Constitution of India, Article 14",
                "Constitution of India, Article 15",
                "Constitution of India, Article 19",
                "Constitution of India, Article 21",
                "Convention on the Elimination of All Forms of Discrimination against Women (CEDAW)",
            ],
            "summary_en": (
                "In the absence of legislation, the Court laid down binding guidelines "
                "(the 'Vishaka Guidelines') to prevent and redress sexual harassment of "
                "women at the workplace, treating it as a violation of the fundamental "
                "rights to equality, life and the freedom to practise any profession. "
                "These guidelines were later codified in the POSH Act, 2013."
            ),
            "summary_hi": (
                "किसी कानून के अभाव में, न्यायालय ने कार्यस्थल पर महिलाओं के यौन उत्पीड़न "
                "की रोकथाम और निवारण के लिए बाध्यकारी दिशानिर्देश ('विशाखा दिशानिर्देश') "
                "निर्धारित किए, इसे समानता, जीवन और किसी भी पेशे को अपनाने की स्वतंत्रता के "
                "मौलिक अधिकारों का उल्लंघन माना। इन दिशानिर्देशों को बाद में 2013 के POSH "
                "अधिनियम में संहिताबद्ध किया गया।"
            ),
            "full_text": (
                "Facts: The petition followed the brutal gang-rape of a social worker in "
                "Rajasthan and highlighted the absence of any legal framework protecting "
                "women from sexual harassment at the workplace.\n\n"
                "Issue: How to protect the fundamental rights of working women against "
                "sexual harassment in the absence of enacted law.\n\n"
                "Held: Invoking Articles 14, 15, 19(1)(g) and 21 and India's obligations "
                "under CEDAW, the Court framed detailed guidelines defining sexual "
                "harassment and prescribing preventive steps, complaint mechanisms and "
                "employer duties, to operate as law until Parliament legislated.\n\n"
                "Significance: The guidelines governed workplaces for over fifteen years "
                "and directly informed the Sexual Harassment of Women at Workplace "
                "(Prevention, Prohibition and Redressal) Act, 2013."
            ),
            "source_name": "IndianKanoon",
            "source_url": "https://indiankanoon.org/doc/1031794/",
        },
        {
            "case_name": "Faheema Shirin R.K. v. State of Kerala",
            "court": "High Court of Kerala",
            "court_slug": "kerala-high-court",
            "bench": "Single Judge (Justice P.V. Asha)",
            "judgment_date": date(2019, 9, 19),
            "year": 2019,
            "slug": "faheema-shirin-v-state-of-kerala-right-to-internet",
            "citation": "2019 SCC OnLine Ker 2976",
            "outcome": "Right to internet access read into Article 21",
            "acts_cited": [
                "Constitution of India, Article 21",
                "Constitution of India, Article 19(1)(a)",
            ],
            "summary_en": (
                "The Kerala High Court held that the right to access the internet is part "
                "of the right to education and the right to privacy under Article 21, and "
                "of the freedom of speech and expression under Article 19(1)(a). A college "
                "hostel rule restricting students' mobile phone and internet use during "
                "study hours was held to be arbitrary and was set aside."
            ),
            "summary_hi": (
                "केरल उच्च न्यायालय ने माना कि इंटरनेट तक पहुँच का अधिकार अनुच्छेद 21 के "
                "तहत शिक्षा के अधिकार और निजता के अधिकार का, तथा अनुच्छेद 19(1)(क) के तहत "
                "वाक् एवं अभिव्यक्ति की स्वतंत्रता का हिस्सा है। अध्ययन के घंटों में "
                "विद्यार्थियों के मोबाइल और इंटरनेट उपयोग पर रोक लगाने वाला छात्रावास नियम "
                "मनमाना मानकर रद्द कर दिया गया।"
            ),
            "full_text": (
                "Facts: A college student was expelled from her hostel for refusing to "
                "comply with a rule barring the use of mobile phones and the internet "
                "during designated study hours.\n\n"
                "Issue: Whether such a restriction on internet access violated the "
                "student's fundamental rights.\n\n"
                "Held: The Court held that the right to have access to the internet forms "
                "part of the right to education and the right to privacy under Article 21, "
                "as well as the freedom of expression under Article 19(1)(a). The hostel "
                "rule was found arbitrary, and the student was directed to be readmitted.\n\n"
                "Significance: An early and influential High Court recognition of internet "
                "access as integral to fundamental rights in the digital age."
            ),
            "source_name": "IndianKanoon",
            "source_url": "https://indiankanoon.org/search/?formInput=faheema%20shirin",
        },
        {
            "case_name": "Maneka Gandhi v. Union of India",
            "court": "Supreme Court of India",
            "court_slug": "supreme-court-of-india",
            "bench": "7-Judge Constitution Bench",
            "judgment_date": date(1978, 1, 25),
            "year": 1978,
            "slug": "maneka-gandhi-v-union-of-india",
            "citation": "(1978) 1 SCC 248",
            "outcome": "Article 21 'procedure established by law' must be fair, just and reasonable",
            "acts_cited": [
                "Constitution of India, Article 21",
                "Constitution of India, Article 14",
                "Constitution of India, Article 19",
                "Passports Act, 1967",
            ],
            "summary_en": (
                "A 7-judge bench dramatically widened the scope of Article 21, holding "
                "that the 'procedure established by law' for depriving a person of life "
                "or personal liberty must be fair, just and reasonable — not arbitrary, "
                "oppressive or fanciful. The Court held that Articles 14, 19 and 21 are "
                "not water-tight compartments but form a 'golden triangle': a law "
                "affecting personal liberty must also satisfy the guarantees of equality "
                "(Article 14) and the freedoms under Article 19. The narrow view in "
                "A.K. Gopalan was overruled."
            ),
            "summary_hi": (
                "7 न्यायाधीशों की पीठ ने अनुच्छेद 21 के दायरे का व्यापक विस्तार किया और माना "
                "कि किसी व्यक्ति को जीवन या व्यक्तिगत स्वतंत्रता से वंचित करने की 'विधि द्वारा "
                "स्थापित प्रक्रिया' उचित, न्यायसंगत और तर्कसंगत होनी चाहिए — मनमानी, दमनकारी या "
                "काल्पनिक नहीं। न्यायालय ने माना कि अनुच्छेद 14, 19 और 21 अलग-अलग कोष्ठक नहीं "
                "बल्कि एक 'स्वर्णिम त्रिकोण' बनाते हैं: व्यक्तिगत स्वतंत्रता को प्रभावित करने वाले "
                "किसी भी कानून को समानता (अनुच्छेद 14) और अनुच्छेद 19 की स्वतंत्रताओं की कसौटी "
                "पर भी खरा उतरना होगा। ए.के. गोपालन का संकीर्ण दृष्टिकोण निरस्त कर दिया गया।"
            ),
            "full_text": (
                "Facts: The petitioner's passport was impounded by the Government of "
                "India 'in the interests of the general public' under the Passports Act, "
                "1967, and the authorities declined to furnish any reasons for the order. "
                "She challenged it as violating her fundamental rights.\n\n"
                "Issue: Whether the right to travel abroad falls within the 'personal "
                "liberty' guaranteed by Article 21, and whether the 'procedure "
                "established by law' under Article 21 must be fair and reasonable or "
                "merely any procedure enacted by the legislature.\n\n"
                "Held: The Court held that personal liberty under Article 21 is of the "
                "widest amplitude and that any procedure depriving a person of it must be "
                "right, just and fair, and not arbitrary or oppressive — reading "
                "principles of natural justice and reasonableness into Article 21. "
                "Articles 14, 19 and 21 were held to be mutually complementary (the "
                "'golden triangle'), so such a law must withstand the scrutiny of all "
                "three. The restrictive interpretation in A.K. Gopalan was disapproved.\n\n"
                "Significance: Maneka Gandhi transformed Article 21 from a narrow "
                "guarantee against executive action into a robust source of substantive "
                "due process, underpinning much of modern Indian fundamental-rights "
                "jurisprudence."
            ),
            "source_name": "IndianKanoon",
            "source_url": "https://indiankanoon.org/doc/1766147/",
        },
    ]

    for s in samples:
        try:
            await conn.execute(
                """
                INSERT INTO judgments
                    (case_name, court, court_slug, bench, judgment_date, year, slug,
                     full_text, summary_en, summary_hi, acts_cited, outcome,
                     source_url, source_name, citation, status)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'published')
                ON CONFLICT (court_slug, year, slug) DO NOTHING
                """,
                s["case_name"], s["court"], s["court_slug"], s["bench"],
                s["judgment_date"], s["year"], s["slug"], s["full_text"],
                s["summary_en"], s["summary_hi"], s["acts_cited"], s["outcome"],
                s["source_url"], s["source_name"], s["citation"],
            )
        except _UniqueViolation:
            # The (court_slug, year, slug) conflict is handled by ON CONFLICT, but a
            # row may collide on the partial unique source_url index (e.g. prod
            # already ingested this case under a different slug). Treat as already
            # present — never let one row abort the ensure pass or startup.
            logger.info("Curated judgment already present (source_url) — skipping: %s",
                        s.get("source_url"))
    logger.info("Ensured %d curated landmark judgments present", len(samples))


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    conn = await pool.acquire()
    try:
        # Auto-initialize database tables on first startup
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                subscription_tier TEXT DEFAULT 'free',
                cases_this_month INTEGER DEFAULT 0,
                month_reset_date DATE DEFAULT CURRENT_DATE,
                is_superuser BOOLEAN DEFAULT FALSE,
                role TEXT DEFAULT 'client',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                tier TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                status TEXT DEFAULT 'active',
                payment_ref TEXT
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS legal_questions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                question TEXT NOT NULL,
                category TEXT,
                ai_answer TEXT,
                country TEXT DEFAULT 'IN',
                upvotes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("ALTER TABLE legal_questions ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IN'")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                bar_number TEXT,
                district TEXT,
                practice_areas TEXT[],
                languages TEXT[],
                experience_years INTEGER,
                rating NUMERIC(3,2) DEFAULT 0,
                bio TEXT,
                hourly_rate INTEGER,
                availability TEXT DEFAULT 'available',
                verification_status TEXT DEFAULT 'pending',
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client'")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT")
        # ── Research Portfolio: public username + profile visibility ──────────
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT TRUE")
        # Case-insensitive uniqueness; partial so NULL usernames don't collide.
        await conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower "
            "ON users (lower(username)) WHERE username IS NOT NULL"
        )
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS hourly_rate INTEGER")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available'")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'")
        await conn.execute("ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'in'")
        await conn.execute("UPDATE lawyers SET country = 'in' WHERE country IS NULL")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS case_requirements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                case_type TEXT NOT NULL,
                description TEXT,
                location TEXT,
                budget_range TEXT,
                is_anonymous BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                case_requirement_id INTEGER REFERENCES case_requirements(id) ON DELETE CASCADE,
                lawyer_id INTEGER REFERENCES lawyers(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status TEXT DEFAULT 'pending',
                match_score INTEGER DEFAULT 0,
                ai_explanation TEXT,
                client_message TEXT,
                lawyer_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # ── matches: payment tracking columns (must follow CREATE TABLE matches) ─
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending_payment'")
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS commission_amount INTEGER DEFAULT 0")
        await conn.execute("ALTER TABLE matches ADD COLUMN IF NOT EXISTS commission_payment_id TEXT")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_threads (
                id SERIAL PRIMARY KEY,
                match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                thread_id INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_role TEXT DEFAULT 'user',
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyer_cases (
                id SERIAL PRIMARY KEY,
                lawyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                case_type TEXT NOT NULL,
                description TEXT,
                client_name TEXT,
                court_name TEXT,
                cnr_number TEXT,
                hearing_date TEXT,
                case_stage TEXT DEFAULT 'filed',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS lawyer_documents (
                id SERIAL PRIMARY KEY,
                lawyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                case_id INTEGER REFERENCES lawyer_cases(id) ON DELETE SET NULL,
                filename TEXT NOT NULL,
                file_type TEXT DEFAULT 'pdf',
                file_url TEXT,
                content_text TEXT,
                ai_summary TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS client_documents (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES lawyer_cases(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_type TEXT DEFAULT 'pdf',
                file_size INTEGER DEFAULT 0,
                file_path TEXT,
                file_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens (token)
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS contact_messages (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                subject TEXT DEFAULT 'General Inquiry',
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS paid_documents (
                id TEXT PRIMARY KEY,
                slug TEXT NOT NULL,
                country TEXT DEFAULT 'US',
                email TEXT,
                fields JSONB,
                full_text TEXT,
                preview_text TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                mor_provider TEXT,
                mor_order_id TEXT,
                mor_variant_id TEXT,
                mor_store_id TEXT,
                paid_amount_cents INTEGER,
                currency TEXT DEFAULT 'USD',
                webhook_event_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                paid_at TIMESTAMPTZ
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_paid_documents_status ON paid_documents (status)")
        # ── Performance indexes ────────────────────────────────────────────────
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_case_requirements_user ON case_requirements (user_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_case_requirements_status ON case_requirements (status)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_client ON matches (client_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_lawyer ON matches (lawyer_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_case ON matches (case_requirement_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_legal_questions_category ON legal_questions (category)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_lawyer_cases_lawyer ON lawyer_cases (lawyer_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_lawyer_cases_client ON lawyer_cases (client_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages (thread_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents (client_id)")
        # ── Thread read state + last_message_at on chat_threads ──────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS thread_read_state (
                    id SERIAL PRIMARY KEY,
                    thread_id INTEGER REFERENCES chat_threads(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL,
                    last_read_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT _thread_user_uc UNIQUE (thread_id, user_id)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_thread_read_state_thread_user ON thread_read_state (thread_id, user_id)"
            )
            await conn.execute(
                "ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ"
            )
            logger.info("thread_read_state table + chat_threads.last_message_at ready")
        except Exception as me:
            logger.warning("thread_read_state init: %s", me)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id)")
        # ── Migrations ──
        try:
            await conn.execute("ALTER TABLE lawyer_documents ADD COLUMN IF NOT EXISTS notes TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS cnr_number TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS hearing_date TEXT")
            await conn.execute("ALTER TABLE lawyer_cases ADD COLUMN IF NOT EXISTS case_stage TEXT DEFAULT 'filed'")
            logger.info("Migration: notes + cnr + client_id + hearing_date + case_stage columns added")
        except Exception as me:
            logger.warning("Migration check: %s", me)

        # ── Budget columns on case_requirements ──────────────────────────────
        try:
            await conn.execute("ALTER TABLE case_requirements ADD COLUMN IF NOT EXISTS budget_min INTEGER DEFAULT 0")
            await conn.execute("ALTER TABLE case_requirements ADD COLUMN IF NOT EXISTS budget_max INTEGER DEFAULT 0")
            logger.info("Migration: budget_min + budget_max added to case_requirements")
        except Exception as me:
            logger.warning("Migration budget: %s", me)

        # ── case_requirement_id on client_documents ───────────────────────────
        try:
            await conn.execute(
                "ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS "
                "case_requirement_id INTEGER REFERENCES case_requirements(id) ON DELETE SET NULL"
            )
            logger.info("Migration: client_documents.case_requirement_id added")
        except Exception as me:
            logger.warning("Migration client_documents.case_requirement_id: %s", me)

        # ── Email verification on users ───────────────────────────────────────
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("Migration: email_verified + email_verification_tokens added")
        except Exception as me:
            logger.warning("Migration email_verify: %s", me)

        # ── Password reset tokens ──────────────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("Migration: password_reset_tokens added")
        except Exception as me:
            logger.warning("Migration password_reset: %s", me)

        # ── Passkeys (WebAuthn / FIDO2) ───────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS passkey_credentials (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    credential_id TEXT UNIQUE NOT NULL,
                    public_key BYTEA NOT NULL,
                    sign_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user ON passkey_credentials (user_id)"
            )
            logger.info("passkey_credentials table ready")
        except Exception as me:
            logger.warning("passkey_credentials init: %s", me)

        # ── Web Push subscriptions ────────────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT UNIQUE NOT NULL,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id)"
            )
            logger.info("push_subscriptions table ready")
        except Exception as me:
            logger.warning("push_subscriptions init: %s", me)

        # ── Judgment Digest (Daily SC/HC Judgment Digest — Phase 1) ───────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS judgments (
                    id SERIAL PRIMARY KEY,
                    case_name TEXT NOT NULL,
                    court TEXT NOT NULL,
                    court_slug TEXT NOT NULL,
                    bench TEXT,
                    judgment_date DATE,
                    year INTEGER,
                    slug TEXT NOT NULL,
                    full_text TEXT,
                    summary_en TEXT,
                    summary_hi TEXT,
                    acts_cited TEXT[] DEFAULT '{}',
                    outcome TEXT,
                    source_url TEXT,
                    source_name TEXT,
                    citation TEXT,
                    og_image_url TEXT,
                    status TEXT DEFAULT 'published',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE (court_slug, year, slug)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_judgments_date ON judgments (judgment_date DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_judgments_court_slug ON judgments (court_slug)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_judgments_status ON judgments (status)"
            )
            # Dedup ingested judgments by their canonical source document URL,
            # independent of any later slug/title change. Partial (NOT NULL) so
            # the seed rows and manual entries without a URL are unaffected.
            await conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_judgments_source_url "
                "ON judgments (source_url) WHERE source_url IS NOT NULL"
            )
            # ── NIM semantic search (pgvector) ────────────────────────────────
            # Enable the vector extension and add the embedding column for
            # semantic similarity search.  Both are no-ops if already present.
            # The hnsw index (pgvector ≥ 0.5) works on empty tables; wrapped in
            # its own try/except so a missing extension never aborts table init.
            try:
                await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                await conn.execute(
                    "ALTER TABLE judgments ADD COLUMN IF NOT EXISTS embedding vector(1024)"
                )
                # Drop any pre-existing hnsw index so we can use ivfflat (task spec).
                # Both DROP and CREATE are idempotent across restarts.
                await conn.execute("DROP INDEX IF EXISTS idx_judgments_embedding")
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_judgments_embedding "
                    "ON judgments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
                )
                logger.info("pgvector embedding column + ivfflat index ready")
            except Exception as ve:
                logger.warning("pgvector init skipped (not available or already set up): %s", ve)
            # entities JSONB column for deterministic NLP extraction results
            # (acts, parties, judges, courts via legal_nlp.py). Added after
            # initial release — safe to re-run via ADD COLUMN IF NOT EXISTS.
            await conn.execute(
                "ALTER TABLE judgments ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT NULL"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS digest_subscribers (
                    id SERIAL PRIMARY KEY,
                    name TEXT,
                    email TEXT UNIQUE NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    confirmed BOOLEAN DEFAULT FALSE,
                    confirm_token TEXT,
                    unsubscribe_token TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    last_sent_at TIMESTAMPTZ
                )
            """)
            # `country` was added after the table's first release. CREATE TABLE
            # IF NOT EXISTS never alters an existing table, so add it explicitly.
            # Defaults to 'in' (India) — the digest is India-focused today; the
            # column enables future per-country segmentation.
            await conn.execute(
                "ALTER TABLE digest_subscribers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'in'"
            )
            # ── Research Portfolio: per-user judgment bookmarks ───────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS judgment_bookmarks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
                    notes TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE (user_id, judgment_id)
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_judgment_bookmarks_user "
                "ON judgment_bookmarks (user_id, created_at DESC)"
            )
            logger.info("judgments + digest_subscribers + judgment_bookmarks tables ready")
            await _ensure_sample_judgments(conn)
        except Exception as me:
            logger.warning("judgment digest init: %s", me)

        # ── Forge Workspace ───────────────────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS workspace_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL DEFAULT 'Untitled Workspace',
                    case_description TEXT DEFAULT '',
                    nodes_json JSONB NOT NULL DEFAULT '[]',
                    edges_json JSONB NOT NULL DEFAULT '[]',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_workspace_sessions_user "
                "ON workspace_sessions (user_id, updated_at DESC)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS workspace_insights (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER REFERENCES workspace_sessions(id) ON DELETE CASCADE,
                    agent TEXT NOT NULL,
                    content TEXT NOT NULL,
                    insight_type TEXT DEFAULT 'analysis',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS ikanoon_search_cache (
                    id          SERIAL PRIMARY KEY,
                    query_hash  TEXT UNIQUE NOT NULL,
                    query_text  TEXT NOT NULL,
                    results_json JSONB NOT NULL DEFAULT '[]',
                    hit_count   INTEGER DEFAULT 0,
                    fetched_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_ikanoon_cache_fetched "
                "ON ikanoon_search_cache (fetched_at DESC)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS workspace_agent_feedback (
                    id          SERIAL PRIMARY KEY,
                    session_id  INTEGER REFERENCES workspace_sessions(id) ON DELETE CASCADE,
                    agent_id    VARCHAR(32) NOT NULL,
                    vote        CHAR(4) NOT NULL,
                    updated_at  TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE (session_id, agent_id)
                )
            """)
            logger.info("workspace tables ready")
        except Exception as me:
            logger.warning("workspace tables init: %s", me)

        # ── Case Folders (My Documents) ───────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS case_folders (
                    id               SERIAL PRIMARY KEY,
                    user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    session_id       INTEGER REFERENCES workspace_sessions(id) ON DELETE SET NULL,
                    folder_name      VARCHAR(300) NOT NULL,
                    case_description TEXT DEFAULT '',
                    created_at       TIMESTAMPTZ DEFAULT NOW(),
                    updated_at       TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_case_folders_user "
                "ON case_folders (user_id, updated_at DESC)"
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_case_folders_session "
                "ON case_folders (session_id)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS folder_documents (
                    id              SERIAL PRIMARY KEY,
                    folder_id       INTEGER REFERENCES case_folders(id) ON DELETE CASCADE,
                    filename        VARCHAR(300) NOT NULL,
                    doc_type        VARCHAR(50)  DEFAULT 'pdf',
                    file_path       TEXT         NOT NULL,
                    file_size_bytes INTEGER      DEFAULT 0,
                    notes           TEXT         DEFAULT '',
                    created_at      TIMESTAMPTZ  DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_folder_documents_folder "
                "ON folder_documents (folder_id, created_at DESC)"
            )
            logger.info("case folders tables ready")
        except Exception as me:
            logger.warning("case folders tables init: %s", me)

        # ── Personalization / Legal Twin ──────────────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_learning_events (
                    id          SERIAL PRIMARY KEY,
                    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    session_id  INTEGER REFERENCES workspace_sessions(id) ON DELETE SET NULL,
                    event_type  VARCHAR(64) NOT NULL,
                    event_data  JSONB DEFAULT '{}',
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_learning_events_user "
                "ON user_learning_events (user_id, created_at DESC)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_profile (
                    id               SERIAL PRIMARY KEY,
                    user_id          INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    learning_enabled BOOLEAN DEFAULT TRUE,
                    updated_at       TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            logger.info("personalization tables ready")
        except Exception as me:
            logger.warning("personalization tables init: %s", me)

        logger.info("Database tables initialized")

        # ── Admin bootstrap ──────────────────────────────────────────────────
        # Promote designated accounts to superuser. Idempotent + safe to re-run.
        # Configure via the ADMIN_EMAILS env var (comma-separated emails).
        try:
            _admin_emails = [
                e.strip().lower()
                for e in os.getenv("ADMIN_EMAILS", "").split(",")
                if e.strip()
            ]
            if _admin_emails:
                _promoted = await conn.fetch(
                    "UPDATE users SET is_superuser = TRUE "
                    "WHERE lower(email) = ANY($1::text[]) "
                    "AND is_superuser IS DISTINCT FROM TRUE "
                    "RETURNING email",
                    _admin_emails,
                )
                if _promoted:
                    logger.info(
                        "Admin bootstrap: promoted %d account(s) to superuser",
                        len(_promoted),
                    )
                else:
                    logger.info(
                        "Admin bootstrap: %d email(s) configured; already admin or not found",
                        len(_admin_emails),
                    )
        except Exception as ae:
            logger.warning("Admin bootstrap skipped: %s", ae)

        # ── One-time admin password reset ─────────────────────────────────────
        # Break-glass password reset for the ADMIN_EMAILS account(s) when
        # email-based reset is unavailable. Set the ADMIN_RESET_PASSWORD secret
        # to the desired new password, redeploy once, log in, then DELETE the
        # secret. Idempotent + safe to re-run; never logs the password.
        try:
            _reset_pw = os.getenv("ADMIN_RESET_PASSWORD", "").strip()
            _reset_emails = [
                e.strip().lower()
                for e in os.getenv("ADMIN_EMAILS", "").split(",")
                if e.strip()
            ]
            if _reset_emails and _reset_pw:
                from auth import hash_password
                _hashed = hash_password(_reset_pw)
                _reset = await conn.fetch(
                    "UPDATE users SET password_hash = $2 "
                    "WHERE lower(email) = ANY($1::text[]) "
                    "RETURNING email",
                    _reset_emails,
                    _hashed,
                )
                if _reset:
                    logger.info(
                        "Admin password reset applied to %d account(s); "
                        "remove the ADMIN_RESET_PASSWORD secret now",
                        len(_reset),
                    )
                else:
                    logger.info(
                        "Admin password reset: no matching account(s) found"
                    )
        except Exception as pe:
            logger.warning("Admin password reset skipped: %s", pe)

        # ── Live Case Intelligence (Phase 1) ──────────────────────────────
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tracked_cases (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    cnr             VARCHAR(20) NOT NULL,
                    case_type       VARCHAR(50),
                    court_name      TEXT,
                    added_at        TIMESTAMPTZ DEFAULT now(),
                    last_refreshed  TIMESTAMPTZ,
                    is_active       BOOLEAN DEFAULT true,
                    tier_gated      BOOLEAN DEFAULT true,
                    UNIQUE(user_id, cnr)
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS case_snapshots (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
                    raw_response    JSONB NOT NULL,
                    case_status     VARCHAR(50),
                    next_hearing_date DATE,
                    order_count     INT DEFAULT 0,
                    fetched_at      TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_case_snapshots_tc_fetched "
                "ON case_snapshots (tracked_case_id, fetched_at DESC)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS case_events (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
                    event_type      VARCHAR(30) NOT NULL,
                    summary         TEXT,
                    detected_at     TIMESTAMPTZ DEFAULT now(),
                    notified        BOOLEAN DEFAULT false
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_case_events_tc_detected "
                "ON case_events (tracked_case_id, detected_at DESC)"
            )
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS case_notifications (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    case_event_id   UUID REFERENCES case_events(id) ON DELETE SET NULL,
                    channel         VARCHAR(20) DEFAULT 'in_app',
                    sent_at         TIMESTAMPTZ,
                    status          VARCHAR(20) DEFAULT 'pending'
                )
            """)

            # Phase 2: order embeddings table (1024-dim matches NIM nv-embedqa-e5-v5)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS case_order_embeddings (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
                    order_id        TEXT,
                    order_date      DATE,
                    order_text      TEXT NOT NULL,
                    embedding       vector(1024),
                    embedded_at     TIMESTAMPTZ DEFAULT now()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_case_order_emb_tc "
                "ON case_order_embeddings (tracked_case_id)"
            )

            # Phase 2: case-tracking email preference on users (default opt-in)
            await conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "case_tracking_emails BOOLEAN DEFAULT true"
            )

            # Phase 3: opponent intelligence cache
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS opponent_profiles (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tracked_case_id UUID NOT NULL REFERENCES tracked_cases(id) ON DELETE CASCADE,
                    opponent_name   TEXT NOT NULL,
                    total_cases_found INT DEFAULT 0,
                    profile_json    JSONB,
                    last_built_at   TIMESTAMPTZ DEFAULT now(),
                    UNIQUE(tracked_case_id)
                )
            """)

            # Phase 3: predictive next hearing date (nightly heuristic, nullable)
            await conn.execute(
                "ALTER TABLE tracked_cases ADD COLUMN IF NOT EXISTS "
                "predicted_next_hearing DATE"
            )

            logger.info("court intelligence tables ready (Phase 1 + Phase 2 + Phase 3)")
        except Exception as _ci_err:
            logger.warning("court intelligence tables init: %s", _ci_err)

    except Exception as e:
        logger.warning("DB init check: %s", e)
    finally:
        await pool.release(conn)

    assert os.environ.get("SESSION_SECRET"), \
        "SESSION_SECRET is required — set it in Replit Secrets"
    assert os.environ.get("DATABASE_URL"), \
        "DATABASE_URL is required"
    logger.info("✓ Startup checks passed")

    # Daily judgment-ingestion scheduler (production only; benign no-op without a
    # compliant API token). Returns None when disabled.
    from judgment_ingest import start_scheduler as _start_judgment_scheduler
    app.state.judgment_scheduler = _start_judgment_scheduler()

    # Daily judgment-digest scheduler (production only; reports loudly when SMTP
    # is unconfigured instead of silently mock-sending). None when disabled.
    from digest import start_scheduler as _start_digest_scheduler
    app.state.digest_scheduler = _start_digest_scheduler()

    # Bot prerender cache — attempt Playwright-based SPA snapshots at startup;
    # fall back to synthetic structured-data HTML if Playwright is not installed
    # or the frontend is not yet available.  Gracefully disabled if the seo/
    # module is unavailable.  Gate the Playwright import so startup never fails.
    try:
        from seo.schema_generator import inject_schema as _inject_schema

        async def _playwright_snapshot(_fe_path: str, _schema_html: str) -> "str | None":
            """Render an SPA route via Playwright and inject schema into the HTML."""
            try:
                from playwright.async_api import async_playwright  # type: ignore[import]
                _fe = os.getenv("FRONTEND_URL", "http://localhost:80")
                _url = f"{_fe.rstrip('/')}{_fe_path}"
                async with async_playwright() as _pw:
                    _b = await _pw.chromium.launch(headless=True)
                    _pg = await _b.new_page()
                    await _pg.goto(_url, wait_until="networkidle", timeout=12000)
                    _html = await _pg.content()
                    await _b.close()
                if _schema_html and "</head>" in _html:
                    _html = _html.replace("</head>", f"{_schema_html}\n</head>", 1)
                logger.info("bot-prerender: Playwright snapshot OK for %s", _fe_path)
                return _html
            except ImportError:
                return None  # Playwright not installed; caller uses synthetic HTML
            except Exception as _ppe:
                logger.warning("bot-prerender: Playwright failed for %s: %s", _fe_path, _ppe)
                return None

        _cache: dict = {}
        _pw_count = 0
        for _p, (_st, _sd, _ti, _de) in _BOT_PRERENDER_ROUTES.items():
            _schema_html = _inject_schema(_st, _sd)
            # Frontend SPA path: strip one BASE_PATH prefix (backend route → SPA route)
            _fe_path = _p[len(BASE_PATH):] if _p.startswith(BASE_PATH) else _p
            _snap = await _playwright_snapshot(_fe_path, _schema_html)
            if _snap is not None:
                _cache[_p] = _snap
                _pw_count += 1
            else:
                _cache[_p] = _build_prerender_html(_ti, _de, _schema_html)
        app.state.prerender_cache = _cache
        _strategy = f"Playwright×{_pw_count}" if _pw_count else "synthetic"
        logger.info("bot-prerender: cached %d routes (%s)", len(_cache), _strategy)
    except Exception as _pe:
        app.state.prerender_cache = {}
        logger.info("bot-prerender: disabled (seo module unavailable: %s)", _pe)

    # Ping search engines after every production deploy so Google/Bing/IndexNow
    # pick up new judgment pages and blog articles immediately.
    # Uses REPLIT_DEPLOYMENT — same convention as judgment-ingest and digest.
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        try:
            from seo.sitemap_manager import notify_search_engines as _ping_engines
            _ping_res = await _ping_engines()
            logger.info("sitemap: search engine pings: %s", _ping_res)
        except Exception as _pe2:
            logger.warning("sitemap: search engine ping failed (non-fatal): %s", _pe2)

    # ── Nightly case refresh scheduler ────────────────────────────────────────
    async def _case_refresh_loop():
        import asyncio as _aio
        from datetime import datetime as _dt, timezone as _tz
        while True:
            try:
                now = _dt.now(_tz.utc)
                # Fire at 02:30 UTC (08:00 IST) every day
                next_run_h, next_run_m = 2, 30
                seconds_until = (
                    ((next_run_h - now.hour) % 24) * 3600
                    + ((next_run_m - now.minute) % 60) * 60
                    - now.second
                )
                if seconds_until <= 0:
                    seconds_until += 86400
                await _aio.sleep(seconds_until)
                logger.info("court-intel: starting nightly case refresh")
                from workers.case_refresh_worker import run_refresh
                summary = await run_refresh()
                logger.info("court-intel: nightly refresh done: %s", summary)
            except _aio.CancelledError:
                break
            except Exception as _e:
                logger.exception("court-intel: nightly refresh error: %s", _e)
                await _aio.sleep(3600)  # back off 1h on error

    _ci_sched = asyncio.ensure_future(_case_refresh_loop())
    app.state.court_intel_scheduler = _ci_sched

    # ── Hourly notification retry (Phase 2) ───────────────────────────────────
    async def _notification_retry_loop():
        import asyncio as _aio
        while True:
            try:
                await _aio.sleep(3600)  # run once per hour
                logger.info("court-intel: starting hourly notification retry")
                from workers.case_refresh_worker import run_notification_retry
                result = await run_notification_retry()
                logger.info("court-intel: notification retry done: %s", result)
            except _aio.CancelledError:
                break
            except Exception as _e:
                logger.exception("court-intel: notification retry error: %s", _e)
                await _aio.sleep(300)  # back off 5 min on error

    _notif_retry_sched = asyncio.ensure_future(_notification_retry_loop())
    app.state.notif_retry_scheduler = _notif_retry_sched

    yield

    _sched = getattr(app.state, "judgment_scheduler", None)
    if _sched is not None:
        _sched.cancel()
        try:
            await _sched
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("judgment-ingest: scheduler shutdown error: %s", e)
    _ci_sched2 = getattr(app.state, "court_intel_scheduler", None)
    if _ci_sched2 is not None:
        _ci_sched2.cancel()
        try:
            await _ci_sched2
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("court-intel: scheduler shutdown error: %s", e)
    _notif_retry_sched2 = getattr(app.state, "notif_retry_scheduler", None)
    if _notif_retry_sched2 is not None:
        _notif_retry_sched2.cancel()
        try:
            await _notif_retry_sched2
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("court-intel: notif-retry scheduler shutdown error: %s", e)
    _dsched = getattr(app.state, "digest_scheduler", None)
    if _dsched is not None:
        _dsched.cancel()
        try:
            await _dsched
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("digest: scheduler shutdown error: %s", e)
    await close_pool()


app = FastAPI(
    title="LitigaForge AI",
    description="AI-powered client-lawyer matching platform for Telangana & AP",
    version="3.0.0",
    lifespan=lifespan,
    root_path=BASE_PATH,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

_cors_origins = [f"https://{d.strip()}" for d in os.getenv("REPLIT_DOMAINS", "").split(",") if d.strip()]
_frontend_url = os.environ.get("FRONTEND_URL", "").strip()
if _frontend_url:
    _cors_origins.append(_frontend_url)
# Always include the canonical production domain
_prod_domain = "https://litiga-forge-ai.replit.app"
if _prod_domain not in _cors_origins:
    _cors_origins.append(_prod_domain)
if not _cors_origins:
    _cors_origins = ["http://localhost:5173", "http://localhost:4173"]
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


# ── Bot prerender — UA pattern and route manifest ────────────────────────────
_BOT_UA_RE = _re.compile(
    r"(?:Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot"
    r"|facebot|facebookexternalhit|ia_archiver|AhrefsBot|SemrushBot|MJ12bot"
    r"|Applebot|PetalBot|BingPreview|LinkedInBot|Twitterbot|Screaming Frog)",
    _re.IGNORECASE,
)

# Maps Python API paths → (schema_type, schema_data, page_title, meta_description)
_BOT_PRERENDER_ROUTES: dict = {
    f"{BASE_PATH}/lawyers": (
        "LegalService",
        {
            "name": "Find Verified Lawyers — LitigaForge AI",
            "description": (
                "Browse AI-verified advocates in Telangana and Andhra Pradesh. "
                "Filter by practice area, language, and district."
            ),
            "service_type": "Lawyer Matching & Legal Services",
            "area_served": ["Telangana", "Andhra Pradesh", "IN"],
        },
        "Find Verified Lawyers | LitigaForge AI",
        (
            "Browse AI-verified advocates in Telangana & AP. "
            "Filter by practice area, language, and district."
        ),
    ),
    f"{BASE_PATH}/subscription": (
        "LegalService",
        {
            "name": "Subscription Plans — LitigaForge AI",
            "description": "AI-powered legal services for India from ₹0/month.",
            "offers": [
                {"name": "Free", "description": "Basic legal AI features", "price": 0, "currency": "INR"},
                {"name": "Professional", "description": "Unlimited legal Q&A + document review", "price": 999, "currency": "INR"},
                {"name": "Advocate Pro", "description": "Full platform + priority matching", "price": 2499, "currency": "INR"},
            ],
        },
        "Pricing & Plans | LitigaForge AI",
        "AI-powered legal services from ₹0/month. Unlimited Q&A, document analysis, and lawyer matching.",
    ),
    f"{BASE_PATH}/judgments": (
        "Article",
        {
            "title": "Daily Judgment Digest — Supreme Court & High Court Rulings",
            "description": (
                "Daily digest of Supreme Court of India and High Court judgments "
                "with AI-generated summaries in English and Hindi."
            ),
            "url": "https://litigaforge.com/judgments",
            "date_published": "2024-01-01",
        },
        "Daily Judgment Digest | Supreme Court & High Court | LitigaForge AI",
        "AI summaries of Supreme Court and Telangana & AP High Court rulings. Free daily digest.",
    ),
    f"{BASE_PATH}/ask": (
        "FAQPage",
        {
            "questions": [
                {"q": "Can I get free legal advice in India?",
                 "a": "Yes. LitigaForge AI provides free AI-powered legal Q&A. For complex cases, NALSA provides free legal aid to eligible individuals."},
                {"q": "How do I find a lawyer in Telangana?",
                 "a": "Use LitigaForge AI to post your case and get AI-matched with verified advocates in Telangana based on practice area, language, and district."},
                {"q": "What is LitigaForge AI?",
                 "a": "LitigaForge AI is an AI-powered legal platform for Telangana & AP that matches clients with verified lawyers and provides instant legal analysis."},
            ]
        },
        "Free Legal Q&A | LitigaForge AI",
        "Get instant AI-powered answers to your legal questions. Free legal Q&A for India.",
    ),
}


def _build_prerender_html(page_title: str, meta_desc: str, schema_html: str) -> str:
    """Minimal crawler-visible HTML with JSON-LD; used when Playwright is unavailable."""
    _su = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com")
    return (
        f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{page_title}</title>'
        f'<meta name="description" content="{meta_desc}">'
        f'<link rel="canonical" href="{_su}">'
        f'<meta property="og:title" content="{page_title}">'
        f'<meta property="og:description" content="{meta_desc}">'
        f'{schema_html}</head><body>'
        f'<h1>{page_title}</h1><p>{meta_desc}</p>'
        f'<a href="{_su}">LitigaForge AI — AI-Powered Legal Platform</a>'
        f'</body></html>'
    )


def _build_judgment_prerender(slug: str) -> str:
    """On-demand Article-schema HTML for judgment detail bot hits.

    Cached in app.state.prerender_cache after the first bot request so
    subsequent crawls are instant.  Returns empty string on any failure
    so the middleware can fall through to call_next gracefully.
    """
    try:
        from seo.schema_generator import inject_schema as _isj
        _su = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com")
        _readable = slug.replace("-", " ").title()
        _title = f"{_readable} | Case Law | LitigaForge AI"
        _desc = (
            f"Read the full text and AI summary of {_readable} on LitigaForge AI — "
            "India's AI-powered legal research platform."
        )
        _schema = _isj("Article", {
            "title": _title,
            "description": _desc,
            "url": f"{_su}/judgments/item/{slug}",
            "date_published": "2024-01-01",
        })
        return _build_prerender_html(_title, _desc, _schema)
    except Exception:
        return ""


_PRERENDER_SECURITY_HEADERS = {
    "X-Prerender-Cache": "HIT",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}


@app.middleware("http")
async def bot_prerender_middleware(request: Request, call_next):
    """Serve pre-cached HTML with JSON-LD to known crawler UAs on key routes.

    Bots receive a lightweight, schema-enriched HTML page rather than raw API
    JSON — improving Google / Bing structured-data coverage.  Non-bot UAs,
    explicit application/json Accept headers, and uncached paths pass through
    transparently.  Security headers are applied inline to prerender responses.
    """
    ua = request.headers.get("User-Agent", "")
    if not _BOT_UA_RE.search(ua):
        return await call_next(request)

    if request.method != "GET":
        return await call_next(request)

    # Clients explicitly requesting JSON get the normal API payload
    accept = request.headers.get("Accept", "")
    if "application/json" in accept and "text/html" not in accept:
        return await call_next(request)

    # Replit's proxy prepends BASE_PATH when forwarding to the backend port,
    # AND uvicorn has root_path=BASE_PATH, so request.url.path ends up as
    # /litigaforge/litigaforge/lawyers (double prefix). Normalize it.
    raw_path = request.scope.get("path", request.url.path)
    double_prefix = BASE_PATH + BASE_PATH
    if raw_path.startswith(double_prefix):
        path = BASE_PATH + raw_path[len(double_prefix):]
    else:
        path = raw_path
    cache: dict = getattr(app.state, "prerender_cache", {})
    if path in cache:
        logger.info("bot-prerender: HIT %s (UA: %.60s)", path, ua)
        return HTMLResponse(content=cache[path], headers=_PRERENDER_SECURITY_HEADERS)

    # Wildcard: judgment detail pages — generated on first bot hit, then cached.
    # Supports /litigaforge/judgments/item/{court}/{year}/{slug} and the shorter
    # /litigaforge/judgments/item/{slug} used by the redirect layer.
    _jdg_prefix = f"{BASE_PATH}/judgments/item/"
    if path.startswith(_jdg_prefix):
        _slug = path[len(_jdg_prefix):].strip("/").replace("/", "-")
        if _slug:
            _snap = _build_judgment_prerender(_slug)
            if _snap:
                cache[path] = _snap
                logger.info("bot-prerender: MISS→built judgment slug=%s", _slug)
                return HTMLResponse(
                    content=_snap,
                    headers={**_PRERENDER_SECURITY_HEADERS, "X-Prerender-Cache": "BUILT"},
                )

    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Industry-standard security headers on every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), usb=(), "
        "accelerometer=(), gyroscope=(), magnetometer=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.razorpay.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.razorpay.com https://indiankanoon.org https://accounts.google.com https://oauth2.googleapis.com; "
        "frame-src https://api.razorpay.com https://maps.google.com https://www.google.com; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith(
        f"{BASE_PATH}/auth"
    ) else response.headers.get("Cache-Control", "no-cache")
    # Replit always terminates TLS — HSTS is safe to send on all responses
    response.headers["Strict-Transport-Security"] = (
        "max-age=63072000; includeSubDomains; preload"
    )
    return response

# ─── Include Routers ──────────────────────────────────────────────────────────
from routers import (
    auth_router, subscription_router,
    matching_router, chat_router, community_router,
    watch_router, alerts_router, admin_router,
    lawyer_router, documents_free_router,
    paid_documents_router,
    passkeys_router, push_router,
    judgments_router, research_router,
    llm_router, workspace_router, personalization_router,
    presence_router, cnr_router,
    court_intelligence_router,
)
from country_router import router as country_router

@app.get(f"{BASE_PATH}/healthz", tags=["health"])
async def healthz():
    return {"status": "ok", "service": "litigaforge-ai"}

app.include_router(auth_router,         prefix=BASE_PATH)
app.include_router(matching_router,     prefix=BASE_PATH)
app.include_router(subscription_router, prefix=BASE_PATH)
app.include_router(chat_router,        prefix=BASE_PATH)
app.include_router(community_router,   prefix=BASE_PATH)
app.include_router(watch_router,       prefix=BASE_PATH)
app.include_router(alerts_router,      prefix=BASE_PATH)
app.include_router(admin_router,       prefix=BASE_PATH)
app.include_router(lawyer_router,      prefix=BASE_PATH)
app.include_router(documents_free_router, prefix=BASE_PATH)
app.include_router(paid_documents_router, prefix=BASE_PATH)
app.include_router(passkeys_router,    prefix=BASE_PATH)
app.include_router(push_router,        prefix=BASE_PATH)
app.include_router(judgments_router,   prefix=BASE_PATH)
app.include_router(research_router,    prefix=BASE_PATH)
app.include_router(country_router,     prefix=BASE_PATH)
app.include_router(llm_router,         prefix=BASE_PATH)
app.include_router(workspace_router,        prefix=BASE_PATH)
app.include_router(personalization_router,  prefix=BASE_PATH)
app.include_router(presence_router,         prefix=BASE_PATH)
app.include_router(cnr_router,              prefix=BASE_PATH)
app.include_router(court_intelligence_router, prefix=BASE_PATH)

# Static fallback used when sitemap_manager is unavailable
_STATIC_SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://litigaforge.com/</loc><lastmod>2026-06-08</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
<url><loc>https://litigaforge.com/lawyers</loc><lastmod>2026-06-08</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://litigaforge.com/ask</loc><lastmod>2026-06-08</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://litigaforge.com/judgments</loc><lastmod>2026-06-08</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://litigaforge.com/subscription</loc><lastmod>2026-06-08</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
<url><loc>https://litigaforge.com/legal-aid</loc><lastmod>2026-06-08</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
<url><loc>https://litigaforge.com/free-documents</loc><lastmod>2026-06-08</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
<url><loc>https://litigaforge.com/blog</loc><lastmod>2026-06-08</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://litigaforge.com/about</loc><lastmod>2026-06-08</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
<url><loc>https://litigaforge.com/contact</loc><lastmod>2026-06-08</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>"""


@app.get(f"{BASE_PATH}/sitemap.xml", include_in_schema=False)
async def serve_sitemap():
    """Dynamic merged sitemap: static app routes + live judgment pages + blog posts.
    Falls back to the static manifest if sitemap_manager is unavailable.
    Cached for 1 hour by CDN / proxy.
    """
    try:
        from seo.sitemap_manager import build_sitemap_xml
        content = await build_sitemap_xml()
    except Exception as _e:
        logger.warning("sitemap_manager unavailable — serving static fallback: %s", _e)
        content = _STATIC_SITEMAP_XML
    return Response(
        content=content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get(f"{BASE_PATH}/llms.txt", include_in_schema=False)
async def serve_llms_txt():
    content = """# LitigaForge AI

> LitigaForge AI is a global AI-powered platform providing expert legal guidance, document analysis, lawyer matching and free legal aid worldwide — available in English, Hindi, Telugu.

## Core Services
- [Legal AI Chat](/ai-legal-chat)
- [Document Analyzer](/document-analyzer)
- [Legal Q&A](/legal-qa)
- [Lawyer Matching](/match-proposals)
- [Judgment Finder](/judgments)
- [Free Legal Aid](/free-legal-aid)
- [Post a Case](/post-case)

## Coverage
India (Telangana, AP, Maharashtra, Delhi),
USA, UK, UAE, Australia, Canada, Singapore

## Languages
English, Telugu, Hindi"""
    return Response(content=content, media_type="text/plain; charset=utf-8")

# ── Authenticated secure file serving (Replit Object Storage) ────────────────
# Files are stored in Replit Object Storage (GCS-backed), not local disk.
# Every download goes through this endpoint which verifies ownership first.

def _get_storage():
    try:
        from replit.object_storage import Client as _OSClient
        return _OSClient()
    except Exception:
        return None


# ── Public static file serving (no auth — for user guide / public assets) ───

@app.get(f"{BASE_PATH}/public/{{filename}}")
async def serve_public_file(filename: str):
    """Serve public assets (e.g. user guide PDF) — no authentication required."""
    import pathlib as _pl
    safe = os.path.basename(filename)
    if safe != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid file path")
    _public_dir = _pl.Path(_script_dir) / "public"
    fp = _public_dir / safe
    if not fp.exists():
        raise HTTPException(status_code=404, detail="File not found")
    ext = safe.rsplit(".", 1)[-1].lower() if "." in safe else "bin"
    mime_map = {
        "pdf": "application/pdf", "png": "image/png",
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "txt": "text/plain",
    }
    media_type = mime_map.get(ext, "application/octet-stream")
    return Response(
        content=fp.read_bytes(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe}"',
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get(f"{BASE_PATH}/secure-files/{{filename}}")
async def serve_secure_file(
    filename: str,
    current_user: dict = Depends(_require_user),
):
    """
    Serve an uploaded case document only to the client who owns it or the
    assigned lawyer — never publicly. Prevents path traversal via basename check.
    """
    # Block path traversal
    safe = os.path.basename(filename)
    if safe != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Ownership check via DB
    file_url = f"/secure-files/{safe}"
    doc = await db_fetchrow(
        """SELECT d.client_id, d.file_path, c.lawyer_id
           FROM client_documents d
           LEFT JOIN lawyer_cases c ON d.case_id = c.id
           WHERE d.file_url = $1""",
        file_url,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    uid = current_user["id"]
    if doc["client_id"] != uid and (doc["lawyer_id"] is None or doc["lawyer_id"] != uid):
        raise HTTPException(status_code=403, detail="Access denied")

    # Try Object Storage first
    storage = _get_storage()
    obj_key = doc.get("file_path") or ""
    if storage and obj_key and not obj_key.startswith("/"):
        try:
            content = storage.download_as_bytes(obj_key)
            ext = safe.rsplit(".", 1)[-1].lower() if "." in safe else "bin"
            mime_map = {
                "pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "doc": "application/msword",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "txt": "text/plain",
            }
            media_type = mime_map.get(ext, "application/octet-stream")
            return Response(
                content=content,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{safe}"',
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except Exception as e:
            logger.warning("Object storage fetch failed for %s: %s", safe, e)

    # Fallback: local disk (legacy uploads before migration)
    import pathlib as _pl
    _uploads_dir = os.path.join(_script_dir, "uploads")
    fp = _pl.Path(_uploads_dir) / safe
    try:
        fp.resolve().relative_to(_pl.Path(_uploads_dir).resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if fp.is_file():
        return FileResponse(
            str(fp),
            headers={
                "Content-Disposition": f'attachment; filename="{safe}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        root_path=BASE_PATH,
        reload=os.getenv("RELOAD", "false").lower() == "true",
    )
