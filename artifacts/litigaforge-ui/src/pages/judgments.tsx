import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { BookOpen, Search, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const COURTS = [
  { id: "", label: "All Courts" },
  { id: "Supreme Court of India", label: "Supreme Court" },
  { id: "Telangana High Court", label: "Telangana High Court" },
  { id: "AP High Court", label: "AP High Court" },
  { id: "District Courts", label: "District Courts" },
];

interface Judgment {
  case_name: string;
  citation: string;
  court: string;
  year: number;
  holding: string;
  relevance: string;
  ik_link: string;
}

const SAMPLE_QUERIES = [
  "Property encroachment injunction Telangana",
  "Motor accident compensation MACT",
  "GST ITC input tax credit fraud",
  "Cheque bounce Section 138 NI Act",
  "Domestic violence protection order",
  "Builder flat delivery delay RERA",
];

export default function Judgments() {
  const [query, setQuery] = useState("");
  const [court, setCourt] = useState("");
  const [courtOpen, setCourtOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const search = useMutation({
    mutationFn: (data: { query: string; court: string }) =>
      apiFetch("/judgments/search", { method: "POST", body: JSON.stringify(data) }),
  });

  const handleSearch = (q?: string) => {
    const finalQuery = q ?? query;
    if (!finalQuery.trim() || search.isPending) return;
    if (q) setQuery(q);
    setExpanded(null);
    search.mutate({ query: finalQuery.trim(), court });
  };

  const selectedCourt = COURTS.find(c => c.id === court) ?? COURTS[0];

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          Judgment Finder
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Search Indian case law — AI finds relevant precedents with citations and plain-language summaries.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-3xl space-y-6 pb-20">

          {/* Search card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="e.g. property encroachment injunction Telangana High Court"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
              />

              {/* Court filter */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setCourtOpen(o => !o)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:border-primary/40 transition whitespace-nowrap"
                >
                  {selectedCourt.label}
                  <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", courtOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {courtOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[200px] overflow-hidden"
                    >
                      {COURTS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setCourt(c.id); setCourtOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors",
                            c.id === court ? "text-primary font-semibold bg-primary/5" : "text-gray-700"
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => handleSearch()}
                disabled={!query.trim() || search.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex-shrink-0"
              >
                {search.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">{search.isPending ? "Searching…" : "Search"}</span>
              </button>
            </div>

            {/* Sample queries */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">Try these</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUERIES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSearch(q)}
                    className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          {search.isPending && (
            <div className="flex flex-col items-center py-16 gap-4 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-mono">Searching Indian case law…</p>
            </div>
          )}

          {search.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
              {(search.error as Error).message}
            </div>
          )}

          {search.isSuccess && search.data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {search.data.total} judgments found
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  Query: "{search.data.query}"
                </p>
              </div>

              {(search.data.judgments as Judgment[]).map((j, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div
                    className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {j.court}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">{j.year}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 leading-snug">{j.case_name}</h3>
                        <p className="text-xs text-gray-500 font-mono mt-1">{j.citation}</p>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform", expanded === idx && "rotate-180")} />
                    </div>
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2 italic">{j.relevance}</p>
                  </div>

                  <AnimatePresence>
                    {expanded === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">Key Holding</p>
                            <p className="text-sm text-gray-800 leading-relaxed">{j.holding}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">Relevance</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{j.relevance}</p>
                          </div>
                          <a
                            href={j.ik_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-mono text-primary hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View on IndianKanoon
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              <p className="text-xs text-center text-gray-400 font-mono pt-2">
                Citations are AI-generated. Verify on IndianKanoon before citing in court.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
