import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme-provider";
import {
  ScoreRing, RiskMeter, DocketHeader, MarginRuleCard, PaperSurface,
  SettlingMotion, Stamp, Chip, StageTimeline, ConfidenceBars, CaseMap,
} from "@/components/case-file-os";
import {
  Scale, ShieldCheck, FileText, Gavel, MessageSquareText, MapPin,
  CalendarClock, Command as CmdIcon, Phone,
} from "lucide-react";

/**
 * DEV-only gallery for the Case File OS design system. Registered in App.tsx
 * only when import.meta.env.DEV — it is never bundled into production. Used to
 * verify every signature component in light/dark, mobile and RTL.
 */
export default function DesignSystem() {
  const { theme, setTheme } = useTheme();
  const [rtl, setRtl] = useState(false);
  const dark = theme === "dark";

  // Deterministically apply ?theme=dark and ?dir=rtl on load so each variant
  // can be screenshotted reproducibly (absence of a param resets to the
  // light / LTR default). Restore LTR when leaving the gallery.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setTheme(p.get("theme") === "dark" ? "dark" : "light");
    const isRtl = p.get("dir") === "rtl";
    setRtl(isRtl);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    return () => {
      document.documentElement.dir = "ltr";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDark() {
    setTheme(dark ? "light" : "dark");
  }
  function toggleRtl() {
    const next = !rtl;
    setRtl(next);
    document.documentElement.dir = next ? "rtl" : "ltr";
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-5 py-10 space-y-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="cfos-docket">Design system · DEV preview</div>
            <h1 className="text-3xl font-bold mt-1">Case File OS</h1>
            <p className="text-muted-foreground mt-1">The living dossier — trust-first components.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleDark} data-testid="toggle-dark"
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium">
              {dark ? "Light" : "Dark"} mode
            </button>
            <button onClick={toggleRtl} data-testid="toggle-rtl"
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium">
              {rtl ? "LTR" : "RTL"}
            </button>
          </div>
        </header>

        <Section title="Instruments">
          <div className="flex flex-wrap items-center gap-10">
            <ScoreRing score={92} label="Match" />
            <ScoreRing score={68} label="Fit" size={150} />
            <RiskMeter value={28} />
            <RiskMeter value={74} size={150} />
          </div>
        </Section>

        <Section title="Docket header">
          <PaperSurface ruled className="p-6">
            <DocketHeader items={[
              { label: "Case no.", value: "CRL.P 4821/2026" },
              { label: "Court", value: "HC · Telangana" },
              { label: "Filed", value: "12 Mar 2026" },
              { label: "Stage", value: "Arguments" },
            ]} />
          </PaperSurface>
        </Section>

        <Section title="Margin-rule card · live · tab">
          <MarginRuleCard tab="Active file" live>
            <DocketHeader items={[
              { label: "Client", value: "A. Reddy" },
              { label: "Next hearing", value: "28 Jun 2026" },
            ]} />
            <p className="mt-3 text-sm text-muted-foreground">
              The legal-pad margin (red rule + faint gold hairline) is the signature surface.
              It mirrors correctly under RTL via logical properties.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip icon={<MapPin className="w-3 h-3" />}>Hyderabad</Chip>
              <Chip icon={<CalendarClock className="w-3 h-3" />}>28 Jun</Chip>
              <Stamp>Bar-verified</Stamp>
            </div>
          </MarginRuleCard>
        </Section>

        <Section title="Paper surfaces · elevation">
          <div className="grid sm:grid-cols-3 gap-4">
            {([1, 2, 3] as const).map((e) => (
              <PaperSurface key={e} elevation={e} className="p-5">
                <div className="cfos-docket">Elevation {e}</div>
                <p className="text-sm text-muted-foreground mt-2">Depth-aware stacked paper.</p>
              </PaperSurface>
            ))}
          </div>
        </Section>

        <Section title="Stage timeline">
          <PaperSurface className="p-6">
            <StageTimeline stages={["Filed", "Notice", "Hearing", "Arguments", "Judgment"]} active={3} />
          </PaperSurface>
        </Section>

        <Section title="Multi-AI confidence">
          <PaperSurface className="p-6 max-w-md">
            <ConfidenceBars rows={[
              { label: "Claude", value: 94 },
              { label: "Gemini", value: 81 },
              { label: "GPT-5", value: 88 },
            ]} />
          </PaperSurface>
        </Section>

        <Section title="Settling motion">
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <SettlingMotion key={i} delay={i * 0.12}>
                <PaperSurface className="p-5">
                  <div className="cfos-docket">Filing {i + 1}</div>
                  <p className="text-sm text-muted-foreground mt-2">Settles into the file on scroll.</p>
                </PaperSurface>
              </SettlingMotion>
            ))}
          </div>
        </Section>

        <Section title="Case map · living dossier">
          <CaseMap
            docket="CRL.P 4821/2026 · real-time"
            center={{
              kicker: "Active case",
              location: "Hyderabad",
              title: "Property dispute — partition suit",
              stageCurrent: 4,
              stageTotal: 5,
            }}
            legend={[
              { tone: "hsl(var(--cfos-gold))", label: "AI" },
              { tone: "hsl(var(--primary))", label: "People & docs" },
              { tone: "hsl(var(--cfos-good))", label: "Verified" },
            ]}
            nodes={[
              { id: "lawyer", icon: <Scale className="w-4 h-4" />, label: "Matched lawyer", metric: "92 fit", sub: "S. Rao · verified", tone: "hsl(var(--cfos-good))" },
              { id: "hearing", icon: <CalendarClock className="w-4 h-4" />, label: "Next hearing", metric: "28 Jun", sub: "HC Telangana" },
              { id: "docs", icon: <FileText className="w-4 h-4" />, label: "Documents", metric: "6 files", sub: "2 flagged" },
              { id: "ai", icon: <MessageSquareText className="w-4 h-4" />, label: "AI strategy", metric: "Synthesized", sub: "3 models", tone: "hsl(var(--cfos-gold))" },
              { id: "precedents", icon: <Gavel className="w-4 h-4" />, label: "Precedents", metric: "5 cases", sub: "IndianKanoon" },
              { id: "aid", icon: <ShieldCheck className="w-4 h-4" />, label: "Legal aid", metric: "Eligible", sub: "NALSA", tone: "hsl(var(--cfos-good))" },
            ]}
          />
        </Section>

        <Section title="Command palette">
          <PaperSurface className="p-6 flex items-center gap-3">
            <CmdIcon className="w-5 h-5 text-[hsl(var(--cfos-gold))]" />
            <p className="text-sm text-muted-foreground">
              Press <kbd className="cfos-mono px-1.5 py-0.5 rounded border border-border bg-muted">⌘K</kbd> /{" "}
              <kbd className="cfos-mono px-1.5 py-0.5 rounded border border-border bg-muted">Ctrl K</kbd> to open the global command palette.
            </p>
            <Phone className="w-4 h-4 text-muted-foreground ml-auto" />
          </PaperSurface>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="cfos-gold-underline text-sm font-semibold pb-0.5">{title}</span>
        <span className="cfos-hairline flex-1" />
      </div>
      {children}
    </section>
  );
}
