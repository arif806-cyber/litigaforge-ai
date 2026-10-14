import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Bot, User, FileText, MessageSquare,
  Scale, BookOpen, Gavel, ChevronDown, Sparkles,
  Download, Trash2
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch, runLongJob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCountry } from "@/hooks/useCountry";
import { cn } from "@/lib/utils";
import { LEGAL_CHAT_COPY } from "@/lib/country-copy";
import { LegalDisclaimerBanner } from "@/components/legal-disclaimer";
import ReactMarkdown from "react-markdown";
import { useConnectFlags, CONNECT_LANGUAGE_STORAGE_KEY } from "@/hooks/use-connect-v2";

const DETAIL_FIELDS = [
  { id: "location", label: "Location / jurisdiction", placeholder: "e.g. city, state or region" },
  { id: "parties", label: "People or parties involved", placeholder: "e.g. employer, landlord, spouse" },
  { id: "dates", label: "Key dates", placeholder: "e.g. when it happened, deadlines" },
  { id: "amount", label: "Amount / value involved", placeholder: "e.g. amount in dispute" },
] as const;

const TEMPLATES = [
  { id: "legal_notice", label: "Legal Notice", icon: FileText, prompt: "Draft a legal notice" },
  { id: "agreement", label: "Agreement Draft", icon: Scale, prompt: "Draft an agreement" },
  { id: "petition", label: "Court Petition", icon: Gavel, prompt: "Draft a court petition" },
  { id: "reply", label: "Reply to Notice", icon: BookOpen, prompt: "Draft a reply to a legal notice" },
];

type ChatAction = { label: string; href: string; kind: string; prefill?: Record<string, string> };
interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
  actions?: ChatAction[];
}

export default function LegalChat() {
  const { user } = useAuth();
  const { activeCode, activeConfig } = useCountry();
  const { data: connectFlags } = useConnectFlags();
  const preferredLanguage = localStorage.getItem(CONNECT_LANGUAGE_STORAGE_KEY)
    || (user as (typeof user & { preferred_language?: string }) | null)?.preferred_language
    || "en";
  const [input, setInput] = useState("");
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [templateFields, setTemplateFields] = useState({ matter: "", location: "", court: "", facts: "" });

  const chatCopy = LEGAL_CHAT_COPY[activeCode.toUpperCase()] ?? LEGAL_CHAT_COPY.IN;
  const welcomeMessage = chatCopy.welcome.replace(/\n\n---\n\*This platform only connects users\..*$/s, "");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      content: welcomeMessage,
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStage, setTypingStage] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping) {
      setTypingStage(0);
      return;
    }
    const id = window.setInterval(() => {
      setTypingStage((stage) => Math.min(stage + 1, 2));
    }, 15000);
    return () => window.clearInterval(id);
  }, [isTyping]);

  const composeDetails = (): string => {
    const parts: string[] = [];
    for (const f of DETAIL_FIELDS) {
      const v = (details[f.id] ?? "").trim();
      if (v) parts.push(`${f.label}: ${v}`);
    }
    return parts.length ? "Additional details provided by the user:\n- " + parts.join("\n- ") : "";
  };

  const callAI = async (message: string, context: string, extraTurns: Array<{role: "user" | "ai"; content: string}> = []): Promise<boolean> => {
    setTypingStage(0);
    setIsTyping(true);
    try {
      const data = await runLongJob<{ reply?: string; actions?: ChatAction[] }>("/ai-legal-chat", {
        method: "POST",
        body: { message, context, country: activeCode, ...(connectFlags?.multilang ? { language: preferredLanguage } : {}), history: [
          ...messages.map(({ role, content }) => ({ role, content })),
          ...extraTurns,
          { role: "user", content: message },
        ] },
      });
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", content: data.reply || "Sorry, I could not generate a response.", actions: data.actions };
      setMessages((prev) => [...prev, aiMsg]);
      return true;
    } catch (err: any) {
      const detail = err?.message || "";
      const errMsg: Message = { id: Date.now() + 1, role: "ai", content: detail || "I apologise, but I am unable to respond right now. Please try again later." };
      setMessages((prev) => [...prev, errMsg]);
      return false;
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async (text: string, clearInputOnSuccess = false) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const formDetails = composeDetails();

    // If we are awaiting answers to clarifying questions, treat this turn as the answers.
    if (pendingQ !== null) {
      const original = pendingQ;
      setPendingQ(null);
      if (text.trim().toLowerCase() === "skip") {
        const ok = await callAI(original, formDetails);
        if (ok && clearInputOnSuccess) setInput("");
      } else {
        const ctx = [formDetails, `User's answers to the clarifying questions: ${text.trim()}`]
          .filter(Boolean).join("\n\n");
        const ok = await callAI(original, ctx, [{ role: "user", content: text.trim() }]);
        if (ok && clearInputOnSuccess) setInput("");
      }
      return;
    }

    // Fresh message — see if clarifying questions would help first.
    setIsTyping(true);
    try {
      const clarify = await apiFetch("/clarify", {
        method: "POST",
        body: JSON.stringify({ text, context: formDetails, surface: "chat", country: activeCode, ...(connectFlags?.multilang ? { language: preferredLanguage } : {}), history: [
          ...messages.map(({ role, content }) => ({ role, content })),
          { role: "user", content: text },
        ] }),
      });
      const questions: string[] = Array.isArray(clarify?.questions) ? clarify.questions : [];
      if (questions.length > 0) {
        const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
        const ask: Message = {
          id: Date.now() + 1,
          role: "ai",
          content: `To give you the most accurate answer under ${activeConfig?.name ?? "your country"}'s law, could you help with a few details?\n\n${list}\n\nReply with the answers, or type **skip** for a general answer.`,
        };
        setMessages((prev) => [...prev, ask]);
        setPendingQ(text);
        if (clearInputOnSuccess) setInput("");
        setIsTyping(false);
        return;
      }
    } catch {
      // If clarify fails, fall through to a direct answer.
    }
    setIsTyping(false);
    const ok = await callAI(text, formDetails);
    if (ok && clearInputOnSuccess) setInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, true);
  };

  const handleTemplate = (template: typeof TEMPLATES[0]) => {
    setTemplateFields({ matter: "", location: details.location ?? "", court: "", facts: "" });
    setSelectedTemplate(template);
  };

  const submitTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    const f = templateFields;
    setSelectedTemplate(null);
    sendMessage(`${selectedTemplate.prompt} for this matter.\nMatter: ${f.matter || "[matter]"}\nState/city or region: ${f.location || "[location]"}\nCourt/forum: ${f.court || "[court/forum to be confirmed]"}\nFacts, dates, amounts, documents: ${f.facts || "[facts and supporting documents]"}\nUse placeholders for unknown facts and list details to confirm.`, true);
  };

  if (!user) {
    return (<>
      <SEOHelmet title="AI Legal Drafting" description="Draft legal notices, petitions, replies, and other documents with guided AI assistance." canonical="/legal-chat" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => window.location.href = "/login"}>Sign In</Button>
        </div>
      </div>
    </>);
  }

  const exportChat = (format: "txt" | "md") => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const header = `LitigaForge AI - Legal Chat Export\nDate: ${timestamp}\nUser: ${user?.name ?? "Anonymous"}\n\n`;
    const body = messages.map(m => {
      const label = m.role === "user" ? "You" : "LitigaForge AI";
      return `--- ${label} ---\n${m.content}\n`;
    }).join("\n");
    const content = header + body;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `litigaforge-chat-${timestamp}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    if (!confirm("Clear this chat session? This cannot be undone.")) return;
    setMessages([
      { id: 0, role: "ai", content: welcomeMessage },
    ]);
  };

  return (
    // On mobile the layout chain (min-h-full + footer) never gives this page a
    // definite height, so a plain `h-full` collapses and the bottom input bar
    // (with the "Add details" dropdown) gets pushed under the fixed bottom tab
    // bar. Bound the height explicitly: 100dvh minus the 56px mobile header and
    // the 72px bottom tab bar. Desktop keeps the flexbox `h-full`.
    <div className="flex flex-col h-[calc(100dvh-3.5rem-72px)] md:h-full bg-background">
      <LegalDisclaimerBanner />
      <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportChat("txt")}
            className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
            title="Export chat"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={clearChat}
            className="text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-card border border-card-border text-foreground [&_.prose]:whitespace-normal"
              )}>
                {msg.role === "ai"
                  ? <div className="prose prose-sm prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  : msg.content}
                {msg.actions?.length ? <div className="flex flex-wrap gap-2 mt-3">
                  {msg.actions.map(action => <button key={action.kind} type="button"
                    onClick={() => {
                      if (action.prefill) sessionStorage.setItem("legal-chat-case-prefill", JSON.stringify(action.prefill));
                      window.location.href = action.href;
                    }}
                    className="text-xs font-semibold rounded-md border border-primary/30 px-3 py-1.5 text-primary hover:bg-primary/5">
                    {action.label}
                  </button>)}
                </div> : null}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="bg-card border border-card-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">{[
                  "Understanding your question…",
                  `Finding relevant ${activeConfig?.name ?? "local"} law and procedure…`,
                  "Drafting and checking your answer…",
                ][typingStage]}</p>
              </div>
            </div>
          )}

          {messages.length === 1 && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Templates</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplate(t)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                  >
                    <t.icon className="w-5 h-5 text-primary" />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-card p-3 md:p-4">
        <div className="max-w-3xl mx-auto mb-2">
          <button
            type="button"
            onClick={() => setDetailsOpen(o => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            data-testid="chat-details-toggle"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Add details (optional)
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {DETAIL_FIELDS.map(f => (
                    <input
                      key={f.id}
                      value={details[f.id] ?? ""}
                      onChange={e => setDetails(p => ({ ...p, [f.id]: e.target.value }))}
                      placeholder={f.id === "amount" && activeConfig?.currency_symbol ? `e.g. ${activeConfig.currency_symbol}50,000` : f.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      data-testid={`chat-detail-${f.id}`}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a legal question or request a draft..."
              rows={1}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[48px] max-h-[120px]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <p className="absolute right-3 bottom-1 text-[10px] text-muted-foreground tabular-nums pointer-events-none">
              {input.length} / 1,000
            </p>
          </div>
          <Button type="submit" disabled={isTyping || !input.trim() || input.length > 1000} size="icon" className="h-12 w-12 rounded-xl flex-shrink-0">
            <Send className="w-5 h-5" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI-generated guidance only. Verify with a qualified lawyer. We do not provide legal advice.
        </p>
      </div>
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="template-dialog-title"
            onSubmit={submitTemplate}
            className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="template-dialog-title" className="text-lg font-semibold">{selectedTemplate.label}</h2>
                <p className="text-sm text-muted-foreground">Share the key facts. Unknown details can stay as placeholders.</p>
              </div>
              <button type="button" onClick={() => setSelectedTemplate(null)} aria-label="Close template form"
                className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <label className="block text-sm font-medium">Matter and issue
              <input required value={templateFields.matter} onChange={e => setTemplateFields(p => ({ ...p, matter: e.target.value }))}
                placeholder="e.g. unpaid rent, consumer refund, employment termination"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium">State/city or region
                <input value={templateFields.location} onChange={e => setTemplateFields(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Hyderabad, Telangana"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium">Court or forum (if known)
                <input value={templateFields.court} onChange={e => setTemplateFields(p => ({ ...p, court: e.target.value }))}
                  placeholder="Leave blank if unsure"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="block text-sm font-medium">Key facts, dates, amounts, and documents
              <textarea rows={4} value={templateFields.facts} onChange={e => setTemplateFields(p => ({ ...p, facts: e.target.value }))}
                placeholder="Include the sequence of events and any documents or notices."
                className="mt-1 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedTemplate(null)}>Cancel</Button>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
