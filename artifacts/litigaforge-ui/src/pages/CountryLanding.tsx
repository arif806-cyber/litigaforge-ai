import { Link } from "wouter";
import { Scale, Phone, ArrowRight, Sparkles, FileText } from "lucide-react";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PainPointsGrid from "@/components/PainPointsGrid";
import PricingSection from "@/components/PricingSection";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { useLanguage } from "@/hooks/useLanguage";
import { getLandingContent } from "@/lib/countryLandingData";

interface CountryLandingProps {
  countryCode?: string;
}

export default function CountryLanding({ countryCode = "IN" }: CountryLandingProps) {
  const cc = countryCode.toUpperCase();
  const { t, lang } = useLanguage(cc);
  const content = getLandingContent(cc);
  const isRtl = lang === "ar";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="country-landing"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg" data-testid="link-home">
            <Scale className="w-5 h-5 text-primary" />
            <span>LitigaForge AI</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher countryCode={cc} />
            <CountrySwitcher />
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
              data-testid="link-signin"
            >
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-16 pb-12 text-center">
          <div className="text-6xl md:text-7xl mb-5" data-testid="hero-flag">{content.flag}</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto" data-testid="hero-title">
            {t.hero_title}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-4 max-w-xl mx-auto" data-testid="hero-sub">
            {t.hero_sub}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link
              href="/post-case"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20"
              data-testid="button-get-started"
            >
              {t.cta} <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
            </Link>
            <Link
              href="/ask"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card font-semibold hover:border-primary/40 transition"
              data-testid="button-ask-ai"
            >
              <Sparkles className="w-4 h-4 text-amber-500" /> {t.legal_qa}
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-20 space-y-14">
        {/* 2. PAIN POINTS GRID */}
        <PainPointsGrid countryCode={cc} />

        {/* 3. TOP DOCUMENTS */}
        <section data-testid="section-top-documents">
          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-xl md:text-2xl font-bold">{t.docs_heading}</h2>
            <Link
              href="/free-documents"
              className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
              data-testid="link-all-documents"
            >
              {t.documents}
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
            {content.topDocuments.map((doc) => (
              <Link
                key={doc}
                href="/free-documents"
                className="snap-start shrink-0 w-44 flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition"
                data-testid={`document-${doc.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-sm font-semibold leading-snug">{doc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. EMERGENCY BANNER */}
        <section
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 md:p-6 flex items-center gap-4"
          data-testid="section-emergency"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {t.emergency_label}
            </p>
            <p className="text-base md:text-lg font-bold" data-testid="emergency-number">{t.emergency_number}</p>
          </div>
        </section>

        {/* 5. PRICING */}
        <PricingSection countryCode={cc} />

        {/* 6. CTA SECTION */}
        <section
          className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 text-center"
          data-testid="section-cta"
        >
          <h2 className="text-2xl md:text-3xl font-bold max-w-2xl mx-auto" data-testid="cta-title">
            {t.join_title}
          </h2>
          <p className="text-muted-foreground mt-3">{t.join_sub}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20"
              data-testid="button-sign-up"
            >
              {t.sign_up} <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card font-semibold hover:border-primary/40 transition"
              data-testid="button-login"
            >
              {t.login}
            </Link>
          </div>
        </section>
      </div>

      {/* FOOTER — consistent with the in-app shell */}
      <LegalDisclaimerFooter />
    </div>
  );
}
