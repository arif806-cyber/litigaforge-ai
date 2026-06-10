import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Clock, FileQuestion, AlertTriangle, Sparkles, Bot, User, Trash2 } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/hooks/useCountry";
import { ASK_COPY } from "@/lib/country-copy";
import { formatDate } from "@/lib/locale";
import { ClarifyDialog } from "@/components/ClarifyDialog";
import { getAskCategories, askCategoryLabel, allCategoryLabel } from "@/data/askCategories";

const CAT_COLORS: Record<string, string> = {
  property: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  tenancy: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  housing: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  criminal: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  family: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  "gst-tax": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  immigration: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  visa: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  labour: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  employment: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  consumer: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "motor-accident": "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  insurance: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  business: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
  ip: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  "data-privacy": "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
  "human-rights": "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  "small-claims": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  contracts: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800",
  civil: "bg-muted text-slate-700 border-border dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800",
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

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  category?: string;
  isError?: boolean;
}

function QACard({ item, country }: { item: QAItem; country?: string }) {
  const [expanded, setExpanded] = useState(false);
  const color = CAT_COLORS[item.category] ?? CAT_COLORS.general;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 transition-colors"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
        data-testid={`button-qa-${item.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border", color)}>
              {item.category}
            </span>
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(item.created_at, country)}
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
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
      data-testid={`chat-msg-${msg.role}`}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
        isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : msg.isError
            ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-sm"
            : "bg-muted/60 border border-border text-foreground rounded-tl-sm"
      )}>
        {!isUser && msg.category && !msg.isError && (
          <span className={cn("inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border mb-2", CAT_COLORS[msg.category] ?? CAT_COLORS.general)}>
            {msg.category}
          </span>
        )}
        <div className="whitespace-pre-line">{msg.content}</div>
      </div>
    </motion.div>
  );
}

export default function Ask() {
  const { activeCode, activeConfig } = useCountry();
  const categories = getAskCategories(activeCode);
  const countryName = activeConfig?.name ?? "your country";

  // CTAs from the country landing cards arrive as /ask?category=…&q=… — pre-fill
  // the form so the question opens in the right legal area for this jurisdiction.
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const paramCategory = params.get("category") ?? "";
  const paramQ = params.get("q") ?? "";
  const initialCategory = categories.some((c) => c.id === paramCategory) ? paramCategory : "general";

  const [question, setQuestion] = useState(paramQ);
  const [category, setCategory] = useState(initialCategory);
  const [browseCategory, setBrowseCategory] = useState("all");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // When opened from a landing CTA with a prefilled question, focus and reveal it.
  useEffect(() => {
    if (paramQ && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the user switches country, drop a selected category that doesn't exist in
  // the new jurisdiction so we never submit a category invalid for that country.
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) {
      setCategory("general");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode]);

  const { data: qaList, refetch, isLoading: qaLoading, isError: qaError, error: qaErrorData } = useQuery<{ questions: QAItem[]; total: number }>({
    queryKey: ["questions", browseCategory, activeCode],
    queryFn: () => apiFetch(`/ask?limit=20&country=${activeCode}${browseCategory !== "all" ? `&category=${browseCategory}` : ""}`),
    staleTime: 30000,
  });

  const qaSchema = (qaList?.questions?.length ?? 0) > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": qaList!.questions.slice(0, 10).map(item => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.ai_answer,
          },
        })),
      }
    : undefined;

  const askMutation = useMutation({
    mutationFn: (data: { question: string; category: string; country: string }) =>
      apiFetch("/ask", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: data.answer, category: data.category }]);
      refetch();
    },
    onError: (err) => {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: (err as Error).message || "Something went wrong. Please try again.", isError: true }]);
    },
  });

  // Visible, rotating progress while the AI works on an answer.
  const progressSteps = [
    "Reading your question…",
    `Checking ${countryName} statutes & procedure…`,
    "Reviewing relevant case law…",
    "Drafting your answer…",
  ];
  useEffect(() => {
    if (!askMutation.isPending) {
      setProgressStep(0);
      return;
    }
    const id = setInterval(() => setProgressStep(s => (s + 1) % progressSteps.length), 1800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askMutation.isPending]);

  // Keep the latest message / progress indicator in view. Skip while the thread
  // is empty so the page doesn't jump past the title on first load.
  useEffect(() => {
    if (messages.length === 0 && !askMutation.isPending) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, askMutation.isPending]);

  const copy = ASK_COPY[activeCode.toUpperCase()] ?? ASK_COPY.IN;

  const triggerAsk = () => {
    if (!question.trim() || askMutation.isPending) return;
    setClarifyOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAsk();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerAsk();
    }
  };

  const runAsk = (extraDetails: string) => {
    setClarifyOpen(false);
    const userText = question.trim();
    const finalQuestion = extraDetails ? `${userText}\n\n${extraDetails}` : userText;
    setMessages(prev => [...prev, { id: Date.now(), role: "user", content: userText, category }]);
    setQuestion("");
    askMutation.mutate({ question: finalQuestion, category, country: activeCode });
  };

  const clearChat = () => setMessages([]);

  return (
    <PageShell title={copy.title} subtitle={copy.subtitle ?? `Ask any legal question — get instant answers grounded in the law of ${countryName} and local procedures.`} icon={<MessageSquare className="w-6 h-6 text-primary" />}>
      <SEOHelmet
        title={copy.title}
        description={copy.description}
        canonical="/ask"
        keywords={copy.keywords}
        structuredData={qaSchema}
      />

      <div className="space-y-10">
        {/* Chat interface */}
        <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden" data-testid="ask-chat-panel">
          {/* Panel header */}
          <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground leading-tight">AI Legal Assistant</h2>
                <p className="text-xs text-muted-foreground">Answers grounded in {countryName} law</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                data-testid="button-clear-chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Message thread */}
          <div className="px-4 md:px-6 py-5 space-y-5 min-h-[280px] max-h-[540px] overflow-y-auto" aria-live="polite" data-testid="ask-chat-thread">
            {messages.length === 0 && !askMutation.isPending && (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">Ask your first legal question</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Pick a category below, describe your situation, and get a clear answer based on {countryName} law.
                </p>
              </div>
            )}

            {messages.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}

            {/* Visible progress indicator */}
            {askMutation.isPending && (
              <div className="flex gap-3" data-testid="ask-progress">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted/60 border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={progressStep}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      className="text-xs text-muted-foreground font-medium"
                    >
                      {progressSteps[progressStep]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4 md:p-5 space-y-3 bg-muted/20">
            <div className="flex flex-wrap gap-2" data-testid="ask-category-chips">
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all",
                    category === c.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                  data-testid={`chip-ask-${c.id}`}
                >
                  {askCategoryLabel(c, activeCode)}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your situation… (e.g. My landlord won't return my deposit)"
                rows={2}
                className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none shadow-sm"
                data-testid="input-question"
              />
              <Button
                type="submit"
                size="lg"
                disabled={!question.trim() || askMutation.isPending}
                className="px-5 shadow-md h-12"
                data-testid="button-send"
              >
                {askMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline ml-2">Send</span>
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground/70">
              Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Shift+Enter</kbd> for a new line.
            </p>
          </div>
        </div>

        {/* Community Q&A */}
        <div>
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/50">
            <h2 className="text-lg font-bold text-foreground">Community Knowledge Base</h2>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{qaList?.total ?? 0} answered</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              key="all"
              onClick={() => setBrowseCategory("all")}
              className={cn(
                "text-xs font-semibold px-4 py-2 rounded-full border transition-all",
                browseCategory === "all"
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              )}
              data-testid="chip-browse-all"
            >
              {allCategoryLabel(activeCode)}
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setBrowseCategory(c.id)}
                className={cn(
                  "text-xs font-semibold px-4 py-2 rounded-full border transition-all",
                  browseCategory === c.id
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                )}
                data-testid={`chip-browse-${c.id}`}
              >
                {askCategoryLabel(c, activeCode)}
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
              <QACard key={item.id} item={item} country={activeCode} />
            ))}
          </div>
        </div>
      </div>

      <ClarifyDialog
        open={clarifyOpen}
        surface="ask"
        baseText={question}
        country={activeCode}
        onProceed={runAsk}
        onClose={() => setClarifyOpen(false)}
        proceedLabel="Get Legal Advice"
      />
    </PageShell>
  );
}
