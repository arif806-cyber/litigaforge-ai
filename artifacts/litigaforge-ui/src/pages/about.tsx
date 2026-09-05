import { Building2, Target, Globe, Sparkles, BookOpen, Mail, MapPin } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";

const CONTACT_EMAIL = "legal@litigaforge.com";

const MARKETS = [
  "India", "United States", "United Kingdom", "UAE",
  "Germany", "Australia", "Canada", "Singapore",
];

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
          title="About LitigaForge AI"
          description="LitigaForge AI is a global AI-powered legal platform headquartered in Hyderabad, India, making legal help accessible and affordable to everyone."
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
            LitigaForge AI is a global AI-powered legal platform headquartered in Hyderabad, India.
            We make legal help accessible and affordable to everyone — whether you are an individual,
            a startup, or a business.
          </p>
        </Section>

        <Section icon={<Target className="w-4 h-4" />} title="Our Mission">
          <p>
            To bridge the gap between people and legal help using artificial intelligence.
            Clear legal information should not be a privilege — it should be available to anyone, anywhere.
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
            Founded by <strong>Mohammed Anjum Arif</strong>, an AWS and DevOps engineer based in
            Hyderabad, India. LitigaForge AI is associated with <strong>T-Hub Hyderabad</strong>,
            India's leading startup incubator.
          </p>
        </Section>

        <Section icon={<Mail className="w-4 h-4" />} title="Contact">
          <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-2 border border-border">
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Hyderabad, Telangana, India
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
