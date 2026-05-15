import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "property", label: "Property" },
  { id: "criminal", label: "Criminal" },
  { id: "family", label: "Family" },
  { id: "gst-tax", label: "GST & Tax" },
  { id: "labour", label: "Labour" },
  { id: "consumer", label: "Consumer" },
  { id: "motor-accident", label: "Motor Accident" },
  { id: "civil", label: "Civil" },
  { id: "general", label: "General" },
];

const CAT_COLORS: Record<string, string> = {
  property: "bg-violet-50 text-violet-700 border-violet-200",
  criminal: "bg-red-50 text-red-700 border-red-200",
  family: "bg-pink-50 text-pink-700 border-pink-200",
  "gst-tax": "bg-blue-50 text-blue-700 border-blue-200",
  labour: "bg-orange-50 text-orange-700 border-orange-200",
  consumer: "bg-green-50 text-green-700 border-green-200",
  "motor-accident": "bg-yellow-50 text-yellow-700 border-yellow-200",
  civil: "bg-slate-50 text-slate-700 border-slate-200",
  general: "bg-gray-50 text-gray-700 border-gray-200",
};

interface QAItem {
  id: number;
  question: string;
  category: string;
  ai_answer: string;
  upvotes: number;
  created_at: string;
}

function QACard({ item }: { item: QAItem }) {
  const [expanded, setExpanded] = useState(false);
  const color = CAT_COLORS[item.category] ?? CAT_COLORS.general;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border", color)}>
              {item.category}
            </span>
            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(item.created_at).toLocaleDateString("en-IN")}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
            {item.question}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                {item.ai_answer}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("general");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [answer, setAnswer] = useState<{ question: string; answer: string; category: string } | null>(null);

  const { data: qaList, refetch } = useQuery<{ questions: QAItem[] }>({
    queryKey: ["questions", browseCategory],
    queryFn: () => apiFetch(`/ask?limit=20${browseCategory !== "all" ? `&category=${browseCategory}` : ""}`),
    staleTime: 30000,
  });

  const askMutation = useMutation({
    mutationFn: (data: { question: string; category: string }) =>
      apiFetch("/ask", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setAnswer({ question: data.question, answer: data.answer, category: data.category });
      setQuestion("");
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;
    setAnswer(null);
    askMutation.mutate({ question: question.trim(), category });
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary" />
          Legal Q&A
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Ask any legal question — Claude AI answers instantly with applicable Indian law and Telangana/AP procedures.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-3xl space-y-8 pb-20">

          {/* Ask form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Ask Your Legal Question</h2>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.slice(1).map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "text-xs font-mono px-3 py-1.5 rounded-full border transition-all",
                    category === c.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="e.g. My neighbour has encroached on my property in Hyderabad. What steps can I take under TSRPA 1987 to get it back?"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition resize-none"
              />
              <button
                type="submit"
                disabled={!question.trim() || askMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {askMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Consulting AI…</>
                  : <><Send className="w-4 h-4" /> Get Legal Advice</>}
              </button>
            </form>

            {askMutation.isError && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {(askMutation.error as Error).message}
              </div>
            )}
          </div>

          {/* AI answer */}
          <AnimatePresence>
            {answer && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-primary/20 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
                    Claude Sonnet · Legal AI Response
                  </span>
                  <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded border ml-auto", CAT_COLORS[answer.category] ?? CAT_COLORS.general)}>
                    {answer.category}
                  </span>
                </div>
                <div className="px-6 py-5">
                  <p className="text-xs text-gray-400 font-mono mb-3 italic">"{answer.question}"</p>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                    {answer.answer}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Community Q&A */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Community Questions</h2>
              <span className="text-xs text-gray-400 font-mono">{qaList?.total ?? 0} answered</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setBrowseCategory(c.id)}
                  className={cn(
                    "text-xs font-mono px-3 py-1.5 rounded-full border transition-all",
                    browseCategory === c.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {(qaList?.questions ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm font-mono">
                  No questions yet in this category. Be the first to ask!
                </div>
              )}
              {(qaList?.questions ?? []).map(item => (
                <QACard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
