import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Clock, FileQuestion, AlertTriangle } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  property: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  criminal: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  family: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  "gst-tax": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  labour: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  consumer: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "motor-accident": "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  civil: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800",
  general: "bg-muted text-muted-foreground border-border",
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

  return (<>
      <SEOHelmet title="Legal Q&A" description="Ask any legal question and get instant AI-powered answers." canonical="/ask" />
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 transition-colors"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border", color)}>
              {item.category}
            </span>
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(item.created_at).toLocaleDateString("en-IN")}
            </span>
          </div>
          <p className="text-base font-semibold text-foreground leading-snug">
            {item.question}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
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
            <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-muted/20">
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-line leading-relaxed">
                {item.ai_answer}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  </>);
}

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("general");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [answer, setAnswer] = useState<{ question: string; answer: string; category: string } | null>(null);

  const { data: qaList, refetch, isLoading: qaLoading, isError: qaError, error: qaErrorData } = useQuery<{ questions: QAItem[]; total: number }>({
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
    <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary" />
          Legal Q&A
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Ask any legal question — get instant answers grounded in Indian law and local procedures.
        </p>
      </div>

      <div className="space-y-10">
        {/* Ask form */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-foreground mb-6">Ask a Question</h2>

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.slice(1).map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "text-xs font-semibold px-4 py-2 rounded-full border transition-all",
                  category === c.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
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
              className="w-full px-4 py-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none shadow-sm"
            />
            <div className="flex justify-end">
               <Button
                  type="submit"
                  size="lg"
                  disabled={!question.trim() || askMutation.isPending}
                  className="px-8 shadow-md"
                >
                  {askMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Consulting AI…</>
                    : <><Send className="w-4 h-4 mr-2" /> Get Legal Advice</>}
                </Button>
            </div>
          </form>

          {askMutation.isError && (
            <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
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
              className="bg-card border-2 border-primary/30 rounded-2xl shadow-md overflow-hidden"
            >
              <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  AI Legal Analysis
                </span>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border ml-auto", CAT_COLORS[answer.category] ?? CAT_COLORS.general)}>
                  {answer.category}
                </span>
              </div>
              <div className="px-6 py-6">
                <p className="text-sm text-muted-foreground font-medium mb-4 italic">"{answer.question}"</p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-line leading-relaxed text-base">
                  {answer.answer}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Community Q&A */}
        <div>
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/50">
            <h2 className="text-lg font-bold text-foreground">Community Knowledge Base</h2>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{qaList?.total ?? 0} answered</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setBrowseCategory(c.id)}
                className={cn(
                  "text-xs font-semibold px-4 py-2 rounded-full border transition-all",
                  browseCategory === c.id
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {qaLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            {qaError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                <div>
                  <h4 className="text-destructive font-semibold">Failed to load questions</h4>
                  <p className="text-sm text-destructive/80 mt-1">{(qaErrorData as Error)?.message ?? "Please try again."}</p>
                </div>
              </div>
            )}
            {!qaLoading && !qaError && (qaList?.questions ?? []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-2xl border-dashed">
                <FileQuestion className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">No questions yet in this category.</p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to ask!</p>
              </div>
            )}
            {!qaLoading && !qaError && (qaList?.questions ?? []).map(item => (
              <QACard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}