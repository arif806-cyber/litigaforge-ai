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
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCountry } from "@/hooks/useCountry";
import { cn } from "@/lib/utils";
import { LEGAL_CHAT_COPY } from "@/lib/country-copy";
import { LegalDisclaimerBanner } from "@/components/legal-disclaimer";

const DETAIL_FIELDS = [
  { id: "location", label: "Location / jurisdiction", placeholder: "e.g. city, state or region" },
  { id: "parties", label: "People or parties involved", placeholder: "e.g. employer, landlord, spouse" },
  { id: "dates", label: "Key dates", placeholder: "e.g. when it happened, deadlines" },
  { id: "amount", label: "Amount / value involved", placeholder: "e.g. amount in dispute" },
] as const;

const TEMPLATES = [
  { id: "legal_notice", label: "Legal Notice", icon: FileText, prompt: "Draft a formal legal notice for [describe issue]. Include all the sections required under the applicable law of my jurisdiction." },
  { id: "agreement", label: "Agreement Draft", icon: Scale, prompt: "Draft a [rental/partnership/employment] agreement with the standard clauses that are valid and enforceable in my jurisdiction." },
  { id: "petition", label: "Court Petition", icon: Gavel, prompt: "Draft a petition for a [civil/criminal/writ] matter for filing in the appropriate court in my jurisdiction." },
  { id: "reply", label: "Reply to Notice", icon: BookOpen, prompt: "Draft a reply to a legal notice received regarding [matter]. Be firm but legally sound." },
];

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

export default function LegalChat() {
  const { user } = useAuth();
  const { activeCode, activeConfig } = useCountry();
  const [input, setInput] = useState("");
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});

  const chatCopy = LEGAL_CHAT_COPY[activeCode.toUpperCase()] ?? LEGAL_CHAT_COPY.IN;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      content: chatCopy.welcome,
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const composeDetails = (): string => {
    const parts: string[] = [];
    for (const f of DETAIL_FIELDS) {
      const v = (details[f.id] ?? "").trim();
      if (v) parts.push(`${f.label}: ${v}`);
    }
    return parts.length ? "Additional details provided by the user:\n- " + parts.join("\n- ") : "";
  };

  const callAI = async (message: string, context: string) => {
    setIsTyping(true);
    try {
      const data = await apiFetch("/ai-legal-chat", {
        method: "POST",
        body: JSON.stringify({ message, context, country: activeCode }),
      });
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", content: data.reply || "Sorry, I could not generate a response." };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const detail = err?.message || "";
      const errMsg: Message = { id: Date.now() + 1, role: "ai", content: detail || "I apologise, but I am unable to respond right now. Please try again later." };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const formDetails = composeDetails();

    // If we are awaiting answers to clarifying questions, treat this turn as the answers.
    if (pendingQ !== null) {
      const original = pendingQ;
      setPendingQ(null);
      if (text.trim().toLowerCase() === "skip") {
        await callAI(original, formDetails);
      } else {
        const ctx = [formDetails, `User's answers to the clarifying questions: ${text.trim()}`]
          .filter(Boolean).join("\n\n");
        await callAI(original, ctx);
      }
      return;
    }

    // Fresh message — see if clarifying questions would help first.
    setIsTyping(true);
    try {
      const clarify = await apiFetch("/clarify", {
        method: "POST",
        body: JSON.stringify({ text, surface: "chat", country: activeCode }),
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
        setIsTyping(false);
        return;
      }
    } catch {
      // If clarify fails, fall through to a direct answer.
    }
    setIsTyping(false);
    await callAI(text, formDetails);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleTemplate = (template: typeof TEMPLATES[0]) => {
    sendMessage(template.prompt);
  };

  if (!user) {
    return (<>
      <SEOHelmet title="AI Legal Chat" description="Interactive legal drafting assistant with AI templates." canonical="/legal-chat" />
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
      { id: 0, role: "ai", content: chatCopy.welcome },
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
                "rounded-xl px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-foreground"
              )}>
                {msg.content}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="bg-card border border-card-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
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
    </div>
  );
}
