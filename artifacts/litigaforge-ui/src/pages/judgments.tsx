import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { BookOpen, Search, Loader2, ExternalLink, ChevronDown, Scale } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/hooks/useCountry";
import { JUDGMENTS_COPY } from "@/lib/country-copy";
import { ClarifyDialog } from "@/components/ClarifyDialog";

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

const SAMPLE_QUERIES = [
  "Property encroachment injunction",
  "Motor accident compensation claim",
  "Breach of contract damages",
  "Wrongful termination of employment",
  "Domestic violence protection order",
  "Defective product consumer refund",
];

export default function Judgments() {
  const { activeCode, activeConfig } = useCountry();
  const copy = JUDGMENTS_COPY[activeCode.toUpperCase()] ?? JUDGMENTS_COPY.IN;
  const [query, setQuery] = useState("");
  const [court, setCourt] = useState("");
  const [courtOpen, setCourtOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");

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

  return (<>
      <SEOHelmet
      title="Search Court Judgments | LitigaForge"
      description="Search court judgments and case law precedents across multiple jurisdictions. AI-curated precedents with links to the relevant case-law database."
      canonical="/judgments"
      keywords="search court judgments, supreme court precedents, case law finder, legal research, court orders"
    />
    <PageShell title={copy.pageTitle} subtitle={copy.pageSubtitle} icon={<BookOpen className="w-6 h-6 text-primary" />}>

      <div className="space-y-8">
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

            <p className="text-xs text-center text-muted-foreground font-mono pt-4">
              Citations are AI-generated. Verify on {sourceName} before citing in court.
            </p>
          </motion.div>
        )}
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