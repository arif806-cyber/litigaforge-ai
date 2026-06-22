import { useState, useEffect } from "react";
import { useCountry } from "../hooks/useCountry";
import { useLanguage } from "../hooks/useLanguage";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CLIENT_DASHBOARD_COPY } from "@/lib/country-copy";
import { localeFor, caseTerms } from "@/lib/locale";
import { motion } from "framer-motion";
import {
  Briefcase, FileText, User, MessageSquare,
  Gavel, Plus, ChevronRight, X, Phone,
  Loader2, Sparkles, Send, Bell, Shield, Award, ArrowRight,
  Scale, Calendar, FileCheck, Heart, FileSearch, Building2, Hash,
  PenSquare, Download, Share2, Search, Upload, Trash2, Lock,
  AlertCircle,
} from "lucide-react";
import { PaymentModal } from "@/components/PaymentModal";
import { ScoreRing } from "@/components/case-file-os";
import CaseProgressRail from "@/components/CaseProgressRail";
import { LawyerMatchCard } from "@/components/LawyerMatchCard";
import { useLawyerPresence } from "@/hooks/useLawyerPresence";

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
            <div className={`w-2 h-2 rounded-full transition-colors ${done ? "bg-emerald-500" : "bg-muted"}`} />
            {isCurrent && <span className="text-[10px] font-semibold text-emerald-600 ml-0.5">{stageLabel(s)}</span>}
            {i < CASE_STAGES.length - 1 && <div className={`w-3 h-px ${done ? "bg-emerald-500/40" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, iconBg, iconColor, borderColor }: {
  label: string; value: number; icon: React.ElementType;
  iconBg: string; iconColor: string; borderColor: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden relative flex flex-col gap-3 p-4">
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: borderColor }} />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1.5 leading-snug">{label}</p>
      </div>
    </motion.div>
  );
}

/* ── Match Score Bar ────────────────────────────────────────── */
function MatchScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>{score}%</span>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { activeCode } = useCountry();
  const copy = CLIENT_DASHBOARD_COPY[activeCode.toUpperCase()] ?? CLIENT_DASHBOARD_COPY.IN;
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
      apiFetch("/chat/messages", { method: "POST", body: JSON.stringify({ thread_id: threadId, content }) }),
    onSuccess: () => { setMessageText(""); setShowMessageModal(null); qc.invalidateQueries({ queryKey: ["chat-threads"] }); },
  });

  const filteredMatches = allMatches.filter((m) => m.status === matchTab);
  const activeReqs = requirements.filter((r) => r.status === "open").length;
  const acceptedMatches = allMatches.filter((m) => m.status === "accepted").length;
  const activeCases = clientCases.filter((c) => c.status === "active").length;
  const upcomingHearings = clientCases.filter((c) => c.hearing_date && new Date(c.hearing_date) >= new Date()).length;
  const connectedLawyers = [...new Set(clientCases.map((c) => c.lawyer_id))].length;
  const pendingMatches = allMatches.filter((m) => m.status === "pending").length;

  const currentStage = (() => {
    if (activeCases > 0)       return "hired";
    if (acceptedMatches > 0)   return "proposals";
    if (pendingMatches > 0)    return "requested";
    if (allMatches.length > 0) return "matched";
    return "posted";
  })();

  const presenceCaseId = allMatches[0]?.case_requirement_id ?? null;
  const reviewingIds = useLawyerPresence(presenceCaseId);

  const firstName = user?.name?.split(" ")[0] ?? "Client";
  const initials = (user?.name ?? "C").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const { activeConfig, loading: countryLoading } = useCountry();
  const { t } = useLanguage();
  const locale = localeFor(activeCode);

  const quickActions = [
    { label: t.post_case,    icon: Plus,       iconColor: "text-blue-600",   bgColor: "bg-blue-50 border-blue-100",   action: () => setLocation("/post-case") },
    { label: t.doc_analyzer, icon: FileSearch, iconColor: "text-violet-600", bgColor: "bg-violet-50 border-violet-100", action: () => setLocation("/review") },
    { label: t.legal_qa,     icon: Gavel,      iconColor: "text-amber-600",  bgColor: "bg-amber-50 border-amber-100",  action: () => setLocation("/ask") },
    { label: t.free_aid,     icon: Heart,      iconColor: "text-rose-600",   bgColor: "bg-rose-50 border-rose-100",    action: () => setLocation("/legal-aid") },
  ];

  const caseTabLabels: Record<string, string> = { active: "Active", pending: "Pending", closed: "Closed" };
  const matchTabLabels: Record<string, string> = { pending: "Pending", accepted: "Accepted", declined: "Declined" };

  return (
    <>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-20 md:pb-8">

        {/* ── Greeting Banner ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #1a2744 0%, #1e3a6e 60%, #163060 100%)" }}>
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 20%, #10b981 0%, transparent 40%)" }} />
          <div className="relative px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-white">{initials}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-300">{t.good_day}</p>
                  <h1 className="text-xl font-bold text-white leading-tight">{firstName}</h1>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/25 flex-shrink-0">
                <Shield className="w-3.5 h-3.5" /> AI Protected
              </div>
            </div>
            {/* Inline mini-stats */}
            <div className="mt-4 flex items-center gap-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-2xl font-bold text-white tabular-nums leading-none">{activeCases}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t.active_cases}</p>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <p className="text-2xl font-bold text-amber-300 tabular-nums leading-none">{upcomingHearings}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t.hearings}</p>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <p className="text-2xl font-bold text-emerald-300 tabular-nums leading-none">{connectedLawyers}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t.my_lawyers}</p>
              </div>
              {pendingMatches > 0 && (
                <>
                  <div className="w-px h-8 bg-white/15" />
                  <div>
                    <p className="text-2xl font-bold text-violet-300 tabular-nums leading-none">{pendingMatches}</p>
                    <p className="text-[10px] text-blue-300 mt-0.5">Proposals</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Emergency Legal Aid Banner ───────────────────────── */}
        {!countryLoading && activeConfig && (() => {
          const tel = activeConfig.emergency_legal?.replace(/[^\d+]/g, "") ?? "";
          const cls = "flex items-center gap-3.5 p-4 rounded-2xl text-white transition-all hover:shadow-lg shadow-md";
          const style = { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 20px -4px rgba(16,185,129,0.35)" };
          const inner = (
            <>
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">Emergency Legal Aid · {activeConfig.flag}</p>
                <p className="text-xs text-emerald-100 mt-0.5 truncate">{activeConfig.emergency_legal}{tel ? " · Tap to call" : ""}</p>
              </div>
              {tel && (
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
              )}
            </>
          );
          return tel ? (
            <motion.a initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              href={`tel:${tel}`} className={cls + " active:scale-[0.98]"} style={style}>{inner}</motion.a>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className={cls} style={style}>{inner}</motion.div>
          );
        })()}

        {/* ── Case Progress Rail ───────────────────────────────── */}
        <CaseProgressRail currentStage={currentStage} />

        {/* ── Country Section ───────────────────────────────────── */}
        {!countryLoading && activeConfig && (
          <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center gap-3" style={{ background: "linear-gradient(to right, rgba(26,39,68,0.04), transparent)" }}>
              <span className="text-2xl leading-none">{activeConfig.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{activeConfig.name}</p>
                <p className="text-[11px] text-muted-foreground">{activeConfig.legal_system} · {activeConfig.currency_symbol}{activeConfig.currency}</p>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              {(activeConfig.top_services?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Services</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {activeConfig.top_services!.map((s: string) => (
                      <span key={s} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(activeConfig.courts?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Courts & Tribunals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeConfig.courts!.slice(0, 4).map((c: string) => (
                      <span key={c} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <motion.button key={a.label} onClick={a.action} whileTap={{ scale: 0.96 }}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-card hover:shadow-md transition-all text-center ${a.bgColor}`}>
                <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm">
                  <Icon className={`w-5 h-5 ${a.iconColor}`} />
                </div>
                <span className="text-xs font-semibold text-foreground leading-snug">{a.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Main content grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left — Cases & Matches */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── My Assigned Cases ─────────────────────────── */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 border border-blue-100">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground text-[15px]">{t.my_assigned_cases}</h2>
                      <p className="text-[11px] text-muted-foreground">{clientCases.length} total</p>
                    </div>
                  </div>
                  <button onClick={() => setLocation("/post-case")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                    <Plus className="w-3.5 h-3.5" /> New Case
                  </button>
                </div>
                {/* Tab pills */}
                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
                  {(["active", "pending", "closed"] as const).map((tab) => {
                    const count = clientCases.filter(c => c.status === tab).length;
                    return (
                      <button key={tab} onClick={() => setCaseTab(tab)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
                          caseTab === tab
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {caseTabLabels[tab]}
                        {count > 0 && (
                          <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                            caseTab === tab ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                          }`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search */}
              <div className="px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input type="text" placeholder={t.search_cases}
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {casesLoading && (
                  <div className="py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Loading cases…</p>
                  </div>
                )}

                {!casesLoading && clientCases.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                      <Briefcase className="w-7 h-7 text-blue-400" />
                    </div>
                    <p className="font-semibold text-foreground text-base mb-1">{t.no_cases_yet}</p>
                    <p className="text-sm text-muted-foreground mb-4 max-w-[240px] leading-relaxed">
                      Post your first case and get matched with verified advocates
                    </p>
                    <button onClick={() => setLocation("/post-case")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                      <Plus className="w-4 h-4" /> {t.post_case_prompt}
                    </button>
                  </motion.div>
                )}

                {!casesLoading && clientCases.length > 0 && (() => {
                  const filtered = clientCases
                    .filter((c) => c.status === caseTab)
                    .filter((c) => !searchQuery || [c.title, c.court_name, c.cnr_number, c.case_type].some((f) => f?.toLowerCase().includes(searchQuery.toLowerCase())));
                  if (filtered.length === 0) {
                    return (
                      <div className="py-10 text-center">
                        <p className="text-sm text-muted-foreground">No {caseTab} cases{searchQuery ? " matching your search" : ""}.</p>
                        {caseTab !== "active" && (
                          <button onClick={() => setCaseTab("active")} className="mt-2 text-xs font-semibold text-primary hover:underline">
                            View active cases →
                          </button>
                        )}
                      </div>
                    );
                  }
                  return filtered.map((c, i) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all overflow-hidden"
                      style={{ borderLeftWidth: "3px", borderLeftColor: c.status === "active" ? "#10b981" : c.status === "pending" ? "#f59e0b" : "#94a3b8" }}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50 border border-blue-100">
                              <Briefcase className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-foreground text-sm">{c.title}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{c.case_type}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  c.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  c.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  "bg-muted text-muted-foreground"}`}>
                                  {c.status.toUpperCase()}
                                </span>
                              </div>
                              <CaseStageTimeline stage={c.case_stage} />
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                                {c.court_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.court_name}</span>}
                                {c.cnr_number && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{c.cnr_number}</span>}
                                {c.hearing_date && (
                                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(c.hearing_date).toLocaleDateString(locale)}
                                  </span>
                                )}
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.lawyer_name || "Lawyer"}</span>
                              </div>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => { setShowEditCase(c); setEditDesc(c.description || ""); setEditHearing(c.hearing_date || ""); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => {
                              const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\n${caseTerms(activeCode).short}: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                              if (navigator.share) navigator.share({ title: c.title, text });
                              else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                            }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Share">
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => {
                              const text = `Case: ${c.title}\nType: ${c.case_type}\nCourt: ${c.court_name || "N/A"}\n${caseTerms(activeCode).short}: ${c.cnr_number || "N/A"}\nHearing: ${c.hearing_date || "N/A"}\nStage: ${c.case_stage || "N/A"}\nDescription: ${c.description || "N/A"}\nLawyer: ${c.lawyer_name || "N/A"}\n\n— LitigaForge AI`;
                              const blob = new Blob([text], { type: "text/plain" });
                              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `case-${c.id}.txt`; a.click();
                            }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Download">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setShowCaseDetail(c)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="View Details">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>
            </div>

            {/* ── Match Proposals ───────────────────────────── */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50 border border-violet-100">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground text-[15px]">{t.match_proposals}</h2>
                      <p className="text-[11px] text-muted-foreground">{allMatches.length} total proposals</p>
                    </div>
                  </div>
                  {pendingMatches > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {pendingMatches} pending
                    </span>
                  )}
                </div>
                {/* Match tabs */}
                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
                  {(["pending", "accepted", "declined"] as const).map((tab) => {
                    const count = allMatches.filter(m => m.status === tab).length;
                    return (
                      <button key={tab} onClick={() => setMatchTab(tab)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
                          matchTab === tab
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {matchTabLabels[tab]}
                        {count > 0 && (
                          <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                            matchTab === tab ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                          }`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {matchLoading && (
                  <div className="py-10 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </div>
                )}

                {!matchLoading && filteredMatches.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
                      <Sparkles className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">No {matchTab} proposals</p>
                    <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
                      {matchTab === "pending"
                        ? "Post a case to get AI-matched with verified advocates"
                        : `No ${matchTab} proposals yet`}
                    </p>
                    {matchTab === "pending" && (
                      <button onClick={() => setLocation("/post-case")}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Post a Case
                      </button>
                    )}
                  </motion.div>
                )}

                {!matchLoading && filteredMatches.map((m, i) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <LawyerMatchCard
                      match={m}
                      isReviewing={reviewingIds.has(m.lawyer_id)}
                      onAccept={(match) => setPayingMatch(match as any)}
                      onDecline={(id) => declineMut.mutate(id)}
                      testIdPrefix="dashboard-match-card"
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right sidebar — desktop only ──────────────────── */}
          <aside className="hidden lg:flex flex-col gap-4">

            {/* Upcoming Hearings */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 border border-amber-100">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">Upcoming Hearings</p>
              </div>
              <div className="p-3 space-y-2">
                {clientCases.filter((c) => c.hearing_date).slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{c.court_name || "District Court"}</p>
                      <p className="text-[11px] text-amber-600 font-bold mt-0.5">{new Date(c.hearing_date).toLocaleDateString(locale)}</p>
                    </div>
                  </div>
                ))}
                {clientCases.filter((c) => c.hearing_date).length === 0 && (
                  <p className="text-[12px] text-muted-foreground text-center py-4">No upcoming hearings</p>
                )}
              </div>
            </div>

            {/* My Lawyers */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
                  <User className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">My Lawyers</p>
              </div>
              <div className="p-3 space-y-1.5">
                {clientCases.filter((c, i, arr) => arr.findIndex((x) => x.lawyer_id === c.lawyer_id) === i).map((c) => (
                  <div key={c.lawyer_id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary font-bold text-sm">
                      {(c.lawyer_name || "A")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{c.lawyer_name || "Lawyer"}</p>
                      <p className="text-[10px] text-muted-foreground">{c.case_type}</p>
                    </div>
                    {c.lawyer_phone && (
                      <a href={`tel:${c.lawyer_phone}`}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
                {clientCases.length === 0 && (
                  <p className="text-[12px] text-muted-foreground text-center py-4">No lawyers yet</p>
                )}
              </div>
            </div>

            {/* Legal Tools */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <p className="text-[14px] font-semibold text-foreground">Legal Tools</p>
              </div>
              <div className="p-2">
                {[
                  { label: "Document Analyzer", icon: FileText, href: "/review",    color: "text-violet-600", bg: "bg-violet-50" },
                  { label: "Judgment Finder",   icon: Scale,    href: "/judgments", color: "text-blue-600",   bg: "bg-blue-50" },
                  { label: "Legal Q&A",         icon: Gavel,    href: "/ask",       color: "text-amber-600",  bg: "bg-amber-50" },
                  { label: "Free Legal Aid",    icon: Shield,   href: "/legal-aid", color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.label} onClick={() => setLocation(item.href)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-foreground hover:bg-muted/50 transition-colors text-[12px] font-medium text-left">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      {item.label}
                      <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/50" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upgrade banner */}
            {user?.subscription_tier === "free" && (
              <div className="rounded-2xl p-4 border border-primary/20 overflow-hidden relative"
                style={{ background: "linear-gradient(135deg, #1a2744 0%, #1e3a6e 100%)" }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
                  style={{ background: "#f59e0b", transform: "translate(30%, -30%)" }} />
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <p className="font-bold text-sm text-white">Upgrade to Professional</p>
                </div>
                <p className="text-[11px] mb-3 leading-relaxed text-blue-300">
                  Priority matching · Unlimited AI · WhatsApp alerts
                </p>
                <button onClick={() => setLocation("/subscription")}
                  className="w-full text-xs font-bold py-2.5 rounded-xl text-[#1a2744] transition-colors hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
                  Upgrade — ₹999/mo
                </button>
              </div>
            )}
          </aside>
        </div>

        {/* ── Mobile-only: Hearings + Upgrade ─────────────────── */}
        <div className="lg:hidden space-y-3">
          {clientCases.filter((c) => c.hearing_date).length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 border border-amber-100">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">Upcoming Hearings</p>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {clientCases.filter((c) => c.hearing_date).slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-amber-600 font-bold">{new Date(c.hearing_date).toLocaleDateString(locale)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.subscription_tier === "free" && (
            <div className="rounded-2xl p-5 overflow-hidden relative"
              style={{ background: "linear-gradient(135deg, #1a2744 0%, #1e3a6e 100%)" }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                style={{ background: "#f59e0b", transform: "translate(40%, -40%)" }} />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-white">Upgrade to Professional</p>
                  <p className="text-[11px] text-blue-300">Priority matching + Unlimited AI</p>
                </div>
              </div>
              <button onClick={() => setLocation("/subscription")}
                className="w-full text-sm font-bold py-3 rounded-xl text-[#1a2744] transition-colors hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
                Upgrade Now — ₹999/month
              </button>
            </div>
          )}
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
                { label: caseTerms(activeCode).short, value: showCaseDetail.cnr_number || "N/A" },
                { label: "Hearing",   value: showCaseDetail.hearing_date ? new Date(showCaseDetail.hearing_date).toLocaleDateString(locale) : "N/A" },
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
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-50">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{doc.filename}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.file_type} · {doc.file_size ? (doc.file_size / 1024).toFixed(1) + " KB" : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a href={doc.file_url} download={doc.filename} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => {
                          const text = `Case Document: ${doc.filename}\nCase: ${showCaseDetail.title}\n\nDownload: ${typeof window !== "undefined" ? window.location.origin : ""}${doc.file_url}\n\n— LitigaForge AI`;
                          if (navigator.share) navigator.share({ title: doc.filename, text });
                          else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                        }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${doc.filename}"?`)) return;
                          try {
                            await apiFetch(`/client/documents/${doc.id}`, { method: "DELETE" });
                            setCaseDocs(prev => prev.filter(d => d.id !== doc.id));
                          } catch { alert("Failed to delete"); }
                        }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors">
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
                const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\n${caseTerms(activeCode).short}: ${showCaseDetail.cnr_number || "N/A"}\nHearing: ${showCaseDetail.hearing_date || "N/A"}\n\n— LitigaForge AI`;
                if (navigator.share) navigator.share({ title: showCaseDetail.title, text });
                else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button onClick={() => {
                const text = `Case: ${showCaseDetail.title}\nType: ${showCaseDetail.case_type}\nCourt: ${showCaseDetail.court_name || "N/A"}\n${caseTerms(activeCode).short}: ${showCaseDetail.cnr_number || "N/A"}\n\n— LitigaForge AI`;
                const blob = new Blob([text], { type: "text/plain" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `case-${showCaseDetail.id}.txt`; a.click(); URL.revokeObjectURL(a.href);
              }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {showCaseDetail.lawyer_phone && (
                <a href={`tel:${showCaseDetail.lawyer_phone}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Call Lawyer
                </a>
              )}
              {showCaseDetail.lawyer_email && (
                <a href={`mailto:${showCaseDetail.lawyer_email}`} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
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
            }} className="w-full text-sm font-bold py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground transition-opacity">
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
              <ScoreRing score={showMatchDetail.match_score} size={72} showLabel={false} className="flex-shrink-0" data-testid="dashboard-match-detail-score-ring" />
              <div>
                <p className="font-bold text-foreground text-base">{showMatchDetail.lawyer_name}</p>
                <p className="text-[12px] text-muted-foreground">{showMatchDetail.district} · Bar: {showMatchDetail.bar_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Experience", value: `${showMatchDetail.experience_years} years` },
                { label: "Rating",     value: showMatchDetail.rating > 0 ? `${showMatchDetail.rating} / 5 ★` : "N/A" },
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
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground transition-opacity">
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
              className="w-full text-sm font-bold py-2.5 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground transition-opacity flex items-center justify-center gap-2">
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
