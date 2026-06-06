import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, FileText, User, MessageSquare,
  Gavel, Plus, ChevronRight, X, Phone,
  Star, Loader2, Sparkles, Send, Bell, Shield, Award, ArrowRight,
  Scale, Calendar, FileCheck, Heart, FileSearch, Building2, Hash,
  PenSquare, Download, Share2, Search, Upload, Trash2, Lock,
} from "lucide-react";
import { PaymentModal } from "@/components/PaymentModal";

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

// ── Modal ────────────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto border border-border"
        >
        <div className="sticky top-0 bg-card z-10 px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
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
            {i < CASE_STAGES.length - 1 && <div className={`w-3 h-px ${done ? "bg-emerald-300" : "bg-muted"}`} />}
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
  const [matchTab, setMatchTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [payingMatch, setPayingMatch] = useState<MatchProposal | null>(null);
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
    <>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
          {/* Page greeting */}
          <div className="rounded-2xl px-5 py-4 border border-amber-100 bg-gradient-to-r from-white to-amber-50/60 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Good day, {firstName} 👋</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {clientCases.length} case{clientCases.length !== 1 ? "s" : ""} assigned · {acceptedMatches} lawyer{acceptedMatches !== 1 ? "s" : ""} connected
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
              <Shield className="w-3.5 h-3.5" /> LitigaForge AI
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={a.action}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card shadow-sm text-left transition-all hover:shadow-md active:scale-95">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                    <Icon className="w-4 h-4" style={{ color: a.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{a.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — Cases & Matches */}
            <div className="lg:col-span-2 space-y-6">
              {/* Client Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Active Cases", value: activeCases, icon: Briefcase, color: "#2563EB", bg: "#EFF6FF", accent: "#2563EB" },
                  { label: "Hearings", value: upcomingHearings, icon: Calendar, color: "#D97706", bg: "#FEF3C7", accent: "#D97706" },
                  { label: "My Lawyers", value: connectedLawyers, icon: User, color: "#059669", bg: "#ECFDF5", accent: "#059669" },
                  { label: "Posted", value: activeReqs, icon: FileText, color: "#7C3AED", bg: "#F5F3FF", accent: "#7C3AED" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-card rounded-xl p-4 shadow-sm border border-border overflow-hidden relative group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: s.accent }} />
                      <div className="flex items-start justify-between mb-2 pt-1">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                          <Icon className="w-4 h-4" style={{ color: s.color }} />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-foreground leading-none">{s.value}</p>
                      <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* My Assigned Cases — Lawyer Dashboard Style */}
              <div className="bg-card rounded-2xl shadow-sm border border-border" >
                {/* Header with search + tabs */}
                <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50" ><FileCheck className="w-4 h-4 text-blue-600" /></div>
                    <h2 className="font-bold text-foreground text-sm">My Assigned Cases</h2>
                    <span className="text-[11px] text-muted-foreground ml-1">({clientCases.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      {(["active","pending","closed"] as const).map((t) => (
                        <button key={t} onClick={() => setCaseTab(t)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${caseTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Search bar */}
                <div className="px-5 py-3 border-b">
                  <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search cases by title, court, or CNR..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-muted-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Case list */}
                <div className="p-4 space-y-2.5">
                  {casesLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}
                  {!casesLoading && clientCases.length === 0 && (
                    <div className="rounded-xl p-6 text-center bg-muted/40 border border-dashed border-border" >
                      <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No cases assigned yet.</p>
                      <button onClick={() => setLocation("/post-case")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">Post a case to get matched →</button>
                    </div>
                  )}
                  {!casesLoading && clientCases.length > 0 && (() => {
                    const filtered = clientCases
                      .filter((c) => c.status === caseTab)
                      .filter((c) => !searchQuery || [c.title, c.court_name, c.cnr_number, c.case_type].some((f) => f?.toLowerCase().includes(searchQuery.toLowerCase())));
                    if (filtered.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-6">No {caseTab} cases{searchQuery ? " matching your search" : ""}.</p>;
                    }
                    return filtered.map((c) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 hover:shadow-md transition-all bg-card border border-border"
                        style={{ borderLeftColor: c.status === "active" ? "#10b981" : c.status === "pending" ? "#f59e0b" : "#94a3b8", borderLeftWidth: "3px" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50" >
                              <Briefcase className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground text-sm">{c.title}</span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100" >{c.case_type}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : c.status === "pending" ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-muted text-muted-foreground border border-border"}`}>{c.status.toUpperCase()}</span>
                              </div>
                              <CaseStageTimeline stage={c.case_stage} />
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
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
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
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
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
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
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              title="Download case"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setShowCaseDetail(c)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
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
              <div className="bg-card rounded-2xl shadow-sm border border-border" >
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50" ><Sparkles className="w-4 h-4 text-violet-600" /></div>
                    <h2 className="font-bold text-foreground text-sm">Match Proposals</h2>
                  </div>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                    {(["pending","accepted","declined"] as const).map((t) => (
                      <button key={t} onClick={() => setMatchTab(t)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${matchTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {matchLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}
                  {!matchLoading && filteredMatches.length === 0 && (
                    <div className="rounded-xl p-6 text-center bg-muted/40 border border-dashed border-border" >
                      <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No {matchTab} proposals.</p>
                      {matchTab === "pending" && (
                        <button onClick={() => setLocation("/my-cases")} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">Check your cases →</button>
                      )}
                    </div>
                  )}
                  {filteredMatches.map((m) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl p-4 bg-card border border-border hover:shadow-md transition-all"
                      style={{ borderLeftColor: m.match_score >= 80 ? "#059669" : m.match_score >= 60 ? "#D97706" : "#EF4444", borderLeftWidth: "3px" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary" >
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{m.lawyer_name}</span>
                            {m.rating > 0 && (
                              <span className="text-[11px] flex items-center gap-0.5 text-amber-600"><Star className="w-3 h-3 fill-amber-400" />{m.rating}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{m.district} · {m.experience_years} yrs · ₹{m.hourly_rate}/hr</p>
                          {/* Score bar */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted">
                              <div className="h-full rounded-full transition-all" style={{ width: `${m.match_score}%`, background: m.match_score >= 80 ? "#059669" : m.match_score >= 60 ? "#D97706" : "#EF4444" }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums" style={{ color: m.match_score >= 80 ? "#059669" : m.match_score >= 60 ? "#D97706" : "#EF4444" }}>{m.match_score}% match</span>
                          </div>
                          {m.ai_explanation && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{m.ai_explanation}</p>
                          )}
                          {m.client_message && (
                            <div className="mt-2 rounded-lg p-2.5 text-[11px] text-muted-foreground bg-muted" >
                              <span className="font-semibold text-foreground">Lawyer says:</span> {m.client_message}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            {m.status === "pending" && (
                              <>
                                <button onClick={() => setPayingMatch(m)}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-colors bg-emerald-600 flex items-center gap-1"
                                  >
                                  <Lock className="w-3 h-3" /> Accept & Pay Fee
                                </button>
                                <button onClick={() => declineMut.mutate(m.id)}
                                  disabled={declineMut.isPending}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                                  {declineMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Decline"}
                                </button>
                              </>
                            )}
                            {m.status === "accepted" && (
                              <button onClick={() => setShowMessageModal({ matchId: m.id, lawyerName: m.lawyer_name })}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 transition-colors bg-blue-600"
                                >
                                <MessageSquare className="w-3 h-3" /> Message
                              </button>
                            )}
                            <button onClick={() => setShowMatchDetail(m)}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors ml-auto">View Profile →</button>
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
              <div className="bg-card rounded-2xl shadow-sm p-4 border border-border" >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50" ><Calendar className="w-4 h-4 text-amber-600" /></div>
                  <p className="text-sm font-bold text-foreground">Upcoming Hearings</p>
                </div>
                <div className="space-y-2">
                  {clientCases.filter((c) => c.hearing_date).slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50" >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                        <Bell className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground">{c.court_name || "District Court"}</p>
                        <p className="text-[11px] text-amber-700 font-medium">{new Date(c.hearing_date).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                  {clientCases.filter((c) => c.hearing_date).length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-2">No upcoming hearings</p>
                  )}
                </div>
              </div>

              {/* My Lawyers */}
              <div className="bg-card rounded-2xl shadow-sm p-4 border border-border" >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50" ><User className="w-4 h-4 text-emerald-600" /></div>
                  <p className="text-sm font-bold text-foreground">My Lawyers</p>
                </div>
                <div className="space-y-2">
                  {clientCases.filter((c, i, arr) => arr.findIndex((x) => x.lawyer_id === c.lawyer_id) === i).map((c) => (
                    <div key={c.lawyer_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary" >
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{c.lawyer_name || "Advocate"}</p>
                        <p className="text-[10px] text-muted-foreground">{c.case_type}</p>
                      </div>
                      {c.lawyer_phone && (
                        <a href={`tel:${c.lawyer_phone}`} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                  {clientCases.length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-2">No lawyers yet</p>
                  )}
                </div>
              </div>

              {/* Legal Tools */}
              <div className="bg-card rounded-2xl shadow-sm p-4 border border-border" >
                <p className="text-sm font-bold text-foreground mb-3">Legal Tools</p>
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-blue-700 hover:bg-blue-50 transition-colors text-[12px] font-medium text-left">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.label} <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/40" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NALSA */}
              <a href="tel:15100" className="rounded-xl p-3 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800">NALSA Free Legal Aid</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Toll-free: 15100 — Tap to call</p>
                </div>
              </a>

              {/* Upgrade banner */}
              {user?.subscription_tier === "free" && (
                <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-[#1a2744] to-[#0f1a35] border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <p className="font-bold text-sm">Upgrade to Professional</p>
                  </div>
                  <p className="text-[11px] mb-3 leading-relaxed text-blue-200">Priority lawyer matching, unlimited AI credits, WhatsApp alerts.</p>
                  <button onClick={() => setLocation("/subscription")} className="w-full text-xs font-bold py-2.5 rounded-lg transition-colors bg-amber-400 hover:bg-amber-300 text-[#1a2744]">Upgrade — ₹999/mo</button>
                </div>
              )}
            </aside>
          </div>
        </div>

      {/* Case Detail Modal */}
      <Modal open={!!showCaseDetail} onClose={() => { setShowCaseDetail(null); setCaseDocs([]); }} title={showCaseDetail?.title || "Case Details"}>
        {showCaseDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Case Type</p>
                <p className="text-sm font-bold text-foreground">{showCaseDetail.case_type}</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Court</p>
                <p className="text-sm font-bold text-foreground">{showCaseDetail.court_name || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CNR Number</p>
                <p className="text-sm font-bold text-foreground">{showCaseDetail.cnr_number || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hearing Date</p>
                <p className="text-sm font-bold text-foreground">{showCaseDetail.hearing_date ? new Date(showCaseDetail.hearing_date).toLocaleDateString("en-IN") : "N/A"}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1">Case Stage</p>
              <CaseStageTimeline stage={showCaseDetail.case_stage} />
            </div>
            {showCaseDetail.description && (
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[11px] font-semibold text-foreground mb-1">Description</p>
                <p className="text-[12px] text-muted-foreground">{showCaseDetail.description}</p>
              </div>
            )}

            {/* ── Documents Panel ── */}
            <div className="rounded-xl p-3 bg-muted/40 border border-border" >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-foreground">Case Documents</p>
                <label className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md text-white cursor-pointer transition-colors bg-blue-600" >
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
                <p className="text-[11px] text-muted-foreground text-center py-2">No documents yet. Upload case files here.</p>
              ) : (
                <div className="space-y-1.5">
                  {caseDocs.map((doc: any) => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg p-2.5 bg-card border border-border">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-50" >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{doc.filename}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.file_type} · {doc.file_size ? (doc.file_size / 1024).toFixed(1) + " KB" : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={doc.file_url} download={doc.filename}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => {
                          const text = `Case Document: ${doc.filename}\nCase: ${showCaseDetail.title}\n\nDownload: ${typeof window !== "undefined" ? window.location.origin : ""}${doc.file_url}\n\n— LitigaForge AI`;
                          if (navigator.share) navigator.share({ title: doc.filename, text });
                          else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Share">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${doc.filename}"?`)) return;
                          try {
                            await apiFetch(`/client/documents/${doc.id}`, { method: "DELETE" });
                            setCaseDocs(prev => prev.filter(d => d.id !== doc.id));
                          } catch { alert("Failed to delete"); }
                        }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
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
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
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
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
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
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {showCaseDetail.lawyer_phone && (
                <a href={`tel:${showCaseDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg text-white transition-colors bg-emerald-600" >
                  <Phone className="w-3.5 h-3.5" /> Call Lawyer
                </a>
              )}
              {showCaseDetail.lawyer_email && (
                <a href={`mailto:${showCaseDetail.lawyer_email}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
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
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} placeholder="Update case description..."
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Next Hearing Date</label>
              <input type="date" value={editHearing} onChange={(e) => setEditHearing(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
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
              className="w-full text-xs font-bold py-2.5 rounded-lg text-white transition-colors bg-blue-600" >
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
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary" >
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-foreground">{showMatchDetail.lawyer_name}</p>
                <p className="text-[11px] text-muted-foreground">{showMatchDetail.district} · Bar: {showMatchDetail.bar_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Experience</p>
                <p className="text-sm font-bold text-foreground">{showMatchDetail.experience_years} years</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hourly Rate</p>
                <p className="text-sm font-bold text-foreground">₹{showMatchDetail.hourly_rate}</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rating</p>
                <p className="text-sm font-bold text-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{showMatchDetail.rating || "N/A"}</p>
              </div>
              <div className="rounded-lg p-3 bg-muted/40 border border-border" >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Match Score</p>
                <p className="text-sm font-bold" style={{ color: showMatchDetail.match_score >= 80 ? "#059669" : showMatchDetail.match_score >= 60 ? "#D97706" : "#EF4444" }}>{showMatchDetail.match_score}/100</p>
              </div>
            </div>
            {showMatchDetail.ai_explanation && (
              <div className="rounded-lg p-3" style={{ background: "#F0F9FF", border: "1px solid #DBEAFE" }}>
                <p className="text-[11px] font-semibold text-blue-700 mb-1">AI Match Explanation</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{showMatchDetail.ai_explanation}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {showMatchDetail.lawyer_phone && (
                <a href={`tel:${showMatchDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg text-white transition-colors bg-emerald-600" >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
              {showMatchDetail.lawyer_email && (
                <a href={`mailto:${showMatchDetail.lawyer_email}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
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
          <p className="text-[12px] text-muted-foreground">Send a message to this lawyer. A chat thread will be created automatically.</p>
          <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4} placeholder="Type your message..."
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary transition-colors resize-none" />
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
            className="w-full text-xs font-bold py-2.5 rounded-lg text-white disabled:opacity-50 transition-colors bg-blue-600"
            >
            {sendMsgMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Message"}
          </button>
        </div>
      </Modal>

      {payingMatch && (
        <PaymentModal
          matchId={payingMatch.id}
          lawyerName={payingMatch.lawyer_name}
          caseTitle={(payingMatch as any).case_title ?? "Your Case"}
          budgetRange={(payingMatch as any).budget_range}
          onClose={() => setPayingMatch(null)}
          onSuccess={() => {
            setPayingMatch(null);
            setMatchTab("accepted");
            qc.invalidateQueries({ queryKey: ["client-matches"] });
          }}
        />
      )}
    </>
  );
}
