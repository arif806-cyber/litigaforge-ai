import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Scale, Gavel, Building2, Phone, ArrowRight, Sparkles } from "lucide-react";
import CountrySwitcher from "@/components/CountrySwitcher";
import type { CountryConfig } from "@/hooks/useCountry";

const COUNTRY_API_BASE = "/litigaforge";

interface CountryDashboardProps {
  countryCode?: string;
}

export default function CountryDashboard({ countryCode = "IN" }: CountryDashboardProps) {
  const [config, setConfig] = useState<CountryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${COUNTRY_API_BASE}/api/country/${countryCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setConfig(d.config as CountryConfig);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (loading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading {countryCode}…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="country-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg" data-testid="link-home">
            <Scale className="w-5 h-5 text-primary" />
            <span>LitigaForge AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <CountrySwitcher />
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
              data-testid="link-signin"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-12 pb-8 text-center">
        <div className="text-6xl mb-4">{config.flag}</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Legal Help in {config.name}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          AI-powered legal guidance, lawyer matching, and document tools tailored to{" "}
          {config.legal_system} · {config.currency} {config.currency_symbol}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Link
            href="/post-case"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition"
            data-testid="button-get-started"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/ask"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card font-semibold hover:border-primary/40 transition"
            data-testid="button-ask-ai"
          >
            <Sparkles className="w-4 h-4 text-amber-500" /> Ask AI
          </Link>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-16 space-y-8">
        {/* Top services */}
        <section>
          <h2 className="text-lg font-bold mb-4">Top Legal Services in {config.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {config.top_services?.map((s) => (
              <div
                key={s}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition"
                data-testid={`service-${s}`}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Gavel className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-sm font-semibold leading-snug">{s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Courts */}
        <section>
          <h2 className="text-lg font-bold mb-4">Courts &amp; Tribunals</h2>
          <div className="flex flex-wrap gap-2">
            {config.courts?.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm"
                data-testid={`court-${c}`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-500" /> {c}
              </span>
            ))}
          </div>
        </section>

        {/* Emergency legal */}
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Emergency Legal Aid
            </p>
            <p className="text-base font-bold">{config.emergency_legal}</p>
          </div>
        </section>

        {config.bar_council && (
          <p className="text-center text-xs text-muted-foreground">
            Regulated guidance aligned with {config.bar_council}. LitigaForge AI connects you with
            lawyers — it does not provide legal advice.
          </p>
        )}
      </div>
    </div>
  );
}
