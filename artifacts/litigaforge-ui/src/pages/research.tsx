import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, BookOpen, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const TOPIC_CHIPS = [
  "Bail conditions under CrPC S.437",
  "Cheque bounce limitation period",
  "Consumer complaint jurisdiction COPRA 2019",
  "GST input tax credit reversal",
  "Anticipatory bail conditions Art. 21",
  "Cyber crime evidence IT Act S.65B",
  "Motor accident compensation formula",
  "Property partition Hindu law",
  "Section 498A quashing HC powers",
  "POCSO Act mandatory reporting",
  "Insolvency resolution timeline IBC",
  "Trademark infringement remedies",
];

const JURISDICTIONS = [
  "Telangana", "Andhra Pradesh", "Supreme Court of India", "Delhi", "Karnataka", "Maharashtra", "Tamil Nadu",
];

interface ResearchResult {
  answer: string;
  citations: string[];
  key_statutes: string[];
  jurisdiction: string;
}

export default function Research() {
  const [query, setQuery] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Telangana");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [history, setHistory] = useState<{ query: string; jurisdiction: string }[]>([]);

  const researchMutation = useMutation({
    mutationFn: () =>
      apiFetch("/research", {
        method: "POST",
        body: JSON.stringify({ query, jurisdiction }),
      }),
    onSuccess: (data: ResearchResult) => {
      setResult(data);
      setHistory(h => [{ query, jurisdiction }, ...h.filter(x => x.query !== query)].slice(0, 8));
    },
  });

  const handleSearch = (q?: string, j?: string) => {
    const searchQuery = q ?? query;
    const searchJurisdiction = j ?? jurisdiction;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setJurisdiction(searchJurisdiction);
    researchMutation.mutate();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Search className="w-6 h-6 text-blue-600" /> Legal Research
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered Indian case law research with real citations — like LegitQuest iSearch</p>

        {/* Search bar */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3 max-w-3xl">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Ask a legal question or search case law..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-sm"
            />
          </div>
          <select
            value={jurisdiction}
            onChange={e => setJurisdiction(e.target.value)}
            className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm"
          >
            {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || researchMutation.isPending}
            className="h-12 sm:h-auto px-6 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {researchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Topic chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPIC_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => { setQuery(chip); handleSearch(chip); }}
              className="text-[11px] px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition font-medium"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-8 md:px-10 space-y-6">

        {/* Error */}
        {researchMutation.isError && (
          <div className="max-w-3xl flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {String(researchMutation.error)}
          </div>
        )}

        {/* Loading */}
        {researchMutation.isPending && (
          <div className="max-w-3xl bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 text-gray-400 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-sm">Searching Indian case law and statutes…</p>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && !researchMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl space-y-4"
            >
              {/* Query header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Research Result</p>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">{result.jurisdiction}</span>
              </div>

              {/* Answer */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap font-serif">
                  {result.answer}
                </div>
              </div>

              {/* Key statutes */}
              {result.key_statutes?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-mono text-amber-700 uppercase tracking-widest mb-2">Key Statutes Referenced</p>
                  <div className="flex flex-wrap gap-2">
                    {result.key_statutes.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {result.citations?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Case Citations</p>
                  <ul className="space-y-2">
                    {result.citations.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <span className="font-mono text-xs leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state + recent history */}
        {!result && !researchMutation.isPending && (
          <div className="max-w-3xl">
            {history.length > 0 ? (
              <div>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Recent Searches
                </p>
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearch(h.query, h.jurisdiction)}
                      className="w-full text-left flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{h.query}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{h.jurisdiction}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">Start a legal research query</p>
                <p className="text-xs text-gray-300 mt-1 max-w-xs mx-auto">Ask any question about Indian law — get cited answers with case law, statutes, and sections</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
