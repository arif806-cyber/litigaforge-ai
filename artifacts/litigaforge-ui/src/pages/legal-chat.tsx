import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Bot, User, FileText, MessageSquare,
  Scale, BookOpen, Gavel, ArrowRight, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "legal_notice", label: "Legal Notice", icon: FileText, prompt: "Draft a formal legal notice for [describe issue]. Include all necessary sections under Indian law." },
  { id: "agreement", label: "Agreement Draft", icon: Scale, prompt: "Draft a [rental/partnership/employment] agreement. Include standard clauses under Indian Contract Act, 1872." },
  { id: "petition", label: "Court Petition", icon: Gavel, prompt: "Draft a petition for [civil/criminal/writ] matter for filing in [High Court/District Court]." },
  { id: "reply", label: "Reply to Notice", icon: BookOpen, prompt: "Draft a reply to a legal notice received regarding [matter]. Be firm but legally sound." },
];

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

export default function LegalChat() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      content: "Hello! I am LitigaForge AI, your legal assistant for Telangana and Andhra Pradesh.\n\nI can help you with:\n- Drafting legal notices, agreements, and petitions\n- Explaining procedural steps\n- Analyzing case scenarios\n- Citing relevant Indian laws\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await apiFetch("/ai-legal-chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("AI error");
      const data = await res.json();
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", content: data.reply || "Sorry, I could not generate a response." };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = { id: Date.now() + 1, role: "ai", content: "I apologise, but I am unable to respond right now. Please try again later." };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleTemplate = (template: typeof TEMPLATES[0]) => {
    sendMessage(template.prompt);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => window.location.href = "/login"}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
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
