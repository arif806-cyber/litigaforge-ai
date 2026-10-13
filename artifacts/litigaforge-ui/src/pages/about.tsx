import { Building2, Target, Globe, Sparkles, BookOpen, Mail, MapPin } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { BUSINESS_CONFIG } from "@/lib/business-config";

const MARKETS = ["Advocates", "Clients"];

const FEATURES = [
  "AI Legal Chat",
  "Document Analyzer",
  "Lawyer Connect",
  "Free Legal Aid",
  "Judgment Finder",
  "Legal Q&A",
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div
        className="flex-1 w-full max-w-4xl mx-auto px-4 py-10 space-y-10"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        data-testid="page-about"
      >
        <SEOHelmet
          title="About LitigaForge"
          description="LitigaForge provides case tracking and legal tools for advocates and clients."
          canonical="/about"
        />

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">About LitigaForge AI</h1>
          </div>
        </div>

        <Section icon={<Building2 className="w-4 h-4" />} title="Who We Are">
          <p>
            LitigaForge is operated by Arivex AI Private Limited and provides case tracking and legal
            tools for advocates and clients.
          </p>
          <p className="mt-2"><strong>Company:</strong> {BUSINESS_CONFIG.companyName}</p>
          <p className="mt-2"><strong>CIN:</strong> {BUSINESS_CONFIG.cin}</p>
          <p className="mt-2"><strong>Registered office:</strong> {BUSINESS_CONFIG.registeredOffice}</p>
        </Section>

        <Section icon={<Target className="w-4 h-4" />} title="Our Mission">
          <p>
            To bridge the gap between people and legal help using artificial intelligence.
            Clear legal information and dependable case tools should be practical for advocates and clients.
          </p>
        </Section>

        <Section icon={<Globe className="w-4 h-4" />} title="Markets We Serve">
          <div className="flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <span
                key={m}
                className="px-3 py-1.5 rounded-full bg-muted/60 border border-border text-sm text-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        </Section>

        <Section icon={<Sparkles className="w-4 h-4" />} title="Our Features">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f}
                className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{f}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<BookOpen className="w-4 h-4" />} title="Our Story">
          <p>
            Founded by <strong>Mohammed Anjum Arif</strong>, LitigaForge AI is part of the
            <strong> T-Hub ecosystem in Hyderabad</strong>.
          </p>
        </Section>

        <Section icon={<BookOpen className="w-4 h-4" />} title="Case-law sources">
          <p>
            Indian judgment search is powered by{" "}
            <a className="text-primary underline" href="https://indiankanoon.org" target="_blank" rel="noopener noreferrer">
              Indian Kanoon
            </a>
            . Search results are retrieved records; review the linked source judgment before relying on a citation.
          </p>
        </Section>

        <Section icon={<Mail className="w-4 h-4" />} title="Contact">
          <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-2 border border-border">
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <a href={`mailto:${BUSINESS_CONFIG.contactEmail}`} className="text-primary underline">{BUSINESS_CONFIG.contactEmail}</a>
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Registered office: {BUSINESS_CONFIG.registeredOffice}
            </p>
          </div>
        </Section>
      </div>

      <LegalDisclaimerFooter />
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed pl-6">{children}</div>
    </div>
  );
}
