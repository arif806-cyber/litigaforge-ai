import { useState, useEffect } from "react";
import { useCountry } from "../hooks/useCountry";
import { useLanguage } from "../hooks/useLanguage";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Briefcase, FileText, User, MessageSquare,
  Gavel, Plus, ChevronRight, X, Phone,
  Star, Loader2, Sparkles, Send, Bell, Shield, Award, ArrowRight,
  Scale, Calendar, FileCheck, Heart, FileSearch, Building2, Hash,
  PenSquare, Download, Share2, Search, Upload, Trash2, Lock,
} from "lucide-react";
import { PaymentModal } from "@/components/PaymentModal";

interface MyRequirement {
  id: number; title: string; case_type: string; description: string;
  location: string; budget_range: string; is_anonymous: boolean; status: string; created_at: string;
}
interface MatchProposal {
  id: number; case_requirement_id: number; lawyer_id: number; lawyer_name: string;
  lawyer_email: string; lawyer_phone: string; bar_number: string; district: string;
  experience_years: number; rating: number; hourly_rate: number; match_score: number;
  ai_explanation: string; client_message: string; status: string; created_at: string;
}
interface ClientCase {
  id: number; lawyer_id: number; lawyer_name: string; lawyer_email: string; lawyer_phone: string;
  title: string; case_type: string; description: string; court_name: string; cnr_number: string;
  hearing_date: string; case_stage: string; status: string; created_at: string;
}
interface CaseDoc {
  id: number; filename: string; file_type: string; file_url: string; ai_summary: string; created_at: string;
}
interface ChatThread {
  id: number; match_id: number; title: string; created_at: string;
}

const CASE_STAGES = ["filed", "admitted", "evidence", "arguments", "reserved", "judgment"] as const;
function stageIndex(stage: string) { return Math.max(0, CASE_STAGES.indexOf(stage as any)); }
function stageLabel(stage: string) {
  const labels: Record<string, string> = { filed: "Filed", admitted: "Admitted", evidence: "Evidence", arguments: "Arguments", reserved: "Reserved", judgment: "Judgment" };
  return labels[stage] || stage;
}

/* ── Modal ─────────────────────────────────────────────────── */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto border border-border">
        <div className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

/* ── Case Stage Timeline ────────────────────────────────────── */
function CaseStageTimeline({ stage }: { stage: string }) {
  const idx = stageIndex(stage);
  return (
    <div className="flex items-center gap-1 mt-2">
      {CASE_STAGES.map((s, i) => {
        const done = i <= idx;
        const isCurrent = i === idx;
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${done ? "bg-emerald-500" : "bg-muted"}`} />
            {isCurrent && <span className="text-[10px] font-semibold text-emerald-500 ml-0.5">{stageLabel(s)}</span>}
            {i < CASE_STAGES.length - 1 && <div className={`w-3 h-px ${done ? "bg-emerald-500/40" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, colorClass, accentColor }: {
  label: string; value: number; icon: React.ElementType; colorClass: string; accentColor: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden relative flex-1 min-w-0">
      <div className="h-[3px] w-full" style={{ background: accentColor }} />
      <div className="p-4 pt-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[12px] font-medium text-muted-foreground mt-1.5 leading-snug">{label}</p>
      </div>
    </div>
  );
}

/* ── Section Card wrapper ───────────────────────────────────── */
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border shadow-sm overflow-hidden ${className}`}>
      {children}
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

  useEffect(() => {
    if (!showCaseDetail) { setCaseDocs([]); return; }
    apiFetch(`/client/cases/${showCaseDetail.id}/documents`)
      .then((res: any) => setCaseDocs(res.documents || []))
      .catch(() => setCaseDocs([]));
  }, [showCaseDetail?.id]);

  const { data: clientCasesData, isLoading: casesLoading } = useQuery({
    queryKey: ["client-cases"],
    queryFn: () => apiFetch("/client/cases"),
    enabled: !!user,
  });
  const clientCases: ClientCase[] = clientCasesData?.cases || [];

  const { data: requirementsData } = useQuery({
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
  const activeCases = clientCases.filter((c) => c.status === "active").length;
  const upcomingHearings = clientCases.filter((c) => c.hearing_date && new Date(c.hearing_date) >= new Date()).length;
  const connectedLawyers = [...new Set(clientCases.map((c) => c.lawyer_id))].length;

  const firstName = user?.name?.split(" ")[0] ?? "Client";
  const { activeConfig, activeCode, loading: countryLoading } = useCountry();
  const { t, lang } = useLanguage();

  const quickActions = [
    { label: t.post_case,    icon: Plus,       iconClass: "text-blue-400",   bgClass: "bg-blue-500/10",   action: () => setLocation("/post-case") },
    { label: t.doc_analyzer, icon: FileSearch, iconClass: "text-violet-400", bgClass: "bg-violet-500/10", action: () => setLocation("/review") },
    { label: t.legal_qa,     icon: Gavel,      iconClass: "text-amber-400",  bgClass: "bg-amber-500/10",  action: () => setLocation("/ask") },
    { label: t.free_aid,     icon: Heart,      iconClass: "text-rose-400",   bgClass: "bg-rose-500/10",   action: () => setLocation("/legal-aid") },
  ];

  return (
    <>
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

        {/* ── Greeting Banner ─────────────────────────────────── */}
        <div className="rounded-2xl px-5 py-5 border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.good_day}, {firstName} 👋</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {clientCases.length} {t.cases_assigned}
              {acceptedMatches > 0 && ` · ${acceptedMatches} ${t.my_lawyers.toLowerCase()}`}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Shield className="w-3.5 h-3.5" /> LitigaForge AI
          </div>
        </div>

        {/* ── Country-specific Banner ───────────────────────────── */}
        {!countryLoading && activeConfig && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 mb-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{activeConfig.flag}</span>
              <div>
                <h2 className="text-white font-bold text-lg">Legal Help in {activeConfig.name}</h2>
                <p className="text-gray-400 text-sm">
                  {activeConfig.legal_system} · {activeConfig.currency} {activeConfig.currency_symbol}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Top Legal Services</p>
              <div className="flex flex-wrap gap-2">
                {activeConfig.top_services?.map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Courts &amp; Tribunals</p>
              <div className="flex flex-wrap gap-2">
                {activeConfig.courts?.slice(0, 3).map((c: string) => (
                  <span key={c} className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
              <p className="text-green-400 text-sm font-medium">📞 Emergency Legal Aid</p>
              <p className="text-gray-300 text-sm">{activeConfig.emergency_legal}</p>
            </div>
          </div>
        )}

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={a.action}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card shadow-sm text-left transition-all hover:border-primary/30 hover:shadow-md active:scale-95">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bgClass}`}>
                  <Icon className={`w-4 h-4 ${a.iconClass}`} />
                </div>
                <span className="text-[13px] font-semibold text-foreground leading-snug">{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Stat Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label={t.active_cases}  value={activeCases}        icon={Briefcase} colorClass="bg-blue-500/10 text-blue-400"    accentColor="#3b82f6" />
          <StatCard label={t.hearings}      value={upcomingHearings}   icon={Calendar}  colorClass="bg-amber-500/10 text-amber-400"  accentColor="#f59e0b" />
          <StatCard label={t.my_lawyers}    value={connectedLawyers}   icon={User}      colorClass="bg-emerald-500/10 text-emerald-400" accentColor="#10b981" />
          <StatCard label={t.posted}        value={activeReqs}         icon={FileText}  colorClass="bg-violet-500/10 text-violet-400" accentColor="#8b5cf6" />
        </div>

        {/* ── Main content grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left — Cases & Matches */}
          <div className="lg:col-span-2 space-y-5">

            {/* My Assigned Cases */}
            <SectionCard>
              <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
                    <FileCheck className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-[15px]">{t.my_assigned_cases}</h2>
                    <p className="text-[11px] text-muted-foreground">{clientCases.length} total</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {(["active", "pending", "closed"] as const).map((tab) => (
                    <button key={tab} onClick={() => setCaseTab(tab)}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-md capitalize transition-all ${caseTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input type="text" placeholder={t.search_cases}
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {casesLoading && <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}
                {!casesLoading && clientCases.length === 0 && (
                  <div className="rounded-xl p-8 text-center bg-muted/30 border border-dashed border-border">
                    <Briefcase className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">{t.no_cases_yet}</p>
                    <button onClick={() => setLocation("/post-case")} className="mt-3 text-xs font-semibold text-primary hover:underline">
                      {t.post_case_prompt} →
                    </button>
                  </div>
                )}
                {!casesLoading && clientCases.length > 0 && (() => {
                  const filtered = clientCases
                    .filter((c) => c.status === caseTab)
                    .filter((c) => !searchQuery || [c.title, c.court_name, c.cnr_number, c.case_type].some((f) => f?.toLowerCase().includes(searchQuery.toLowerCase())));
                  if (filtered.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-8">No {caseTab} cases{searchQuery ? " matching your search" : ""}.</p>;
                  }
                  return filtered.map((c) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl p-4 bg-muted/30 border border-border hover:border-primary/20 hover:bg-muted/50 transition-all"
                      style={{ borderLeftColor: c.status === "active" ? "#10b981" : c.status === "pending" ? "#f59e0b" : "#64748b", borderLeftWidth: "3px" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/10">
                            <Briefcase className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-sm">{c.title}</span>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{c.case_type}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                c.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                                c.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                                "bg-muted text-muted-foreground"}`}>
                                {c.status.toUpperCase()}
                              </span>
                            </div>
                            <CaseStageTimeline stage={c.case_stage} />
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                              {c.court_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.court_name}</span>}
                              {c.cnr_number && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{c.cnr_number}</span>}
                              {c.hearing_date && <span className="flex items-center gap-1 text-amber-400 font-medium"><Calendar className="w-3 h-3" />{new Date(c.hearing_date).toLocaleDateString(lang === "ar" ? "ar-AE" : lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : lang === "de" ? "de-DE" : lang === "fr" ? "fr-CA" : lang === "es" ? "es-US" : "en-IN")}</span>}
                              <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.lawyer_name || "Advocate"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => { setShowEditCase(c); setEditDesc(c.description || ""); setEditHearing(c.hearing_date || ""); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                            <PenSquare className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => {
                            const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\nCNR: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                            if (navigator.share) navigator.share({ title: c.title, text });
                            else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                          }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Share">
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => {
                            const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\nCNR: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nStage: ${c.case_stage || "N/A"}\nDescription: ${c.description || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                            const blob = new Blob([text], { type: "text/plain" });
                            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `case-${c.id}.txt`; a.click();
                          }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 transition-colors" title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setShowCaseDetail(c)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="View">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>
            </SectionCard>

            {/* Match Proposals */}
            <SectionCard>
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-[15px]">{t.match_proposals}</h2>
                    <p className="text-[11px] text-muted-foreground">{allMatches.length} total proposals</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {(["pending", "accepted", "declined"] as const).map((tab) => (
                    <button key={tab} onClick={() => setMatchTab(tab)}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md capitalize transition-all ${matchTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {matchLoading && <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}
                {!matchLoading && filteredMatches.length === 0 && (
                  <div className="rounded-xl p-8 text-center bg-muted/30 border border-dashed border-border">
                    <Sparkles className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No {matchTab} proposals</p>
                    {matchTab === "pending" && (
                      <button onClick={() => setLocation("/my-cases")} className="mt-3 text-xs font-semibold text-primary hover:underline">Check your cases →</button>
                    )}
                  </div>
                )}
                {filteredMatches.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-4 bg-muted/30 border border-border hover:border-primary/20 transition-all"
                    style={{ borderLeftColor: m.match_score >= 80 ? "#10b981" : m.match_score >= 60 ? "#f59e0b" : "#ef4444", borderLeftWidth: "3px" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm">{m.lawyer_name}</span>
                          {m.rating > 0 && (
                            <span className="text-[11px] flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-amber-400" />{m.rating}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{m.district} · {m.experience_years} yrs · ₹{m.hourly_rate}/hr</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${m.match_score}%`,
                              background: m.match_score >= 80 ? "#10b981" : m.match_score >= 60 ? "#f59e0b" : "#ef4444"
                            }} />
                          </div>
                          <span className="text-[11px] font-bold tabular-nums" style={{
                            color: m.match_score >= 80 ? "#10b981" : m.match_score >= 60 ? "#f59e0b" : "#ef4444"
                          }}>{m.match_score}% match</span>
                        </div>
                        {m.ai_explanation && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{m.ai_explanation}</p>
                        )}
                        {m.client_message && (
                          <div className="mt-2 rounded-lg p-2.5 text-[11px] text-muted-foreground bg-muted">
                            <span className="font-semibold text-foreground">Lawyer says:</span> {m.client_message}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {m.status === "pending" && (
                            <>
                              <button onClick={() => setPayingMatch(m)}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Accept & Pay Fee
                              </button>
                              <button onClick={() => declineMut.mutate(m.id)} disabled={declineMut.isPending}
                                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                                {declineMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Decline"}
                              </button>
                            </>
                          )}
                          {m.status === "accepted" && (
                            <button onClick={() => setShowMessageModal({ matchId: m.id, lawyerName: m.lawyer_name })}
                              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-colors">
                              <MessageSquare className="w-3 h-3" /> Message
                            </button>
                          )}
                          <button onClick={() => setShowMatchDetail(m)} className="text-[11px] font-medium text-primary hover:underline transition-colors ml-auto">
                            View Profile →
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Right sidebar — hidden on mobile, visible lg+ */}
          <aside className="hidden lg:block space-y-4">

            {/* Upcoming Hearings */}
            <SectionCard>
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10">
                  <Calendar className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">Upcoming Hearings</p>
              </div>
              <div className="p-3 space-y-2">
                {clientCases.filter((c) => c.hearing_date).slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{c.court_name || "District Court"}</p>
                      <p className="text-[11px] text-amber-400 font-medium">{new Date(c.hearing_date).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                ))}
                {clientCases.filter((c) => c.hearing_date).length === 0 && (
                  <p className="text-[12px] text-muted-foreground text-center py-3">No upcoming hearings</p>
                )}
              </div>
            </SectionCard>

            {/* My Lawyers */}
            <SectionCard>
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">My Lawyers</p>
              </div>
              <div className="p-3 space-y-1.5">
                {clientCases.filter((c, i, arr) => arr.findIndex((x) => x.lawyer_id === c.lawyer_id) === i).map((c) => (
                  <div key={c.lawyer_id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{c.lawyer_name || "Advocate"}</p>
                      <p className="text-[10px] text-muted-foreground">{c.case_type}</p>
                    </div>
                    {c.lawyer_phone && (
                      <a href={`tel:${c.lawyer_phone}`} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                ))}
                {clientCases.length === 0 && <p className="text-[12px] text-muted-foreground text-center py-3">No lawyers yet</p>}
              </div>
            </SectionCard>

            {/* Legal Tools */}
            <SectionCard>
              <div className="px-4 py-3.5 border-b border-border">
                <p className="text-[14px] font-semibold text-foreground">Legal Tools</p>
              </div>
              <div className="p-2">
                {[
                  { label: "Document Analyzer", icon: FileText, href: "/review" },
                  { label: "Judgment Finder",   icon: Scale,    href: "/judgments" },
                  { label: "Legal Q&A",         icon: Gavel,    href: "/ask" },
                  { label: "Free Legal Aid",    icon: Shield,   href: "/legal-aid" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.label} onClick={() => setLocation(item.href)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-[12px] font-medium text-left">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.label}
                      <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* NALSA helpline */}
            <a href="tel:15100"
              className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-emerald-300">NALSA Free Legal Aid</p>
                <p className="text-[11px] text-emerald-400/80">Toll-free: 15100 — Tap to call</p>
              </div>
            </a>

            {/* Upgrade banner */}
            {user?.subscription_tier === "free" && (
              <div className="rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-[#1e2a4a] to-[#111827]">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <p className="font-bold text-sm text-white">Upgrade to Professional</p>
                </div>
                <p className="text-[11px] mb-3 leading-relaxed text-blue-300/80">Priority matching, unlimited AI credits, WhatsApp alerts.</p>
                <button onClick={() => setLocation("/subscription")}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#111827] transition-colors">
                  Upgrade — ₹999/mo
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Case Detail Modal ─────────────────────────────────── */}
      <Modal open={!!showCaseDetail} onClose={() => { setShowCaseDetail(null); setCaseDocs([]); }} title={showCaseDetail?.title || "Case Details"}>
        {showCaseDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Case Type", value: showCaseDetail.case_type },
                { label: "Court",     value: showCaseDetail.court_name || "N/A" },
                { label: "CNR",       value: showCaseDetail.cnr_number || "N/A" },
                { label: "Hearing",   value: showCaseDetail.hearing_date ? new Date(showCaseDetail.hearing_date).toLocaleDateString("en-IN") : "N/A" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3 bg-muted/40 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1">Case Stage</p>
              <CaseStageTimeline stage={showCaseDetail.case_stage} />
            </div>
            {showCaseDetail.description && (
              <div className="rounded-xl p-3 bg-muted/40 border border-border">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">Description</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{showCaseDetail.description}</p>
              </div>
            )}

            {/* Documents */}
            <div className="rounded-xl p-3 bg-muted/40 border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-foreground">Case Documents</p>
                <label className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors">
                  <Upload className="w-3 h-3" />
                  {docUploading ? "Uploading…" : "Upload"}
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
                <p className="text-[11px] text-muted-foreground text-center py-3">No documents yet. Upload case files here.</p>
              ) : (
                <div className="space-y-1.5">
                  {caseDocs.map((doc: any) => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-xl p-2.5 bg-card border border-border">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-500/10">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{doc.filename}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.file_type} · {doc.file_size ? (doc.file_size / 1024).toFixed(1) + " KB" : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a href={doc.file_url} download={doc.filename} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => {
                          const text = `Case Document: ${doc.filename}\nCase: ${showCaseDetail.title}\n\nDownload: ${typeof window !== "undefined" ? window.location.origin : ""}${doc.file_url}\n\n— LitigaForge AI`;
                          if (navigator.share) navigator.share({ title: doc.filename, text });
                          else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${doc.filename}"?`)) return;
                          try {
                            await apiFetch(`/client/documents/${doc.id}`, { method: "DELETE" });
                            setCaseDocs(prev => prev.filter(d => d.id !== doc.id));
                          } catch { alert("Failed to delete"); }
                        }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { setShowEditCase(showCaseDetail); setEditDesc(showCaseDetail.description || ""); setEditHearing(showCaseDetail.hearing_date || ""); setShowCaseDetail(null); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <PenSquare className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => {
                const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\nCNR: ${showCaseDetail.cnr_number || "N/A"}\nHearing: ${showCaseDetail.hearing_date || "N/A"}\n\n— LitigaForge AI`;
                if (navigator.share) navigator.share({ title: showCaseDetail.title, text });
                else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button onClick={() => {
                const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\nCNR: ${showCaseDetail.cnr_number || "N/A"}\n\n— LitigaForge AI`;
                const blob = new Blob([text], { type: "text/plain" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `case-${showCaseDetail.id}.txt`; a.click(); URL.revokeObjectURL(a.href);
              }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {showCaseDetail.lawyer_phone && (
                <a href={`tel:${showCaseDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
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

      {/* ── Edit Case Modal ───────────────────────────────────── */}
      <Modal open={!!showEditCase} onClose={() => setShowEditCase(null)} title={`Edit: ${showEditCase?.title || ""}`}>
        {showEditCase && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} placeholder="Update case description…"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Next Hearing Date</label>
              <input type="date" value={editHearing} onChange={(e) => setEditHearing(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
            </div>
            <button onClick={() => {
              apiFetch(`/client/cases/${showEditCase.id}`, {
                method: "PATCH",
                body: JSON.stringify({ description: editDesc, hearing_date: editHearing }),
              }).then(() => { qc.invalidateQueries({ queryKey: ["client-cases"] }); setShowEditCase(null); });
            }} className="w-full text-sm font-bold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              Save Changes
            </button>
          </div>
        )}
      </Modal>

      {/* ── Match Detail Modal ────────────────────────────────── */}
      <Modal open={!!showMatchDetail} onClose={() => setShowMatchDetail(null)} title="Lawyer Profile">
        {showMatchDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/20">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{showMatchDetail.lawyer_name}</p>
                <p className="text-[11px] text-muted-foreground">{showMatchDetail.district} · Bar: {showMatchDetail.bar_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Experience", value: `${showMatchDetail.experience_years} years` },
                { label: "Rating",     value: showMatchDetail.rating > 0 ? `${showMatchDetail.rating} / 5` : "N/A" },
                { label: "Rate",       value: `₹${showMatchDetail.hourly_rate}/hr` },
                { label: "Match",      value: `${showMatchDetail.match_score}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3 bg-muted/40 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
            {showMatchDetail.ai_explanation && (
              <div className="rounded-xl p-3 bg-muted/40 border border-border">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">AI Analysis</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{showMatchDetail.ai_explanation}</p>
              </div>
            )}
            <div className="flex gap-2">
              {showMatchDetail.lawyer_phone && (
                <a href={`tel:${showMatchDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                  <Phone className="w-4 h-4" /> Call
                </a>
              )}
              {showMatchDetail.status === "pending" && (
                <button onClick={() => { setPayingMatch(showMatchDetail); setShowMatchDetail(null); }}
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                  <Lock className="w-4 h-4" /> Accept & Pay
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Message Modal ─────────────────────────────────────── */}
      <Modal open={!!showMessageModal} onClose={() => setShowMessageModal(null)} title={`Message ${showMessageModal?.lawyerName || ""}`}>
        {showMessageModal && (
          <div className="space-y-4">
            {threads.filter((t) => t.match_id === showMessageModal.matchId).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active thread. Start the conversation below.</p>
            ) : (
              <div className="space-y-2">
                {threads.filter((t) => t.match_id === showMessageModal.matchId).map((t) => (
                  <button key={t.id} onClick={() => { setLocation(`/legal-chat?thread=${t.id}`); setShowMessageModal(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-left">
                    <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{t.title}</span>
                    <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Quick Message</label>
              <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={3} placeholder="Type your message…"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>
            <button
              onClick={() => {
                const thread = threads.find((t) => t.match_id === showMessageModal.matchId);
                if (thread && messageText.trim()) sendMsgMut.mutate({ threadId: thread.id, content: messageText });
              }}
              disabled={!messageText.trim() || sendMsgMut.isPending}
              className="w-full text-sm font-bold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2">
              {sendMsgMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Message</>}
            </button>
          </div>
        )}
      </Modal>

      {payingMatch && (
        <PaymentModal
          matchId={payingMatch.id}
          lawyerName={payingMatch.lawyer_name}
          caseTitle={`Case #${payingMatch.case_requirement_id}`}
          budgetRange={payingMatch.hourly_rate ? `₹${payingMatch.hourly_rate}/hr` : undefined}
          onClose={() => setPayingMatch(null)}
          onSuccess={() => { setPayingMatch(null); qc.invalidateQueries({ queryKey: ["client-matches"] }); }}
        />
      )}
    </>
  );
}
