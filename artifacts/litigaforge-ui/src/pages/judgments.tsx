import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import {
  BookOpen, Search, Loader2, ExternalLink, ChevronDown, Scale,
  Gavel, ArrowRight, CalendarDays, Landmark,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/hooks/useCountry";
import { JUDGMENTS_COPY } from "@/lib/country-copy";
import { ClarifyDialog } from "@/components/ClarifyDialog";
import { MyResearchButton } from "@/components/research";
import { IKanoonAttribution, isIndianKanoon } from "@/components/IKanoonAttribution";

interface Judgment {
  case_name: string;
  citation: string;
  court: string;
  year: number;
  holding: string;
  relevance: string;
  ik_link: string;
  source_name?: string;
}

interface DigestItem {
  id: number;
  case_name: string;
  court: string;
  court_slug: string;
  judgment_date: string | null;
  year: number;
  slug: string;
  summary_en: string;
  outcome: string;
  citation: string;
  path: string;
  source_name?: string;
}

interface CourtFacet {
  court_slug: string;
  court: string;
  count: number;
}

interface DigestResponse {
  total: number;
  judgments: DigestItem[];
  courts: CourtFacet[];
}

const SAMPLE_QUERIES = [
  "Property encroachment injunction",
  "Motor accident compensation claim",
  "Breach of contract damages",
  "Wrongful termination of employment",
  "Domestic violence protection order",
  "Defective product consumer refund",
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function Judgments() {
  const { activeCode, activeConfig } = useCountry();
  const copy = JUDGMENTS_COPY[activeCode.toUpperCase()] ?? JUDGMENTS_COPY.IN;
  const [query, setQuery] = useState("");
  const [court, setCourt] = useState("");
  const [courtOpen, setCourtOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const [digestCourt, setDigestCourt] = useState("");

  const digest = useQuery<DigestResponse>({
    queryKey: ["judgments-digest", digestCourt],
    queryFn: () =>
      apiFetch(`/judgments${digestCourt ? `?court=${encodeURIComponent(digestCourt)}` : ""}`),
  });

  const courtOptions = [
    { id: "", label: "All Courts" },
    ...((activeConfig?.courts ?? []).map(c => ({ id: c, label: c }))),
  ];

  const search = useMutation({
    mutationFn: (data: { query: string; court: string; country: string }) =>
      apiFetch("/judgments/search", { method: "POST", body: JSON.stringify(data) }),
  });

  const handleSearch = (q?: string) => {
    const finalQuery = q ?? query;
    if (!finalQuery.trim() || search.isPending) return;
    if (q) setQuery(q);
    setPendingQuery(finalQuery.trim());
    setClarifyOpen(true);
  };

  const runSearch = (extraDetails: string) => {
    setClarifyOpen(false);
    if (!pendingQuery.trim()) return;
    setExpanded(null);
    const finalQuery = extraDetails
      ? `${pendingQuery.trim()}\n\n${extraDetails}`
      : pendingQuery.trim();
    search.mutate({ query: finalQuery, court, country: activeCode });
  };

  const selectedCourt = courtOptions.find(c => c.id === court) ?? courtOptions[0];
  const sourceName = (search.data as { source_name?: string } | undefined)?.source_name ?? "the source database";

  const digestItems = digest.data?.judgments ?? [];
  const courtFacets = digest.data?.courts ?? [];

  return (<>
      <SEOHelmet
      title="Daily Judgment Digest — Supreme Court & High Court | LitigaForge"
      description="Plain-English summaries of landmark Supreme Court and High Court judgments, with key acts cited, outcomes and AI case-law search across jurisdictions."
      canonical="/judgments"
      keywords="daily judgment digest, supreme court judgments, high court judgments, case law summaries, indian judgments explained, legal precedents"
    />
    <PageShell
      title={copy.pageTitle}
      subtitle="Plain-English summaries of landmark Supreme Court & High Court judgments — updated for quick legal research."
      icon={<Gavel className="w-6 h-6 text-primary" />}
    >
      <div className="space-y-10">
        {/* ── Daily Digest ─────────────────────────────────────────── */}
        <section className="space-y-5" data-testid="section-digest">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Recent Judgments
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {digest.data && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {digest.data.total} in digest
                </span>
              )}
              <MyResearchButton />
            </div>
          </div>

          {/* court filter chips */}
          {courtFacets.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="digest-court-filter">
              <button
                onClick={() => setDigestCourt("")}
                className={cn(
                  "text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all",
                  digestCourt === ""
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                All Courts
              </button>
              {courtFacets.map(c => (
                <button
                  key={c.court_slug}
                  onClick={() => setDigestCourt(c.court_slug)}
                  className={cn(
                    "text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all",
                    digestCourt === c.court_slug
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  {c.court} <span className="opacity-70">({c.count})</span>
                </button>
              ))}
            </div>
          )}

          {digest.isLoading && (
            <div className="flex items-center justify-center py-16 gap-3 bg-card border border-border rounded-2xl">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading judgments…</span>
            </div>
          )}

          {digest.isError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-4">
              Couldn't load the judgment digest. Please try again shortly.
            </div>
          )}

          {!digest.isLoading && !digest.isError && digestItems.length === 0 && (
            <div className="text-center py-16 bg-card border border-border rounded-2xl">
              <BookOpen className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No judgments in this filter yet.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {digestItems.map((j, idx) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              >
                <Link
                  href={j.path}
                  data-testid={`digest-card-${j.id}`}
                  className="group block h-full bg-card rounded-2xl border border-border shadow-sm hover:border-primary/40 hover:shadow-md transition-all p-5"
                >
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                      {j.court}
                    </span>
                    {j.judgment_date && (
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDate(j.judgment_date)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {j.case_name}
                  </h3>
                  {j.citation && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">{j.citation}</p>
                  )}
                  <p className="text-sm text-foreground/70 leading-relaxed mt-3 line-clamp-2">
                    {j.summary_en}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                    {j.outcome && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full line-clamp-1">
                        {j.outcome}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 flex-shrink-0 ml-auto">
                      Read <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          {digestItems.some((j) => isIndianKanoon(j.source_name)) && (
            <div className="flex justify-center pt-2">
              <IKanoonAttribution sourceName="IndianKanoon" />
            </div>
          )}
        </section>

        {/* ── AI case-law search (secondary) ───────────────────────── */}
        <section className="space-y-6" data-testid="section-search">
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border/60" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Search className="w-4 h-4" /> Search all case law with AI
            </h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto -mt-2">
            {copy.pageSubtitle}
          </p>

          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
               <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="e.g. breach of contract damages appeal"
                data-testid="input-judgment-search"
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
              />
            </div>

            <div className="relative w-full md:w-56 flex-shrink-0">
              <button
                onClick={() => setCourtOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-input bg-background text-base font-medium text-foreground hover:border-primary/50 transition-colors shadow-sm"
              >
                {selectedCourt.label}
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", courtOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {courtOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden"
                  >
                    {courtOptions.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCourt(c.id); setCourtOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-3 text-sm font-medium transition-colors",
                          c.id === court ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              onClick={() => handleSearch()}
              disabled={!query.trim() || search.isPending}
              size="lg"
              data-testid="button-judgment-search"
              className="h-14 px-8 text-base shadow-md w-full md:w-auto"
            >
              {search.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </Button>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suggested Searches</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleSearch(q)}
                  className="text-xs font-medium px-4 py-2 rounded-full border border-border bg-muted/50 text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {search.isPending && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-card border border-border rounded-2xl shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Querying legal databases...</p>
          </div>
        )}

        {search.isError && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-6 py-5 flex items-center gap-3">
             <Scale className="w-5 h-5" />
            {(search.error as Error).message}
          </div>
        )}

        {search.isSuccess && search.data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Search Results
              </h3>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                {search.data.total} judgments found
              </span>
            </div>

            <div className="space-y-4">
              {(search.data.judgments as Judgment[]).map((j, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <button
                    className="w-full text-left px-6 py-5 flex flex-col gap-3"
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                  >
                    <div className="flex items-start justify-between gap-4 w-full">
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-muted text-muted-foreground border border-border">
                            {j.court}
                          </span>
                          <span className="text-xs font-mono font-medium text-muted-foreground px-2 py-0.5 rounded bg-background border border-border">{j.year}</span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground leading-snug">{j.case_name}</h3>
                        <p className="text-sm text-muted-foreground font-mono mt-1">{j.citation}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                         <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded === idx && "rotate-180")} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground/70 line-clamp-2 leading-relaxed font-medium bg-muted/30 p-3 rounded-lg border border-border/50">
                      <span className="font-semibold text-primary mr-2">Relevance:</span>
                      {j.relevance}
                    </p>
                  </button>

                  <AnimatePresence>
                    {expanded === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border/50 bg-muted/10"
                      >
                        <div className="px-6 py-6 space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              Key Holding
                            </p>
                            <p className="text-base text-foreground leading-relaxed font-serif bg-background p-4 rounded-xl border border-border shadow-sm">
                              {j.holding}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                               Full Relevance Analysis
                            </p>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              {j.relevance}
                            </p>
                          </div>
                          <div className="pt-2">
                            <a
                              href={j.ik_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors"
                            >
                              View Full Text on {j.source_name ?? sourceName}
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 pt-4">
              <IKanoonAttribution sourceName={(search.data as { source_name?: string } | undefined)?.source_name} />
              <p className="text-xs text-center text-muted-foreground font-mono">
                Citations are AI-generated. Verify on {sourceName} before citing in court.
              </p>
            </div>
          </motion.div>
        )}
        </section>
      </div>

      <ClarifyDialog
        open={clarifyOpen}
        surface="judgments"
        baseText={pendingQuery}
        country={activeCode}
        onProceed={runSearch}
        onClose={() => setClarifyOpen(false)}
        proceedLabel="Search Judgments"
        title="Refine your search"
      />
    </PageShell>
  </>);
}
