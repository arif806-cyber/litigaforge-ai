import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, FileText, User, MessageSquare,
  Gavel, Plus, ChevronRight, X, Menu, Phone,
  Star, Loader2, Sparkles, Send, Bell, Shield, Award, ArrowRight,
  Scale, Calendar, FileCheck, Heart, FileSearch, Building2, Hash,
  PenSquare, Download, Share2, Search, Upload, Trash2,
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

interface ClientCase {
  id: number;
  lawyer_id: number;
  lawyer_name: string;
  lawyer_email: string;
  lawyer_phone: string;
  title: string;
  case_type: string;
  description: string;
  court_name: string;
  cnr_number: string;
  hearing_date: string;
  case_stage: string;
  status: string;
  created_at: string;
}

interface CaseDoc {
  id: number;
  filename: string;
  file_type: string;
  file_url: string;
  ai_summary: string;
  created_at: string;
}

interface ChatThread {
  id: number;
  match_id: number;
  title: string;
  created_at: string;
}

const CASE_STAGES = ["filed", "admitted", "evidence", "arguments", "reserved", "judgment"] as const;

function stageIndex(stage: string) {
  return Math.max(0, CASE_STAGES.indexOf(stage as any));
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    filed: "Case Filed",
    admitted: "Admitted",
    evidence: "Evidence Stage",
    arguments: "Arguments",
    reserved: "Reserved",
    judgment: "Judgment",
  };
  return labels[stage] || stage;
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
    { path: "/documents", label: "Documents", icon: FileCheck },
    { path: "/legal-chat", label: "AI Legal Chat", icon: MessageSquare },
    { path: "/ask", label: "Legal Q&A", icon: Gavel },
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

// ── Case Stage Timeline ──────────────────────────────────────────────────────────────
function CaseStageTimeline({ stage }: { stage: string }) {
  const idx = stageIndex(stage);
  return (
    <div className="flex items-center gap-1 mt-2">
      {CASE_STAGES.map((s, i) => {
        const done = i <= idx;
        const isCurrent = i === idx;
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
            {isCurrent && <span className="text-[10px] font-semibold text-emerald-600 ml-0.5">{stageLabel(s)}</span>}
            {i < CASE_STAGES.length - 1 && <div className={`w-3 h-px ${done ? "bg-emerald-300" : "bg-gray-100"}`} />}
          </div>
        );
      })}
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
  const [showCaseDetail, setShowCaseDetail] = useState<ClientCase | null>(null);
  const [showEditCase, setShowEditCase] = useState<ClientCase | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editHearing, setEditHearing] = useState("");
  const [messageText, setMessageText] = useState("");
  const [caseTab, setCaseTab] = useState<"active" | "pending" | "closed">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [caseDocs, setCaseDocs] = useState<any[]>([]);
  const [docUploading, setDocUploading] = useState(false);

  // Fetch case documents when detail modal opens
  useEffect(() => {
    if (!showCaseDetail) { setCaseDocs([]); return; }
    apiFetch(`/client/cases/${showCaseDetail.id}/documents`)
      .then((res: any) => setCaseDocs(res.documents || []))
      .catch(() => setCaseDocs([]));
  }, [showCaseDetail?.id]);

  // NEW: Fetch client's assigned cases from /client/cases
  const { data: clientCasesData, isLoading: casesLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: () => apiFetch("/client/cases"),
    enabled: !!user,
  });
  const clientCases: ClientCase[] = clientCasesData?.cases || [];

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

  // Derived stats for client dashboard
  const activeCases = clientCases.filter((c) => c.status === "active").length;
  const upcomingHearings = clientCases.filter((c) => c.hearing_date && new Date(c.hearing_date) >= new Date()).length;
  const totalDocs = clientCases.reduce((sum, c) => sum + (c as any)._docCount || 0, 0); // placeholder
  const connectedLawyers = [...new Set(clientCases.map((c) => c.lawyer_id))].length;

  const quickActions = [
    { label: "Post a Case", icon: Plus, color: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE", action: () => setLocation("/post-case") },
    { label: "Document Analyzer", icon: FileSearch, color: "#7C3AED", bg: "#F5F3FF", border: "#EDE9FE", action: () => setLocation("/review") },
    { label: "Legal Q&A", icon: Gavel, color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", action: () => setLocation("/ask") },
    { label: "Legal Aid", icon: Heart, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", action: () => setLocation("/legal-aid") },
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
              <p className="text-[11px] text-gray-400">{clientCases.length} case{clientCases.length !== 1 ? "s" : ""} assigned · {acceptedMatches} lawyer{acceptedMatches !== 1 ? "s" : ""} connected</p>
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
              {/* Client Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Active Cases", value: activeCases, icon: Briefcase, color: "#2563EB", bg: "#EFF6FF" },
                  { label: "Hearings", value: upcomingHearings, icon: Calendar, color: "#D97706", bg: "#FEF3C7" },
                  { label: "My Lawyers", value: connectedLawyers, icon: User, color: "#059669", bg: "#ECFDF5" },
                  { label: "Posted", value: activeReqs, icon: FileText, color: "#7C3AED", bg: "#F5F3FF" },
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

              {/* My Assigned Cases — Lawyer Dashboard Style */}
              <div className="bg-white rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                {/* Header with search + tabs */}
                <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "#F1F5F9" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}><FileCheck className="w-4 h-4 text-blue-600" /></div>
                    <h2 className="font-bold text-gray-900 text-sm">My Assigned Cases</h2>
                    <span className="text-[11px] text-gray-400 ml-1">({clientCases.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
                      {(["active","pending","closed"] as const).map((t) => (
                        <button key={t} onClick={() => setCaseTab(t)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${caseTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Search bar */}
                <div className="px-5 py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search cases by title, court, or CNR..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Case list */}
                <div className="p-4 space-y-2.5">
                  {casesLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>}
                  {!casesLoading && clientCases.length === 0 && (
                    <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                      <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No cases assigned yet.</p>
                      <button onClick={() => setLocation("/post-case")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">Post a case to get matched →</button>
                    </div>
                  )}
                  {!casesLoading && clientCases.length > 0 && (() => {
                    const filtered = clientCases
                      .filter((c) => c.status === caseTab)
                      .filter((c) => !searchQuery || [c.title, c.court_name, c.cnr_number, c.case_type].some((f) => f?.toLowerCase().includes(searchQuery.toLowerCase())));
                    if (filtered.length === 0) {
                      return <p className="text-sm text-gray-400 text-center py-6">No {caseTab} cases{searchQuery ? " matching your search" : ""}.</p>;
                    }
                    return filtered.map((c) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 hover:shadow-sm transition-all" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                              <Briefcase className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{c.case_type}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : c.status === "pending" ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>{c.status.toUpperCase()}</span>
                              </div>
                              <CaseStageTimeline stage={c.case_stage} />
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                {c.court_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.court_name}</span>}
                                {c.cnr_number && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{c.cnr_number}</span>}
                                {c.hearing_date && (
                                  <span className="flex items-center gap-1 text-amber-600 font-medium"><Calendar className="w-3 h-3" />{new Date(c.hearing_date).toLocaleDateString("en-IN")}</span>
                                )}
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.lawyer_name || "Advocate"}</span>
                              </div>
                            </div>
                          </div>
                          {/* Inline action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setShowEditCase(c); setEditDesc(c.description || ""); setEditHearing(c.hearing_date || ""); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit case"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\nCNR: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nStage: ${c.case_stage || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                                if (navigator.share) navigator.share({ title: c.title, text });
                                else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Share case"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\nCNR: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nStage: ${c.case_stage || "N/A"}\nDescription: ${c.description || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                                const blob = new Blob([text], { type: "text/plain" });
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = `case-${c.id}.txt`;
                                a.click();
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              title="Download case"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setShowCaseDetail(c)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              title="View details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
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
              {/* Upcoming Hearings */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FEF3C7" }}><Calendar className="w-4 h-4 text-amber-600" /></div>
                  <p className="text-sm font-bold text-gray-900">Upcoming Hearings</p>
                </div>
                <div className="space-y-2">
                  {clientCases.filter((c) => c.hearing_date).slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: "#FEF3C7" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                        <Bell className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800 truncate">{c.title}</p>
                        <p className="text-[11px] text-gray-500">{c.court_name || "District Court"}</p>
                        <p className="text-[11px] text-amber-700 font-medium">{new Date(c.hearing_date).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                  {clientCases.filter((c) => c.hearing_date).length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-2">No upcoming hearings</p>
                  )}
                </div>
              </div>

              {/* My Lawyers */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#ECFDF5" }}><User className="w-4 h-4 text-emerald-600" /></div>
                  <p className="text-sm font-bold text-gray-900">My Lawyers</p>
                </div>
                <div className="space-y-2">
                  {clientCases.filter((c, i, arr) => arr.findIndex((x) => x.lawyer_id === c.lawyer_id) === i).map((c) => (
                    <div key={c.lawyer_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#1a2744" }}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-gray-800 truncate">{c.lawyer_name || "Advocate"}</p>
                        <p className="text-[10px] text-gray-400">{c.case_type}</p>
                      </div>
                      {c.lawyer_phone && (
                        <a href={`tel:${c.lawyer_phone}`} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                        </a>
                      )}
                    </div>
                  ))}
                  {clientCases.length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-2">No lawyers yet</p>
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

      {/* Case Detail Modal */}
      <Modal open={!!showCaseDetail} onClose={() => { setShowCaseDetail(null); setCaseDocs([]); }} title={showCaseDetail?.title || "Case Details"}>
        {showCaseDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Case Type</p>
                <p className="text-sm font-bold text-gray-900">{showCaseDetail.case_type}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Court</p>
                <p className="text-sm font-bold text-gray-900">{showCaseDetail.court_name || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">CNR Number</p>
                <p className="text-sm font-bold text-gray-900">{showCaseDetail.cnr_number || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hearing Date</p>
                <p className="text-sm font-bold text-gray-900">{showCaseDetail.hearing_date ? new Date(showCaseDetail.hearing_date).toLocaleDateString("en-IN") : "N/A"}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-700 mb-1">Case Stage</p>
              <CaseStageTimeline stage={showCaseDetail.case_stage} />
            </div>
            {showCaseDetail.description && (
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <p className="text-[11px] font-semibold text-gray-700 mb-1">Description</p>
                <p className="text-[12px] text-gray-600">{showCaseDetail.description}</p>
              </div>
            )}

            {/* ── Documents Panel ── */}
            <div className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-700">Case Documents</p>
                <label className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md text-white cursor-pointer transition-colors" style={{ background: "#2563EB" }}>
                  <Upload className="w-3 h-3" />
                  {docUploading ? "Uploading..." : "Upload"}
                  <input type="file" className="hidden" disabled={docUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !showCaseDetail) return;
                      setDocUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const token = typeof window !== "undefined" ? localStorage.getItem("lf_token") : null;
                        const res = await fetch(`/litigaforge/client/cases/${showCaseDetail.id}/documents`, {
                          method: "POST",
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: form,
                        });
                        if (!res.ok) throw new Error("Upload failed");
                        const data = await res.json();
                        setCaseDocs(prev => [data.document, ...prev]);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Upload failed");
                      } finally {
                        setDocUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {caseDocs.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-2">No documents yet. Upload case files here.</p>
              ) : (
                <div className="space-y-1.5">
                  {caseDocs.map((doc: any) => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg p-2.5" style={{ background: "#FFFFFF", border: "1px solid #F1F5F9" }}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-gray-900 truncate">{doc.filename}</p>
                          <p className="text-[10px] text-gray-400">{doc.file_type} · {doc.file_size ? (doc.file_size / 1024).toFixed(1) + " KB" : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={doc.file_url} download={doc.filename}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => {
                          const text = `Case Document: ${doc.filename}\nCase: ${showCaseDetail.title}\n\nDownload: ${typeof window !== "undefined" ? window.location.origin : ""}${doc.file_url}\n\n— LitigaForge AI`;
                          if (navigator.share) navigator.share({ title: doc.filename, text });
                          else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Share">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${doc.filename}"?`)) return;
                          try {
                            await apiFetch(`/client/documents/${doc.id}`, { method: "DELETE" });
                            setCaseDocs(prev => prev.filter(d => d.id !== doc.id));
                          } catch { alert("Failed to delete"); }
                        }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit / Share / Download / Contact */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setShowEditCase(showCaseDetail); setEditDesc(showCaseDetail.description || ""); setEditHearing(showCaseDetail.hearing_date || ""); setShowCaseDetail(null); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                <PenSquare className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\nCNR: ${showCaseDetail.cnr_number || "N/A"}\nHearing: ${showCaseDetail.hearing_date || "N/A"}\nStage: ${showCaseDetail.case_stage || "N/A"}\n\n— LitigaForge AI`;
                  if (navigator.share) {
                    navigator.share({ title: showCaseDetail.title, text });
                  } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                onClick={() => {
                  const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\nCNR: ${showCaseDetail.cnr_number || "N/A"}\nHearing: ${showCaseDetail.hearing_date || "N/A"}\nStage: ${showCaseDetail.case_stage || "N/A"}\nDescription: ${showCaseDetail.description || "N/A"}\n\n— LitigaForge AI`;
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `case-${showCaseDetail.id}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {showCaseDetail.lawyer_phone && (
                <a href={`tel:${showCaseDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg text-white transition-colors" style={{ background: "#059669" }}>
                  <Phone className="w-3.5 h-3.5" /> Call Lawyer
                </a>
              )}
              {showCaseDetail.lawyer_email && (
                <a href={`mailto:${showCaseDetail.lawyer_email}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                  <Send className="w-3.5 h-3.5" /> Email Lawyer
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Case Modal */}
      <Modal open={!!showEditCase} onClose={() => setShowEditCase(null)} title={`Edit: ${showEditCase?.title || ""}`}>
        {showEditCase && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} placeholder="Update case description..."
                className="w-full text-sm px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none" style={{ borderColor: "#E2E8F0" }} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Next Hearing Date</label>
              <input type="date" value={editHearing} onChange={(e) => setEditHearing(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" style={{ borderColor: "#E2E8F0" }} />
            </div>
            <button
              onClick={() => {
                apiFetch(`/client/cases/${showEditCase.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ description: editDesc, hearing_date: editHearing }),
                }).then(() => {
                  qc.invalidateQueries({ queryKey: ["client-cases"] });
                  setShowEditCase(null);
                });
              }}
              className="w-full text-xs font-bold py-2.5 rounded-lg text-white transition-colors" style={{ background: "#2563EB" }}>
              Save Changes
            </button>
          </div>
        )}
      </Modal>

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
