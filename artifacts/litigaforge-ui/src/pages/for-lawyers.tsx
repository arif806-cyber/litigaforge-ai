import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileSearch,
  Files,
  Gavel,
  ListChecks,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PublicSiteFooter, PublicSiteHeader } from "@/components/public-site-header";
import { useAuth } from "@/lib/auth-context";
import { BUSINESS_CONFIG } from "@/lib/business-config";
import { trackEvent } from "@/lib/analytics";
import sharedPlanPrices from "../../../../shared-plan-prices.json";
import "./landing.css";
import "./for-lawyers.css";

const advocatePrices = sharedPlanPrices.advocate;

const plans = [
  {
    id: "free",
    name: advocatePrices.free.name,
    monthly: advocatePrices.free.monthly,
    annual: advocatePrices.free.annual,
    description: "A practical starting point for a small advocate workflow.",
    features: ["5 cases per month", "Legal Q&A with AI", "Document analyzer", "Email support"],
    cta: "Create a free account",
    href: "/register?role=advocate",
  },
  {
    id: "professional",
    name: advocatePrices.professional.name,
    monthly: advocatePrices.professional.monthly,
    annual: advocatePrices.professional.annual,
    description: "For independent advocates managing an active practice.",
    features: ["50 cases per month", "Case documents and history", "WhatsApp hearing alerts", "Priority support"],
    cta: "Choose Advocate Pro",
    href: "/register?role=advocate&plan=professional&billing=monthly",
    badge: "30-day free trial",
  },
  {
    id: "advocate_pro",
    name: advocatePrices.advocate_pro.name,
    monthly: advocatePrices.advocate_pro.monthly,
    annual: advocatePrices.advocate_pro.annual,
    description: "For chambers that need more room and deeper AI support.",
    features: ["Unlimited cases", "For chambers of up to 5 advocates", "Advanced multi-model AI", "Dedicated advocate support"],
    cta: "Choose Chamber",
    href: "/register?role=advocate&plan=advocate_pro&billing=monthly",
  },
] as const;

const faqs = [
  {
    q: "Does the Advocate Pro trial require a payment method?",
    a: "No. The 30-day trial does not require a payment. If you decide to continue on a paid plan, you can choose and complete checkout separately.",
  },
  {
    q: "Can LitigaForge replace legal judgment or source review?",
    a: "No. Research and AI outputs are assistance, not legal advice or a final opinion. Review the linked judgment, official statute text where available, and the facts of your matter before relying on them.",
  },
  {
    q: "What does a shared Court Day board update mean?",
    a: "Court Day can show board positions shared by verified advocates, with freshness and confirmation states. It is not an official court display board, and it does not use court live streams or scrape display boards.",
  },
  {
    q: "Which legal data sources are used?",
    a: "Depending on the feature and configured access, LitigaForge uses eCourts case data, Indian Kanoon judgment records, and indexed official statute text from India Code. Availability is shown honestly; an unverified or unavailable source should not be treated as confirmed.",
  },
  {
    q: "Is Chamber suitable for a five-advocate practice?",
    a: "The published Chamber plan includes unlimited cases for chambers of up to five advocates, advanced multi-model AI, case documents and history, and dedicated advocate support.",
  },
];

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function trackAdvocateCta(placement: string, plan = "none") {
  trackEvent("advocate_acquisition_cta", { placement, plan });
}

function AdvocateNavbar() {
  const { user } = useAuth();
  const links = [
    { href: "#workflow", label: "Court day" },
    { href: "#research", label: "Research" },
    { href: "#pricing", label: "Advocate plans" },
    { href: "#faq", label: "FAQ" },
  ];
  const actions = (
    <>
      {!user && <Link href="/login" className="adv-nav-signin">Sign in</Link>}
      <Link
        href={user ? "/lawyer-dashboard" : "/register?role=advocate"}
        className="lf-button lf-button-small"
        data-testid="button-header-advocate-start"
        onClick={() => trackAdvocateCta("header")}
      >
        {user ? "Open dashboard" : "Start free"}<ArrowRight size={15} />
      </Link>
    </>
  );

  return (
    <PublicSiteHeader
      links={links}
      mobileMenu
      actions={actions}
      mobileActions={
        <>
          {!user && <Link href="/login" className="adv-mobile-signin">Sign in to your account</Link>}
          <Link
            href={user ? "/lawyer-dashboard" : "/register?role=advocate"}
            className="lf-button"
            onClick={() => trackAdvocateCta("mobile_header")}
          >
            {user ? "Open advocate dashboard" : "Start free as an advocate"}<ArrowRight size={16} />
          </Link>
        </>
      }
    />
  );
}

function CourtDayPreview() {
  return (
    <aside className="adv-preview" aria-label="Illustrative Court Day product preview" data-testid="court-day-preview">
      <div className="adv-preview-topbar">
        <span className="adv-preview-brand"><Gavel size={15} /> Court Day</span>
        <span className="adv-preview-status"><span /> Illustrative preview</span>
      </div>
      <div className="adv-preview-heading">
        <div>
          <span className="adv-preview-overline">TODAY · FICTIONAL DATA</span>
          <h2>Three matters.<br />One clear plan.</h2>
        </div>
        <span className="adv-preview-date">MON<br /><strong>26</strong></span>
      </div>
      <div className="adv-preview-list">
        <article className="adv-preview-item">
          <span className="adv-preview-time">08:45</span>
          <span className="adv-preview-icon"><ListChecks size={17} /></span>
          <div><strong>Cause lists matched</strong><p>Your listed matters, organized before you leave.</p></div>
          <span className="adv-preview-tag">READY</span>
        </article>
        <article className="adv-preview-item adv-preview-item-active">
          <span className="adv-preview-time">10:30</span>
          <span className="adv-preview-icon"><Clock3 size={17} /></span>
          <div><strong>Court Hall 4 · Item 18</strong><p>Shared board update with a visible freshness state.</p></div>
          <span className="adv-preview-tag">LAST KNOWN</span>
        </article>
        <article className="adv-preview-item">
          <span className="adv-preview-time">11:15</span>
          <span className="adv-preview-icon"><FileCheck2 size={17} /></span>
          <div><strong>Hearing brief prepared</strong><p>Case details, recent orders and saved notes together.</p></div>
          <span className="adv-preview-tag">REVIEW</span>
        </article>
      </div>
      <div className="adv-preview-bottom">
        <ShieldCheck size={16} />
        <span>Professional review stays in your hands.</span>
        <span className="adv-preview-index">01 / 03</span>
      </div>
    </aside>
  );
}

function Hero() {
  return (
    <section className="adv-hero" aria-labelledby="advocate-hero-title">
      <div className="adv-hero-inner">
        <div className="adv-hero-copy">
          <div className="lf-kicker"><span className="lf-kicker-line" /> For advocates &amp; chambers in India</div>
          <h1 id="advocate-hero-title">Your court day.<br /><em>One clear workspace.</em></h1>
          <p className="adv-hero-lede">Track matters, match cause lists, prepare hearing briefs, and research with citations you can verify—without stitching together disconnected tools.</p>
          <div className="adv-hero-actions">
            <Link
              href="/register?role=advocate"
              className="lf-button"
              data-testid="button-hero-advocate-start"
              onClick={() => trackAdvocateCta("hero")}
            >
              Start free as an advocate <ArrowRight size={17} />
            </Link>
            <a href="#pricing" className="adv-text-link">Compare advocate plans <ArrowUpRight size={15} /></a>
          </div>
          <div className="adv-hero-assurance">
            <span><Check size={14} /> Free plan available</span>
            <span><Check size={14} /> 30-day Pro trial</span>
            <span><Check size={14} /> No payment for trial</span>
          </div>
        </div>
        <CourtDayPreview />
      </div>
      <div className="adv-hero-principles">
        <div><BadgeCheck size={18} /><span><strong>Verification states</strong>Know what is sourced, unverified or unavailable.</span></div>
        <div><Clock3 size={18} /><span><strong>Freshness, not false certainty</strong>Shared board updates show when they were last known.</span></div>
        <div><Scale size={18} /><span><strong>Advocate judgment first</strong>AI supports the work; it does not replace professional review.</span></div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps: { number: string; icon: ReactNode; title: string; body: string; points: string[] }[] = [
    {
      number: "01",
      icon: <CalendarDays size={21} />,
      title: "Before court",
      body: "Start with the matters you already track, then bring the day’s listings into focus.",
      points: ["Track cases by CNR", "Review case status and next hearings", "Match configured cause lists to your matters"],
    },
    {
      number: "02",
      icon: <BookOpenCheck size={21} />,
      title: "Prepare to appear",
      body: "Move from case history to a concise brief and check the authorities you intend to use.",
      points: ["Prepare a factual hearing brief", "Keep recent orders and saved notes together", "Verify citations against available indexes"],
    },
    {
      number: "03",
      icon: <Files size={21} />,
      title: "Move the matter forward",
      body: "Keep the next step connected to the same case record instead of rebuilding context.",
      points: ["Organize case documents and history", "Continue drafting in the workspace", "Use hearing alerts where configured"],
    },
  ];

  return (
    <section id="workflow" className="adv-workflow" aria-labelledby="workflow-title">
      <div className="adv-section-heading">
        <div className="lf-kicker"><span className="lf-kicker-line" /> The daily litigation workflow</div>
        <h2 id="workflow-title">Less reconstructing.<br /><em>More legal thinking.</em></h2>
        <p>LitigaForge connects the work around a hearing—not just the hearing date itself.</p>
      </div>
      <div className="adv-workflow-grid">
        {steps.map((step) => (
          <article className="adv-workflow-card" key={step.number}>
            <div className="adv-workflow-card-top"><span>{step.number} / COURT DAY</span><span className="adv-workflow-icon">{step.icon}</span></div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <ul>{step.points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResearchSection() {
  return (
    <section id="research" className="adv-research" aria-labelledby="research-title">
      <div className="adv-research-copy">
        <div className="lf-kicker"><span className="lf-kicker-line" /> Research with a verification trail</div>
        <h2 id="research-title">Find the authority.<br /><em>Inspect the basis.</em></h2>
        <p>Search Indian judgment records, inspect relevant passages and citing decisions, retrieve indexed statute sections, and check citations before they enter your draft.</p>
        <Link href="/judgments" className="adv-research-link" onClick={() => trackAdvocateCta("research")}>Explore Judgment Finder <ArrowUpRight size={16} /></Link>
      </div>
      <div className="adv-research-tools">
        <article><FileSearch size={20} /><div><h3>Judgments in context</h3><p>Search records, passages and citing judgments rather than relying on a citation alone.</p></div><span>01</span></article>
        <article><BookOpenCheck size={20} /><div><h3>Statutes and code transitions</h3><p>Retrieve indexed official sections and use IPC/CrPC/Evidence Act to BNS/BNSS/BSA crosswalks.</p></div><span>02</span></article>
        <article><BadgeCheck size={20} /><div><h3>Clear verification states</h3><p>Separate verified matches from records that are unavailable or still require primary-source review.</p></div><span>03</span></article>
      </div>
    </section>
  );
}

function AdvocatePlansSection() {
  return (
    <section id="pricing" className="adv-pricing" aria-labelledby="pricing-title">
      <div className="adv-pricing-heading">
        <div>
          <div className="lf-kicker"><span className="lf-kicker-line" /> Published advocate plans</div>
          <h2 id="pricing-title">Start with your practice.<br /><em>Not a consumer bundle.</em></h2>
        </div>
        <p>These are advocate plans, separate from LitigaForge’s public client pricing. Monthly prices below exclude 18% GST.</p>
      </div>
      <div className="adv-plan-grid" data-testid="advocate-plan-grid">
        {plans.map((plan) => (
          <article className={`adv-plan-card ${plan.id === "professional" ? "adv-plan-card-featured" : ""}`} key={plan.id} data-testid={`advocate-plan-${plan.id}`}>
            {"badge" in plan && <span className="adv-plan-badge">{plan.badge}</span>}
            <div className="adv-plan-name"><span>{plan.name}</span>{plan.id === "advocate_pro" ? <Users size={20} /> : <BriefcaseBusiness size={20} />}</div>
            <p className="adv-plan-description">{plan.description}</p>
            <div className="adv-plan-price">
              <strong>{plan.monthly === 0 ? "₹0" : `₹${formatInr(plan.monthly)}`}</strong><span>/ month</span>
            </div>
            <p className="adv-plan-billing">{plan.monthly === 0 ? "No paid subscription required" : `+ 18% GST · Annual ₹${formatInr(plan.annual)} + GST`}</p>
            {plan.id === "professional" && <p className="adv-plan-trial">Try Pro free for 30 days. No payment required for the trial.</p>}
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>
            <Link
              href={plan.href}
              className={`adv-plan-button ${plan.id === "professional" ? "adv-plan-button-primary" : ""}`}
              data-testid={`button-plan-${plan.id}`}
              onClick={() => trackAdvocateCta("pricing", plan.id)}
            >
              {plan.cta}<ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      <p className="adv-pricing-note"><LockKeyhole size={14} /> Paid checkout is secured by Razorpay. Selecting a plan here creates your account intent; you review and confirm any trial or payment on the subscription page.</p>
    </section>
  );
}

function McpSection() {
  return (
    <section className="adv-mcp" aria-labelledby="mcp-title">
      <div className="adv-mcp-mark"><span>API</span><span>MCP</span><span>JSON</span></div>
      <div className="adv-mcp-copy">
        <div className="lf-kicker"><span className="lf-kicker-line" /> For firms &amp; legal-tech teams</div>
        <h2 id="mcp-title">Bring verified legal-data access<br /><em>into your own workflow.</em></h2>
        <p>Use LitigaForge’s read-only MCP connector for eligible case data, judgment research, statute retrieval, citation checks and hearing briefs. Access is authenticated and plan-based.</p>
      </div>
      <div className="adv-mcp-action">
        <ul><li><Check size={15} /> OAuth 2.1 with PKCE</li><li><Check size={15} /> Read-only tools with provenance</li><li><Check size={15} /> Published plan quotas</li></ul>
        <Link href="/mcp-docs" className="adv-text-link" data-testid="link-mcp-docs" onClick={() => trackAdvocateCta("mcp")}>Read the MCP documentation <ArrowUpRight size={16} /></Link>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="adv-faq" aria-labelledby="faq-title">
      <div className="adv-faq-heading">
        <div className="lf-kicker"><span className="lf-kicker-line" /> Before you begin</div>
        <h2 id="faq-title">Straight answers.<br /><em>No hidden assumptions.</em></h2>
        <p>Understand the trial, the sources and the limits before you bring your practice onto the platform.</p>
      </div>
      <div className="adv-faq-list">
        {faqs.map((faq, index) => (
          <details key={faq.q} open={index === 0}>
            <summary>{faq.q}<ChevronDown size={18} /></summary>
            <p>{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function AdvocateFooter() {
  return (
    <PublicSiteFooter className="lf-footer adv-footer">
      <div className="lf-footer-main">
        <div className="lf-footer-brand">
          <Link href="/" className="lf-brand"><span className="lf-brand-mark"><Scale size={19} /></span><span>LitigaForge <i>AI</i></span></Link>
          <p>Practical litigation workflows for advocates and chambers in India.</p>
        </div>
        <div className="lf-footer-links">
          <div><strong>Advocates</strong><a href="#workflow">Court Day</a><a href="#pricing">Advocate plans</a><Link href="/workspace">Workspace preview</Link><Link href="/mcp-docs">MCP connector</Link></div>
          <div><strong>Information</strong><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={BUSINESS_CONFIG.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp support · {BUSINESS_CONFIG.whatsappPhone}</a></div>
        </div>
        <Link href="/register?role=advocate" className="lf-button" onClick={() => trackAdvocateCta("footer")}>Start free <ArrowRight size={16} /></Link>
      </div>
      <div className="lf-footer-bottom">
        <span>© {new Date().getFullYear()} LitigaForge AI · Arivex AI Private Limited</span>
        <span>AI-generated information is not legal advice. Verify sources and exercise professional judgment.</span>
      </div>
    </PublicSiteFooter>
  );
}

export default function ForLawyersPage() {
  return (
    <main className="lf-page advocate-page" data-testid="advocate-acquisition-page">
      <SEOHelmet
        title="LitigaForge for Advocates — Court Day & Research"
        description="Track cases, match cause lists, prepare hearing briefs and verify Indian legal research. Compare Free, Advocate Pro and Chamber plans."
        canonical="/for-lawyers"
        keywords="advocate software India, court day workflow, cause list matching, hearing brief, chamber management, Indian legal research"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: "LitigaForge for Advocates",
              url: "https://litigaforge.com/for-lawyers",
              description: "Court Day, case tracking, hearing preparation and Indian legal research for advocates and chambers.",
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            },
          ],
        }}
      />
      <AdvocateNavbar />
      <Hero />
      <WorkflowSection />
      <ResearchSection />
      <AdvocatePlansSection />
      <McpSection />
      <FaqSection />
      <section className="adv-final-cta">
        <span>YOUR NEXT COURT DAY</span>
        <h2>Bring the matter.<br /><em>Keep the context.</em></h2>
        <p>Create a free advocate account, then decide whether Pro or Chamber fits your practice.</p>
        <Link href="/register?role=advocate" className="lf-button lf-button-light" data-testid="button-final-advocate-start" onClick={() => trackAdvocateCta("final")}>Start free as an advocate <ArrowRight size={17} /></Link>
      </section>
      <AdvocateFooter />
    </main>
  );
}
