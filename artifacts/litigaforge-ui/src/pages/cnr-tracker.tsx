import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  FileSearch, Loader2, CalendarDays, Clock, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Scale, Building2,
  Users, Gavel, BookOpen, Info, Search, RotateCcw,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface HearingEntry {
  date: string;
  purpose: string;
  judge: string;
  result: string | null;
  next_date: string | null;
}

interface CnrResult {
  cnr: string;
  case_number: string;
  case_type: string;
  filing_date: string;
  registration_date: string;
  court: string;
  district: string;
  state: string;
  judge: string;
  status: string;
  stage: string;
  petitioner: string;
  respondent: string;
  advocate_petitioner: string | null;
  advocate_respondent: string | null;
  subject: string;
  under_act: string | null;
  under_section: string | null;
  hearings: HearingEntry[];
  next_hearing: string | null;
  last_updated: string;
  data_source: string;
  disclaimer: string;
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isUpcoming(iso: string): boolean {
  return new Date(`${iso}T00:00:00`) >= new Date(new Date().toDateString());
}

function isPast(iso: string): boolean {
  return new Date(`${iso}T00:00:00`) < new Date(new Date().toDateString());
}

function daysUntil(iso: string): number {
  const today = new Date(new Date().toDateString());
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

const SAMPLE_CNRS = [
  "TLHC010012342023",
  "APDC020056782022",
  "TLHC030098762024",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending:     { label: "Pending",     color: "text-amber-400 bg-amber-500/10 border-amber-500/20",  icon: Clock },
  disposed:    { label: "Disposed",    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",  icon: CheckCircle2 },
  transferred: { label: "Transferred", color: "text-primary bg-primary/10 border-primary/20",     icon: RotateCcw },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status.toLowerCase()] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Scale }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-1 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{value || "—"}</p>
    </div>
  );
}

function HearingTimeline({ hearings }: { hearings: HearingEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...hearings].sort((a, b) => a.date.localeCompare(b.date));
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/60" />

        <div className="space-y-3">
          {visible.map((h, idx) => {
            const past = isPast(h.date);
            const upcoming = isUpcoming(h.date);
            const diff = upcoming ? daysUntil(h.date) : null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex gap-3"
              >
                {/* Dot */}
                <div className="flex-none flex items-start pt-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 bg-card shadow-sm",
                    past ? "border-muted text-muted-foreground" :
                    diff === 0 ? "border-amber-400 text-amber-600 animate-pulse" :
                    "border-primary text-primary",
                  )}>
                    {past
                      ? <CheckCircle2 className="w-4 h-4 text-muted-foreground/60" />
                      : diff === 0
                      ? <Gavel className="w-4 h-4" />
                      : <CalendarDays className="w-4 h-4" />
                    }
                  </div>
                </div>

                {/* Card */}
                <div className={cn(
                  "flex-1 border rounded-xl p-3.5 transition-colors",
                  past ? "bg-muted/30 border-border/40" :
                  diff === 0 ? "bg-amber-500/10 border-amber-500/20 shadow-md" :
                  "bg-card border-primary/20 shadow-sm",
                )}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className={cn(
                        "text-sm font-semibold",
                        past ? "text-muted-foreground" : "text-foreground",
                      )}>
                        {fmtDate(h.date)}
                        {diff === 0 && (
                          <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">TODAY</span>
                        )}
                        {diff !== null && diff > 0 && diff <= 7 && (
                          <span className="ml-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            In {diff} day{diff > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.purpose}</p>
                    </div>
                    {!past && upcoming && (
                      <CalendarDays className="w-4 h-4 text-primary flex-none mt-0.5" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1.5">
                    <span className="font-medium">Judge:</span> {h.judge}
                  </p>

                  {h.result && (
                    <p className="text-xs mt-1.5 text-muted-foreground italic border-t border-border/40 pt-1.5">
                      {h.result}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-primary flex items-center justify-center gap-1 py-2 hover:underline"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Show {sorted.length - 6} more hearings</>
          }
        </button>
      )}
    </div>
  );
}

function UpcomingReminderBanner({ nextHearing }: { nextHearing: string }) {
  const diff = daysUntil(nextHearing);
  if (diff < 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-start gap-3 rounded-xl p-4 border",
        diff === 0
          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
          : diff <= 3
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-primary/5 border-primary/20 text-primary",
      )}
    >
      <CalendarDays className="w-5 h-5 flex-none mt-0.5" />
      <div>
        <p className="text-sm font-semibold">
          {diff === 0
            ? "Hearing is TODAY"
            : diff === 1
            ? "Hearing is TOMORROW"
            : `Next hearing in ${diff} days`}
        </p>
        <p className="text-xs mt-0.5 opacity-80">{fmtDate(nextHearing)}</p>
      </div>
    </motion.div>
  );
}

export default function CnrTracker() {
  const [cnrInput, setCnrInput] = useState("");
  const [result, setResult] = useState<CnrResult | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "hearings">("details");

  const lookup = useMutation({
    mutationFn: (cnr: string) =>
      apiFetch("/cnr/lookup", {
        method: "POST",
        body: JSON.stringify({ cnr }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (data: CnrResult) => {
      setResult(data);
      setActiveTab("details");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = cnrInput.trim().replace(/[\s\-/]/g, "").toUpperCase();
    if (!val) return;
    lookup.mutate(val);
  }

  const upcomingHearings = result?.hearings.filter(h => isUpcoming(h.date)) ?? [];

  return (
    <>
      <SEOHelmet
        title="CNR Case Tracker — LitigaForge AI"
        description="Track your eCourts case status, hearing dates, and timeline by CNR number"
      />
      <PageShell
        title="CNR Case Tracker"
        subtitle="Enter a CNR number to fetch case status, parties, and full hearing calendar"
        icon={<FileSearch className="w-6 h-6 text-primary" />}
      >
        {/* Search form */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 flex-col sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={cnrInput}
                onChange={e => setCnrInput(e.target.value)}
                placeholder="e.g. TLHC010012342023"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono uppercase tracking-wider"
                maxLength={20}
                data-testid="cnr-input"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={lookup.isPending || !cnrInput.trim()}
              data-testid="cnr-search-btn"
              className="shrink-0"
            >
              {lookup.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up…</>
                : "Track Case"
              }
            </Button>
          </form>

          {/* Sample CNRs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Try:</span>
            {SAMPLE_CNRS.map(cnr => (
              <button
                key={cnr}
                onClick={() => { setCnrInput(cnr); lookup.mutate(cnr); }}
                className="text-xs font-mono text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded"
              >
                {cnr}
              </button>
            ))}
          </div>

          {/* Error */}
          {lookup.isError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 flex-none" />
              {(lookup.error as any)?.detail ??
                "Could not look up this CNR. Please check the format and try again."}
            </motion.div>
          )}
        </div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.cnr}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Header strip */}
              <div className="bg-card border border-border/60 rounded-2xl p-5 md:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {result.cnr}
                      </span>
                      <StatusBadge status={result.status} />
                    </div>
                    <h2 className="text-lg font-bold text-foreground leading-snug">
                      {result.petitioner} <span className="text-muted-foreground font-normal text-base">v.</span> {result.respondent}
                    </h2>
                    <p className="text-sm text-muted-foreground">{result.case_type} · {result.case_number}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Stage: <span className="font-medium text-foreground">{result.stage}</span></p>
                    <p className="mt-0.5">Filed: {fmtDate(result.filing_date)}</p>
                  </div>
                </div>
              </div>

              {/* Upcoming reminder banner */}
              {result.next_hearing && (
                <UpcomingReminderBanner nextHearing={result.next_hearing} />
              )}

              {/* Tabs */}
              <div className="flex border-b border-border/60">
                {(["details", "hearings"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                    data-testid={`tab-${tab}`}
                  >
                    {tab === "details" ? "Case Details" : `Hearings (${result.hearings.length})`}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "details" && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Info grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <InfoCard label="Court"          value={result.court}           icon={Building2} />
                      <InfoCard label="District"       value={result.district}        icon={Scale} />
                      <InfoCard label="Judge"          value={result.judge}           icon={Gavel} />
                      <InfoCard label="Subject"        value={result.subject}         icon={BookOpen} />
                      <InfoCard label="Under Act"      value={result.under_act ?? "—"} icon={Scale} />
                      <InfoCard label="Next Hearing"   value={result.next_hearing ? fmtDate(result.next_hearing) : "None scheduled"} icon={CalendarDays} />
                    </div>

                    {/* Parties */}
                    <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Parties
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Petitioner / Plaintiff</p>
                          <p className="font-semibold text-foreground">{result.petitioner}</p>
                          {result.advocate_petitioner && (
                            <p className="text-xs text-muted-foreground">Adv: {result.advocate_petitioner}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Respondent / Defendant</p>
                          <p className="font-semibold text-foreground">{result.respondent}</p>
                          {result.advocate_respondent && (
                            <p className="text-xs text-muted-foreground">Adv: {result.advocate_respondent}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Upcoming hearings mini list */}
                    {upcomingHearings.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" />
                          Upcoming Hearings
                        </h3>
                        <div className="space-y-2">
                          {upcomingHearings.slice(0, 3).map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{fmtDate(h.date)}</span>
                              <span className="text-muted-foreground text-xs">{h.purpose}</span>
                            </div>
                          ))}
                        </div>
                        {upcomingHearings.length > 3 && (
                          <button
                            onClick={() => setActiveTab("hearings")}
                            className="text-xs text-primary hover:underline"
                          >
                            View all {upcomingHearings.length} upcoming →
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "hearings" && (
                  <motion.div
                    key="hearings"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <HearingTimeline hearings={result.hearings} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/40 rounded-lg px-4 py-3">
                <Info className="w-3.5 h-3.5 flex-none mt-0.5" />
                <span>{result.disclaimer}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !lookup.isPending && (
          <div className="text-center py-16 text-muted-foreground space-y-3">
            <FileSearch className="w-12 h-12 mx-auto opacity-30" />
            <p className="text-sm font-medium">Enter a CNR number above to track your case</p>
            <p className="text-xs max-w-sm mx-auto leading-relaxed">
              Your CNR is printed on every court notice and order sheet.
              It looks like <span className="font-mono bg-muted px-1 rounded">TLHC010012342023</span>.
            </p>
          </div>
        )}
      </PageShell>
    </>
  );
}
