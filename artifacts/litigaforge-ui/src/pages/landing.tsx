import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness, Check, ChevronDown, FileSearch, LockKeyhole, Menu, Scale, Search, ShieldCheck, Users, X } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BUSINESS_CONFIG } from "@/lib/business-config";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import "./landing.css";

type PublicStats = {
  judgments_in_digest?: unknown;
  guides?: unknown;
  verified_lawyers?: unknown;
};

const faqItems = [
  {
    q: "What is LitigaForge AI?",
    a: "LitigaForge brings practical legal research and case-management tools into one place. Advocates can organize their work and explore legal resources; clients can understand a question, prepare information, and find the right next step.",
  },
  {
    q: "Does LitigaForge replace advice from an advocate?",
    a: "No. AI-generated information is a starting point, not legal advice. Verify important information with a qualified legal professional who can consider the facts of your matter.",
  },
  {
    q: "Can clients and advocates use the same tools?",
    a: "The platform supports both workflows. Client-facing tools help people prepare and explore options, while advocate tools focus on research, organization, and day-to-day legal work.",
  },
  {
    q: "How is my information handled?",
    a: "LitigaForge is designed with privacy in mind. Avoid submitting sensitive personal information unless it is necessary for the feature you are using, and review the Privacy Policy for details about platform data practices.",
  },
];

function formatCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat().format(value)
    : null;
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const links = [
    { label: "For advocates", href: "#advocates" },
    { label: "For clients", href: "#clients" },
    { label: "Tools", href: "#tools" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header className="lf-nav">
      <nav className="lf-nav-inner" aria-label="Main navigation">
        <Link href="/" className="lf-brand" aria-label="LitigaForge AI home">
          <span className="lf-brand-mark"><Scale size={19} strokeWidth={1.8} /></span>
          <span>LitigaForge <i>AI</i></span>
        </Link>
        <div className="lf-nav-links">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </div>
        <div className="lf-nav-actions">
          <LanguageSwitcher />
          <CountrySwitcher />
          {user && <Link href="/workspace" className="lf-nav-workspace">Workspace <ArrowUpRight size={14} /></Link>}
          <Link href="/login" className="lf-button lf-button-small">Get started <ArrowRight size={15} /></Link>
        </div>
        <button
          type="button"
          className="lf-menu-toggle"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>
      {menuOpen && (
        <div className="lf-mobile-menu">
          {links.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
          <div className="lf-mobile-switchers"><LanguageSwitcher /><CountrySwitcher /></div>
          {user && <Link href="/workspace" onClick={() => setMenuOpen(false)}>Open workspace <ArrowUpRight size={15} /></Link>}
          <Link href="/login" className="lf-button" onClick={() => setMenuOpen(false)}>Get started <ArrowRight size={16} /></Link>
        </div>
      )}
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="lf-preview-stage" aria-label="LitigaForge product previews">
      <figure className="lf-finder-preview">
        <figcaption><span className="lf-live-dot" /> Judgment Finder <span className="lf-caption-muted">Product preview</span></figcaption>
        <img src="/judgment-finder-preview.jpg" alt="LitigaForge Judgment Finder interface showing a searchable collection of judgment summaries" />
      </figure>
      <figure className="lf-dashboard-placeholder">
        <div className="lf-placeholder-head">
          <span className="lf-placeholder-icon"><BriefcaseBusiness size={16} /></span>
          <span>Advocate workspace</span>
          <span className="lf-pending-pill">Preview pending</span>
        </div>
        <div className="lf-placeholder-body">
          <div className="lf-placeholder-stamp"><Scale size={24} /></div>
          <p>Dashboard screenshot pending</p>
          <span>A genuine product capture will appear here.</span>
        </div>
      </figure>
      <div className="lf-preview-note"><span>01</span> Research, organized for the work ahead</div>
    </div>
  );
}

function Hero() {
  return (
    <section className="lf-hero" aria-labelledby="hero-title">
      <div className="lf-hero-grid">
        <div className="lf-hero-copy">
          <div className="lf-kicker"><span className="lf-kicker-line" /> Practical legal work, better supported</div>
          <h1 id="hero-title">Clarity for the work.<br /><em>Confidence in the next step.</em></h1>
          <p className="lf-hero-lede">Research, organize cases, and move legal work forward with tools built for advocates and the people they represent.</p>
          <div className="lf-hero-actions">
            <Link href="/login" className="lf-button">Get started <ArrowRight size={17} /></Link>
            <a className="lf-text-link" href="#tools">Explore the tools <ArrowDown size={15} /></a>
          </div>
          <div className="lf-hero-footnote"><ShieldCheck size={16} /> Useful tools, with people and professional judgment at the centre.</div>
        </div>
        <ProductPreview />
      </div>
      <div className="lf-hero-index" aria-hidden="true">LEGAL WORK / MADE CLEAR</div>
    </section>
  );
}

function PublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch("/stats")
      .then((result) => {
        if (active && result && typeof result === "object") setStats(result as PublicStats);
      })
      .catch(() => {
        // An unavailable public endpoint is not evidence of zero activity.
        if (active) setStats(null);
      });
    return () => { active = false; };
  }, []);

  const items = [
    { key: "judgments_in_digest" as const, label: "Judgments in the digest", value: formatCount(stats?.judgments_in_digest) },
    { key: "guides" as const, label: "Practical legal guides", value: formatCount(stats?.guides) },
    { key: "verified_lawyers" as const, label: "Verified advocates", value: formatCount(stats?.verified_lawyers) },
  ].filter((item) => item.value !== null && (item.key !== "verified_lawyers" || Number(stats?.verified_lawyers) >= 10));

  if (!items.length) return null;
  return (
    <section className="lf-stats" aria-label="LitigaForge public resources">
      <div className="lf-stats-inner">
        <span className="lf-stats-label">A growing legal resource</span>
        <div className="lf-stats-list">
          {items.map((item) => (
            <div className="lf-stat" key={item.key}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSections() {
  return (
    <section className="lf-workflows" aria-label="Ways to use LitigaForge">
      <div className="lf-section-intro">
        <div className="lf-kicker"><span className="lf-kicker-line" /> Two perspectives, one clearer process</div>
        <h2>Tools that meet you<br /><em>where the work begins.</em></h2>
      </div>
      <div className="lf-workflow-grid">
        <article id="advocates" className="lf-workflow lf-workflow-advocate">
          <div className="lf-workflow-number">01 / ADVOCATES</div>
          <div className="lf-workflow-icon"><BriefcaseBusiness size={22} /></div>
          <h3>Make more room<br />for legal thinking.</h3>
          <p>Bring research, case organization, drafting support, and repeatable workflows into a focused working space.</p>
          <ul>
            <li><Check size={15} /> Find and review relevant judgments</li>
            <li><Check size={15} /> Keep case work in one place</li>
            <li><Check size={15} /> Use drafting and analysis tools as support</li>
          </ul>
          <Link href="/workspace" className="lf-workflow-link">Explore advocate tools <ArrowUpRight size={16} /></Link>
        </article>
        <article id="clients" className="lf-workflow lf-workflow-client">
          <div className="lf-workflow-number">02 / CLIENTS</div>
          <div className="lf-workflow-icon"><Users size={22} /></div>
          <h3>Understand your options.<br />Prepare with purpose.</h3>
          <p>Start with a question, organize the facts that matter, and find a more informed path to professional help.</p>
          <ul>
            <li><Check size={15} /> Explore legal questions in plain language</li>
            <li><Check size={15} /> Prepare documents and case details</li>
            <li><Check size={15} /> Discover ways to connect with an advocate</li>
          </ul>
          <Link href="/legal-aid" className="lf-workflow-link">Explore client resources <ArrowUpRight size={16} /></Link>
        </article>
      </div>
      <p className="lf-advice-note"><Scale size={15} /> AI-generated information is not a substitute for advice from a qualified legal professional.</p>
    </section>
  );
}

function ToolsSection() {
  return (
    <section id="tools" className="lf-tools">
      <div className="lf-tools-heading">
        <div className="lf-kicker"><span className="lf-kicker-line" /> One considered toolkit</div>
        <h2>Less searching<br /><em>for the right starting point.</em></h2>
        <p>Focused utilities for research, preparation, and the everyday details of legal work.</p>
      </div>
      <div className="lf-tool-list">
        <Link href="/judgments" className="lf-tool-row">
          <span className="lf-tool-icon"><FileSearch size={20} /></span>
          <span className="lf-tool-copy"><strong>Judgment Finder</strong><small>Browse concise summaries and discover relevant decisions.</small></span>
          <span className="lf-tool-number">01</span><ArrowUpRight size={18} />
        </Link>
        <Link href="/ask" className="lf-tool-row">
          <span className="lf-tool-icon"><Search size={20} /></span>
          <span className="lf-tool-copy"><strong>Legal Q&amp;A</strong><small>Explore a legal question and get oriented around possible next steps.</small></span>
          <span className="lf-tool-number">02</span><ArrowUpRight size={18} />
        </Link>
        <Link href="/free-documents" className="lf-tool-row">
          <span className="lf-tool-icon"><BookOpen size={20} /></span>
          <span className="lf-tool-copy"><strong>Documents &amp; guides</strong><small>Start from practical resources, templates, and clear explanations.</small></span>
          <span className="lf-tool-number">03</span><ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="lf-privacy">
      <div className="lf-privacy-mark"><LockKeyhole size={23} /></div>
      <div className="lf-privacy-copy">
        <div className="lf-kicker">Trust is part of the product</div>
        <h2>Handle sensitive work<br /><em>with care.</em></h2>
        <p>Legal matters deserve thoughtful handling. LitigaForge is designed to support private, purposeful workflows—while keeping professional judgment and clear expectations in view.</p>
      </div>
      <div className="lf-privacy-points">
        <div><ShieldCheck size={19} /><span><strong>Privacy-minded</strong><small>Use information intentionally and review platform policies.</small></span></div>
        <div><Scale size={19} /><span><strong>Human judgment matters</strong><small>AI outputs are assistance, not a final legal opinion.</small></span></div>
        <Link href="/privacy" className="lf-privacy-link">Read our Privacy Policy <ArrowUpRight size={15} /></Link>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="lf-faq">
      <div className="lf-faq-heading">
        <div className="lf-kicker"><span className="lf-kicker-line" /> Good to know</div>
        <h2>Questions,<br /><em>answered plainly.</em></h2>
        <p>Understand what LitigaForge can—and cannot—do.</p>
      </div>
      <div className="lf-faq-list">
        {faqItems.map((item, index) => (
          <details className="lf-faq-item" key={item.q} open={index === 0}>
            <summary>{item.q}<ChevronDown size={17} /></summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lf-footer">
      <div className="lf-footer-main">
        <div className="lf-footer-brand">
          <Link href="/" className="lf-brand"><span className="lf-brand-mark"><Scale size={19} /></span><span>LitigaForge <i>AI</i></span></Link>
          <p>Practical legal tools for advocates and clients.</p>
        </div>
        <div className="lf-footer-links">
          <div><strong>Explore</strong><Link href="/judgments">Judgments</Link><Link href="/ask">Legal Q&amp;A</Link><Link href="/lawyers">Find an advocate</Link></div>
          <div><strong>Information</strong><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={BUSINESS_CONFIG.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp support · {BUSINESS_CONFIG.whatsappPhone}</a></div>
        </div>
        <Link href="/login" className="lf-button">Get started <ArrowRight size={16} /></Link>
      </div>
      <div className="lf-footer-bottom">
        <span>© {new Date().getFullYear()} LitigaForge AI</span>
        <span>AI-generated information is not legal advice. Consult a qualified legal professional.</span>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="lf-page">
      <SEOHelmet
        title="LitigaForge — AI legal tools for advocates and clients"
        description="Research, organize cases, and move legal work forward with practical tools for advocates and clients."
        canonical="/"
        keywords="legal research, advocate tools, case tracking, legal tools, LitigaForge"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LitigaForge AI",
          url: "https://litigaforge.com",
        }}
      />
      <Navbar />
      <Hero />
      <PublicStats />
      <WorkflowSections />
      <ToolsSection />
      <PrivacySection />
      <FAQSection />
      <section className="lf-final-cta">
        <span className="lf-final-overline">A more considered place to begin</span>
        <h2>Bring clarity to<br /><em>your next legal step.</em></h2>
        <Link href="/login" className="lf-button lf-button-light">Get started <ArrowRight size={17} /></Link>
      </section>
      <Footer />
    </main>
  );
}
