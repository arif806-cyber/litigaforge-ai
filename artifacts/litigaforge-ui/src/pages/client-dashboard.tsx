import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Clock, CheckCircle2, FileText, User, MessageSquare,
  Gavel, Search, Plus, ChevronRight, X, Menu, Phone, MapPin,
  Star, Loader2, Sparkles, Send, Bell, Shield, Award, ArrowRight,
  Scale, StickyNote, ChevronDown,
} from "lucide-react";

interface MyRequirement {
  id: number;
  title: string;
  case_type: string;
  description: string;
  location: string;
  budget_range: string;
  is_anonymous: boolean;
  status: string;
  created_at: string;
}

interface MatchProposal {
  id: number;
  case_requirement_id: number;
  lawyer_id: number;
  lawyer_name: string;
  lawyer_email: string;
  lawyer_phone: string;
  bar_number: string;
  district: string;
  experience_years: number;
  rating: number;
  hourly_rate: number;
  match_score: number;
  ai_explanation: string;
  client_message: string;
  status: string;
  created_at: string;
}

interface ChatThread {
  id: number;
  match_id: number;
  title: string;
  created_at: string;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────────────
function ClientSidebar({ onNav }: { onNav?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const items = [
    { path: "/client-dashboard", label: "Dashboard", icon: Briefcase },
    { path: "/post-case", label: "Post a Case", icon: Plus },
    { path: "/my-cases", label: "My Cases", icon: FileText },
    { path: "/matches", label: "Match Proposals", icon: Sparkles },
    { path: "/legal-chat", label: "AI Legal Chat", icon: MessageSquare },
    { path: "/ask", label: "Legal Q&A", icon: Gavel },
    { path: "/lawyers", label: "Find Lawyer", icon: Search },
    { path: "/judgments", label: "Judgments", icon: Scale },
    { path: "/legal-aid", label: "Free Legal Aid", icon: Shield },
  ];
  return (
    <div className="h-full flex flex-col" style={{ background: "#1a2744", color: "#fff" }}>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <Scale className="w-4 h-4" style={{ color: "#FBBF24" }} />
          </div>
          <span className="font-bold text-sm tracking-tight">LitigaForge</span>
        </div>
        <p className="text-[11px] opacity-50 font-medium">Client Portal</p>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location === item.path;
          return (
            <button key={item.path} onClick={() => { setLocation(item.path); onNav?.(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left ${active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
              <Icon className="w-4 h-4 flex-shrink-0" /> {item.label}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2563EB" }}>
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold truncate">{user?.name || "Client"}</p>
            <p className="text-[10px] opacity-50 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={() => { logout(); setLocation("/login"); }}
          className="w-full text-[11px] font-semibold py-2 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all">
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto"
        style={{ border: "1px solid #E2E8F0" }}>
        <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matchTab, setMatchTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [showMatchDetail, setShowMatchDetail] = useState<MatchProposal | null>(null);
  const [showMessageModal, setShowMessageModal] = useState<{ matchId: number; lawyerName: string } | null>(null);
  const [messageText, setMessageText] = useState("");

  // Fetch data
  const { data: requirementsData, isLoading: reqLoading } = useQuery({
    queryKey: ["client-requirements"],
    queryFn: () => apiFetch("/cases/requirements/mine"),
    enabled: !!user,
  });
  const requirements: MyRequirement[] = requirementsData?.requirements || [];

  const { data: matchesData, isLoading: matchLoading } = useQuery({
    queryKey: ["client-matches"],
    queryFn: () => apiFetch("/matches/client"),
    enabled: !!user,
  });
  const allMatches: MatchProposal[] = matchesData?.matches || [];

  const { data: threadsData } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => apiFetch("/chat/threads"),
    enabled: !!user,
  });
  const threads: ChatThread[] = threadsData?.threads || [];

  const acceptMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/matches/${id}/accept`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-matches"] }),
  });
  const declineMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/matches/${id}/decline`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-matches"] }),
  });
  const sendMsgMut = useMutation({
    mutationFn: ({ threadId, content }: { threadId: number; content: string }) =>
      apiFetch(`/chat/messages/${threadId}`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => { setMessageText(""); setShowMessageModal(null); qc.invalidateQueries({ queryKey: ["chat-threads"] }); },
  });

  const filteredMatches = allMatches.filter((m) => m.status === matchTab);
  const activeReqs = requirements.filter((r) => r.status === "open").length;
  const acceptedMatches = allMatches.filter((m) => m.status === "accepted").length;
  const pendingMatches = allMatches.filter((m) => m.status === "pending").length;

  const quickActions = [
    { label: "Post a Case", icon: Plus, color: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE", action: () => setLocation("/post-case") },
    { label: "Find Lawyer", icon: Search, color: "#059669", bg: "#ECFDF5", border: "#D1FAE5", action: () => setLocation("/lawyers") },
    { label: "AI Chat", icon: MessageSquare, color: "#7C3AED", bg: "#F5F3FF", border: "#EDE9FE", action: () => setLocation("/legal-chat") },
    { label: "Ask Question", icon: Gavel, color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", action: () => setLocation("/ask") },
  ];

  const firstName = user?.name?.split(" ")[0] ?? "Client";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setDrawerOpen(false)} />
            <motion.aside key="drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden shadow-2xl">
              <ClientSidebar onNav={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 h-full"><ClientSidebar /></aside>

      {/* Main */}
      <main className="flex-1 h-full overflow-auto pb-16 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-5 py-3 flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Good day, {firstName}</h1>
              <p className="text-[11px] text-gray-400">{requirements.length} case{requirements.length !== 1 ? "s" : ""} posted · {acceptedMatches} lawyer{acceptedMatches !== 1 ? "s" : ""} connected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/subscription")} className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "#FDE68A", color: "#B45309", background: "#FEF3C7" }}>
              <Award className="w-3 h-3" /> {user?.subscription_tier === "free" ? "Free" : user?.subscription_tier === "professional" ? "Pro" : "Advocate Pro"}
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1a2744" }}>
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={a.action}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all hover:shadow-sm"
                  style={{ background: a.bg, borderColor: a.border, color: a.color }}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[13px] font-semibold">{a.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — Cases & Matches */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Active Cases", value: activeReqs, icon: Briefcase, color: "#2563EB", bg: "#EFF6FF" },
                  { label: "Pending Matches", value: pendingMatches, icon: Clock, color: "#D97706", bg: "#FEF3C7" },
                  { label: "Connected", value: acceptedMatches, icon: CheckCircle2, color: "#059669", bg: "#ECFDF5" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}><Icon className="w-3.5 h-3.5" style={{ color: s.color }} /></div>
                        <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* My Posted Cases */}
              <div className="bg-white rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}><FileText className="w-4 h-4 text-blue-600" /></div>
                    <h2 className="font-bold text-gray-900 text-sm">My Posted Cases</h2>
                  </div>
                  <button onClick={() => setLocation("/post-case")} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: "#2563EB" }}>+ Post New</button>
                </div>
                <div className="p-4 space-y-3">
                  {reqLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>}
                  {!reqLoading && requirements.length === 0 && (
                    <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                      <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No cases posted yet.</p>
                      <button onClick={() => setLocation("/post-case")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">Post your first case →</button>
                    </div>
                  )}
                  {requirements.map((r) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl p-4" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                          <Briefcase className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{r.title}</span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{r.case_type}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.status === "open" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>{r.status.toUpperCase()}</span>
                          </div>
                          <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{r.description || "No description"}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                            {r.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location}</span>}
                            {r.budget_range && <span className="flex items-center gap-1"><Award className="w-3 h-3" />{r.budget_range}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
                          </div>
                        </div>
                        <button onClick={() => setLocation("/my-cases")} className="text-gray-300 hover:text-blue-600 transition-colors flex-shrink-0"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Match Proposals */}
              <div className="bg-white rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F5F3FF" }}><Sparkles className="w-4 h-4 text-violet-600" /></div>
                    <h2 className="font-bold text-gray-900 text-sm">Match Proposals</h2>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
                    {(["pending","accepted","declined"] as const).map((t) => (
                      <button key={t} onClick={() => setMatchTab(t)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${matchTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {matchLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>}
                  {!matchLoading && filteredMatches.length === 0 && (
                    <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                      <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No {matchTab} proposals.</p>
                      {matchTab === "pending" && (
                        <button onClick={() => setLocation("/my-cases")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">Check your cases →</button>
                      )}
                    </div>
                  )}
                  {filteredMatches.map((m) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl p-4" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#1a2744" }}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{m.lawyer_name}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: m.match_score >= 80 ? "#059669" : m.match_score >= 60 ? "#D97706" : "#EF4444" }}>{m.match_score} Match</span>
                            {m.rating > 0 && (
                              <span className="text-[11px] flex items-center gap-0.5 text-amber-600"><Star className="w-3 h-3 fill-amber-400" />{m.rating}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{m.district} · {m.experience_years} yrs · ₹{m.hourly_rate}/hr</p>
                          {m.ai_explanation && (
                            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{m.ai_explanation}</p>
                          )}
                          {m.client_message && (
                            <div className="mt-2 rounded-lg p-2.5 text-[11px] text-gray-600" style={{ background: "#F1F5F9" }}>
                              <span className="font-semibold text-gray-700">Lawyer says:</span> {m.client_message}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            {m.status === "pending" && (
                              <>
                                <button onClick={() => acceptMut.mutate(m.id)}
                                  disabled={acceptMut.isPending}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-colors"
                                  style={{ background: "#059669" }}>
                                  {acceptMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Accept"}
                                </button>
                                <button onClick={() => declineMut.mutate(m.id)}
                                  disabled={declineMut.isPending}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                  {declineMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Decline"}
                                </button>
                              </>
                            )}
                            {m.status === "accepted" && (
                              <button onClick={() => setShowMessageModal({ matchId: m.id, lawyerName: m.lawyer_name })}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 transition-colors"
                                style={{ background: "#2563EB" }}>
                                <MessageSquare className="w-3 h-3" /> Message
                              </button>
                            )}
                            <button onClick={() => setShowMatchDetail(m)}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors ml-auto">View Profile →</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <aside className="space-y-4">
              {/* Messages */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F5F3FF" }}><MessageSquare className="w-4 h-4 text-violet-600" /></div>
                  <p className="text-sm font-bold text-gray-900">Messages</p>
                </div>
                <div className="space-y-2">
                  {threads.slice(0, 4).map((t) => (
                    <button key={t.id} onClick={() => setLocation("/legal-chat")}
                      className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#1a2744" }}>
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-gray-800 truncate">{t.title || `Thread #${t.id}`}</p>
                        <p className="text-[10px] text-gray-400">{new Date(t.created_at).toLocaleDateString("en-IN")}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                  {threads.length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-2">No messages yet</p>
                  )}
                </div>
              </div>

              {/* Legal Tools */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <p className="text-sm font-bold text-gray-900 mb-3">Legal Tools</p>
                <div className="space-y-1">
                  {[
                    { label: "Document Analyzer", icon: FileText, href: "/review" },
                    { label: "Judgment Finder", icon: Scale, href: "/judgments" },
                    { label: "Legal Q&A", icon: Gavel, href: "/ask" },
                    { label: "Free Legal Aid", icon: Shield, href: "/legal-aid" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.label} onClick={() => setLocation(item.href)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors text-[12px] font-medium text-left">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.label} <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NALSA */}
              <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: "#F1F5F9" }}>
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-700">NALSA Free Legal Aid</p>
                  <p className="text-[11px] text-gray-500">Toll-free: 15100</p>
                </div>
              </div>

              {/* Upgrade banner */}
              {user?.subscription_tier === "free" && (
                <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                  <Award className="w-6 h-6 mb-2" style={{ color: "#FBBF24" }} />
                  <p className="font-bold text-sm mb-1">Upgrade to Professional</p>
                  <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#BFDBFE" }}>Priority lawyer matching, unlimited AI credits, WhatsApp alerts.</p>
                  <button onClick={() => setLocation("/subscription")} className="w-full text-xs font-bold py-2 rounded-lg transition-colors" style={{ background: "#FBBF24", color: "#1a2744" }}>Upgrade — ₹999/mo</button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      {/* Match Detail Modal */}
      <Modal open={!!showMatchDetail} onClose={() => setShowMatchDetail(null)} title="Lawyer Profile">
        {showMatchDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#1a2744" }}>
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{showMatchDetail.lawyer_name}</p>
                <p className="text-[11px] text-gray-500">{showMatchDetail.district} · Bar: {showMatchDetail.bar_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Experience</p>
                <p className="text-sm font-bold text-gray-900">{showMatchDetail.experience_years} years</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hourly Rate</p>
                <p className="text-sm font-bold text-gray-900">₹{showMatchDetail.hourly_rate}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Rating</p>
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{showMatchDetail.rating || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Match Score</p>
                <p className="text-sm font-bold" style={{ color: showMatchDetail.match_score >= 80 ? "#059669" : showMatchDetail.match_score >= 60 ? "#D97706" : "#EF4444" }}>{showMatchDetail.match_score}/100</p>
              </div>
            </div>
            {showMatchDetail.ai_explanation && (
              <div className="rounded-lg p-3" style={{ background: "#F0F9FF", border: "1px solid #DBEAFE" }}>
                <p className="text-[11px] font-semibold text-blue-700 mb-1">AI Match Explanation</p>
                <p className="text-[12px] text-gray-600 leading-relaxed">{showMatchDetail.ai_explanation}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {showMatchDetail.lawyer_phone && (
                <a href={`tel:${showMatchDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg text-white transition-colors" style={{ background: "#059669" }}>
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
              {showMatchDetail.lawyer_email && (
                <a href={`mailto:${showMatchDetail.lawyer_email}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                  <Send className="w-3.5 h-3.5" /> Email
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Message Modal */}
      <Modal open={!!showMessageModal} onClose={() => setShowMessageModal(null)} title={`Message ${showMessageModal?.lawyerName || ""}`}>
        <div className="space-y-3">
          <p className="text-[12px] text-gray-500">Send a message to this lawyer. A chat thread will be created automatically.</p>
          <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4} placeholder="Type your message..."
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors resize-none" style={{ borderColor: "#E2E8F0" }} />
          <button
            onClick={() => {
              if (!showMessageModal || !messageText.trim()) return;
              // Find or create thread
              const existing = threads.find((t) => t.match_id === showMessageModal.matchId);
              if (existing) {
                sendMsgMut.mutate({ threadId: existing.id, content: messageText.trim() });
              } else {
                apiFetch("/chat/threads", { method: "POST", body: JSON.stringify({ match_id: showMessageModal.matchId, title: `Chat with ${showMessageModal.lawyerName}` }) })
                  .then((res: any) => {
                    if (res.thread?.id) {
                      sendMsgMut.mutate({ threadId: res.thread.id, content: messageText.trim() });
                    }
                  });
              }
            }}
            disabled={!messageText.trim() || sendMsgMut.isPending}
            className="w-full text-xs font-bold py-2.5 rounded-lg text-white disabled:opacity-50 transition-colors"
            style={{ background: "#2563EB" }}>
            {sendMsgMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Message"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
