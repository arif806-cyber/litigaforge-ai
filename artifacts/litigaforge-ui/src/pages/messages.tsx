import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, ArrowLeft, Loader2, User, Scale,
  CheckCheck, Plus, ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SEOHelmet } from "@/components/SEOHelmet";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────────── */
interface ChatThread {
  id: number;
  match_id: number;
  title: string;
  created_at: string;
  case_title: string;
  lawyer_name: string;
  client_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface ChatMessage {
  id: number;
  thread_id: number;
  sender_id: number | null;
  sender_role: "user" | "ai";
  content: string;
  created_at: string;
}

/* ── Thread list item ────────────────────────────────────────── */
function ThreadRow({
  thread, active, role, onClick,
}: {
  thread: ChatThread; active: boolean;
  role: string; onClick: () => void;
}) {
  const unread = thread.unread_count > 0;
  const otherParty = role === "lawyer" ? (thread.client_name ?? "Client") : thread.lawyer_name;
  const initials = otherParty.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);

  return (
    <button
      data-testid={`thread-row-${thread.id}`}
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 border-b border-border transition-colors flex items-start gap-3",
        active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/60 border-l-2 border-l-transparent",
      )}
    >
      <div className="w-10 h-10 rounded-full bg-sidebar flex items-center justify-center flex-shrink-0 border border-border mt-0.5">
        <span className="text-xs font-bold text-sidebar-foreground">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-sm truncate", unread ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>
            {otherParty}
          </p>
          {thread.last_message_at && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {new Date(thread.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {thread.case_title}
        </p>
        {thread.last_message ? (
          <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground font-medium" : "text-muted-foreground")}>
            {thread.last_message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-0.5 italic">No messages yet — say hello!</p>
        )}
      </div>
      {unread && (
        <div className="flex-shrink-0 mt-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {thread.unread_count > 9 ? "9+" : thread.unread_count}
        </div>
      )}
    </button>
  );
}

/* ── Message bubble ──────────────────────────────────────────── */
function MessageBubble({ msg, currentUserId }: { msg: ChatMessage; currentUserId: number }) {
  const isMe = msg.sender_id === currentUserId;
  const isAI = msg.sender_role === "ai";
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isAI) {
    return (
      <div className="flex items-start gap-2 px-4 py-1">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Scale className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="max-w-[80%]">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">LitigaForge AI</p>
          <div className="bg-amber-50 border border-amber-100 rounded-xl rounded-tl-sm px-3 py-2.5 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2 px-4 py-1", isMe ? "flex-row-reverse" : "flex-row")}>
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-sidebar border border-border flex items-center justify-center flex-shrink-0 mb-0.5">
          <User className="w-3.5 h-3.5 text-sidebar-foreground" />
        </div>
      )}
      <div className={cn("max-w-[75%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed",
          isMe
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        )}>
          {msg.content}
        </div>
        <div className={cn("flex items-center gap-1 mt-1", isMe ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isMe && <CheckCheck className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────── */
function EmptyConversation() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-primary/40" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">Select a conversation</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Choose a thread from the left to start messaging with your matched lawyer or client.
      </p>
    </div>
  );
}

/* ── No threads state ────────────────────────────────────────── */
function NoThreads({ role }: { role: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">No conversations yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        {role === "lawyer"
          ? "Accept a client match to start a direct conversation."
          : "Accept a lawyer match to open a direct chat with them."}
      </p>
      <button
        onClick={() => navigate("/matches")}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> View Matches
      </button>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Parse ?match=N or ?thread=N from URL
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const initMatchId = params.get("match") ? parseInt(params.get("match")!) : null;
  const initThreadId = params.get("thread") ? parseInt(params.get("thread")!) : null;

  const [activeThreadId, setActiveThreadId] = useState<number | null>(initThreadId);
  const [mobileView, setMobileView] = useState<"list" | "messages">("list");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Local message list — managed manually to support WS push + infinite scroll
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Threads query (no polling — WS events trigger invalidation) ── */
  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => apiFetch("/chat/threads"),
    enabled: !!user,
    staleTime: 15_000,
  });
  const threads: ChatThread[] = threadsData?.threads ?? [];

  // Auto-select by match_id or thread_id from URL
  useEffect(() => {
    if (!threads.length) return;
    if (initMatchId && !activeThreadId) {
      const found = threads.find((t) => t.match_id === initMatchId);
      if (found) setActiveThreadId(found.id);
    } else if (initThreadId && !activeThreadId) {
      setActiveThreadId(initThreadId);
    }
  }, [threads, initMatchId, initThreadId]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  /* ── Initial message load (latest 50) ── */
  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: ["chat-messages-init", activeThreadId],
    queryFn: () => apiFetch(`/chat/threads/${activeThreadId}/messages`),
    enabled: !!activeThreadId,
    // staleTime defaults to 0 so revisiting a thread always refetches fresh history;
    // WS handles real-time push while the thread is active.
  });

  // Seed localMessages from initial fetch
  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages(messagesData.messages);
      setHasOlderMessages((messagesData.messages as ChatMessage[]).length >= 50);
    }
  }, [messagesData]);

  // Reset on thread switch
  useEffect(() => {
    setLocalMessages([]);
    setHasOlderMessages(true);
    setLoadingOlder(false);
  }, [activeThreadId]);

  /* ── Mark read on thread open (clears badge immediately) ── */
  useEffect(() => {
    if (!activeThreadId) return;
    apiFetch(`/chat/threads/${activeThreadId}/mark-read`, { method: "POST" })
      .then(() => qc.invalidateQueries({ queryKey: ["chat-threads"] }))
      .catch(() => {});
  }, [activeThreadId, qc]);

  /* ── WebSocket subscription ── */
  useEffect(() => {
    if (!activeThreadId) return;
    const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "";
    const wsUrl = `${proto}//${host}/litigaforge/ws/chat/${activeThreadId}`;

    let ws: WebSocket;
    let closed = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Keep-alive ping every 25 s
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.event === "new_message") {
            const msg: ChatMessage = data.message;
            setLocalMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Mark read since thread is open, refresh thread list for badge update
            apiFetch(`/chat/threads/${activeThreadId}/mark-read`, { method: "POST" }).catch(() => {});
            qc.invalidateQueries({ queryKey: ["chat-threads"] });
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        // Reconnect after 3 s unless the effect was cleaned up
        if (!closed) setTimeout(connect, 3_000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    return () => {
      closed = true;
      if (pingInterval) clearInterval(pingInterval);
      ws?.close();
    };
  }, [activeThreadId, qc]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages.length]);

  /* ── Load older messages (cursor pagination) ── */
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasOlderMessages || !localMessages.length || !activeThreadId) return;
    const oldest = localMessages[0];
    const container = msgContainerRef.current;
    const scrollHeightBefore = container?.scrollHeight ?? 0;

    setLoadingOlder(true);
    try {
      const data = await apiFetch(
        `/chat/threads/${activeThreadId}/messages?before=${encodeURIComponent(oldest.created_at)}`
      );
      const older: ChatMessage[] = data.messages ?? [];
      if (older.length === 0) {
        setHasOlderMessages(false);
        return;
      }
      setHasOlderMessages(older.length >= 50);
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = older.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
      // Restore scroll position after prepend
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - scrollHeightBefore;
        }
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [activeThreadId, localMessages, loadingOlder, hasOlderMessages]);

  /* ── Scroll-to-top triggers loadOlder ── */
  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop < 10 && hasOlderMessages && !loadingOlder) {
        loadOlder();
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [loadOlder, hasOlderMessages, loadingOlder]);

  /* ── Send ── */
  const sendMut = useMutation({
    mutationFn: ({ content }: { content: string }) =>
      apiFetch("/chat/messages", {
        method: "POST",
        body: JSON.stringify({ thread_id: activeThreadId, content }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      setDraft("");
    },
  });

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content || !activeThreadId || sending) return;
    setSending(true);
    sendMut.mutate(
      { content },
      { onSettled: () => setSending(false) }
    );
  }, [draft, activeThreadId, sending, sendMut]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectThread = (thread: ChatThread) => {
    setActiveThreadId(thread.id);
    setMobileView("messages");
    const url = new URL(window.location.href);
    url.searchParams.set("thread", String(thread.id));
    url.searchParams.delete("match");
    window.history.replaceState({}, "", url.toString());
  };

  const otherParty = activeThread
    ? (user?.role === "lawyer"
      ? (activeThread.client_name ?? "Client")
      : activeThread.lawyer_name)
    : null;

  const unreadCount = threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);

  if (!user) return null;

  return (
    <>
      <SEOHelmet
        title="Messages — LitigaForge AI"
        description="Direct messages with your matched lawyers and clients."
        canonical="/messages"
      />

      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">

          {/* ── Thread list ── */}
          <div className={cn(
            "flex-shrink-0 border-r border-border bg-card flex flex-col",
            "w-full md:w-80",
            mobileView === "messages" ? "hidden md:flex" : "flex",
          )}>
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 bg-card">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-foreground text-base leading-tight">Messages</h1>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-primary font-semibold">{unreadCount} unread</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {threadsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <NoThreads role={user.role} />
              ) : (
                <AnimatePresence initial={false}>
                  {threads.map((t) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                      <ThreadRow
                        thread={t}
                        active={t.id === activeThreadId}
                        role={user.role}
                        onClick={() => selectThread(t)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* ── Message view ── */}
          <div className={cn(
            "flex-1 flex flex-col overflow-hidden bg-background",
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}>
            {!activeThread ? (
              <EmptyConversation />
            ) : (
              <>
                {/* Header */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card flex items-center gap-3">
                  <button
                    onClick={() => setMobileView("list")}
                    className="md:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-sidebar border border-border flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-sidebar-foreground">
                      {(otherParty ?? "?").split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{otherParty}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{activeThread.case_title}</p>
                  </div>
                </div>

                {/* Messages */}
                <div ref={msgContainerRef} className="flex-1 overflow-y-auto py-3 space-y-1">
                  {/* Load older indicator */}
                  {hasOlderMessages && localMessages.length > 0 && (
                    <div className="flex justify-center py-2">
                      {loadingOlder ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          onClick={loadOlder}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" /> Load older messages
                        </button>
                      )}
                    </div>
                  )}

                  {msgsLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : localMessages.length === 0 ? (
                    <div className="py-12 text-center px-6">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">Start the conversation</p>
                      <p className="text-xs text-muted-foreground">
                        Send your first message to {otherParty}.
                      </p>
                    </div>
                  ) : (
                    localMessages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} currentUserId={user.id} />
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                {/* Composer */}
                <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      data-testid="message-input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      style={{ resize: "none" }}
                      className="flex-1 bg-muted rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all min-h-[44px] max-h-32 overflow-y-auto"
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = Math.min(el.scrollHeight, 128) + "px";
                      }}
                    />
                    <button
                      data-testid="message-send-btn"
                      onClick={handleSend}
                      disabled={!draft.trim() || sending}
                      className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-40 transition-all active:scale-95"
                      aria-label="Send message"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    Messages are between you and your matched {user.role === "lawyer" ? "client" : "lawyer"} only.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
