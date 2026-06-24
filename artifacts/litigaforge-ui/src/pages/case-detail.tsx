import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, FileText, MapPin, Calendar, DollarSign,
  Share2, PenSquare, MoreHorizontal, Users, Upload,
  Sparkles, MessageSquare, Activity, X, Check,
  Loader2, AlertTriangle, EyeOff, Download, Trash2,
  Scale, FileSearch, Phone, Clock, TrendingUp, Star,
  Building, Hash, ChevronDown, RefreshCw, ExternalLink,
  Plus, Send, Eye, Lock,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useCountry } from "@/hooks/useCountry";
import { formatDate } from "@/lib/locale";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  open:    { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  pending: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  closed:  { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
};

const CASE_TYPES = [
  "Property Dispute", "Family Matter", "Criminal", "Civil", "Consumer",
  "Labour", "Tax", "IP / Trademark", "Motor", "Other",
];

type TabKey = "overview" | "proposals" | "documents" | "messages" | "activity";

function TabBtn({ active, onClick, children, count }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
        active
          ? "text-blue-600 border-b-2 border-blue-600"
          : "text-gray-500 hover:text-gray-800 border-b-2 border-transparent",
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
          active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500",
        )}>{count}</span>
      )}
    </button>
  );
}

function InfoCard({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className={cn("text-sm font-semibold text-gray-800", valueClass)}>{value}</span>
    </div>
  );
}

function SectionCard({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface QAItem { q: string; a: string }
interface ParsedDesc { mainText: string; qaItems: QAItem[] }

function parseDescription(raw: string): ParsedDesc {
  if (!raw) return { mainText: "", qaItems: [] };
  const marker = "Additional details provided by the user:";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { mainText: raw.trim(), qaItems: [] };
  const mainText = raw.slice(0, idx).trim();
  const qaRaw = raw.slice(idx + marker.length).trim();
  const parts = qaRaw.split(/(?:^|\s)-\s+/).map(s => s.trim()).filter(Boolean);
  const qaItems: QAItem[] = parts.map(part => {
    const qIdx = part.lastIndexOf("?");
    if (qIdx !== -1) return { q: part.slice(0, qIdx).trim(), a: part.slice(qIdx + 1).trim() };
    const cIdx = part.indexOf(":");
    if (cIdx !== -1) return { q: part.slice(0, cIdx).trim(), a: part.slice(cIdx + 1).trim() };
    return { q: part, a: "" };
  });
  return { mainText, qaItems };
}

const QA_PALETTES = [
  { bg: "bg-amber-50",   border: "border-amber-200",  label: "text-amber-700",  value: "text-amber-900"  },
  { bg: "bg-blue-50",    border: "border-blue-200",   label: "text-blue-700",   value: "text-blue-900"   },
  { bg: "bg-emerald-50", border: "border-emerald-200",label: "text-emerald-700",value: "text-emerald-900" },
  { bg: "bg-red-50",     border: "border-red-200",    label: "text-red-700",    value: "text-red-900"    },
  { bg: "bg-purple-50",  border: "border-purple-200", label: "text-purple-700", value: "text-purple-900" },
  { bg: "bg-indigo-50",  border: "border-indigo-200", label: "text-indigo-700", value: "text-indigo-900" },
  { bg: "bg-rose-50",    border: "border-rose-200",   label: "text-rose-700",   value: "text-rose-900"   },
  { bg: "bg-teal-50",    border: "border-teal-200",   label: "text-teal-700",   value: "text-teal-900"   },
];

function DescriptionBlock({ raw }: { raw: string }) {
  const { mainText, qaItems } = parseDescription(raw);
  return (
    <div className="space-y-3">
      {mainText && (
        <p className="text-sm text-gray-600 leading-relaxed">{mainText}</p>
      )}
      {qaItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {qaItems.map((item, i) => {
            const p = QA_PALETTES[i % QA_PALETTES.length];
            return (
              <div key={i} className={cn("rounded-xl border px-4 py-3 flex flex-col gap-1", p.bg, p.border)}>
                <span className={cn("text-[11px] font-semibold uppercase tracking-wide leading-tight", p.label)}>
                  {item.q}
                </span>
                <span className={cn("text-sm font-bold leading-snug break-words", p.value)}>
                  {item.a || <span className="opacity-40 font-normal italic">Not provided</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}%</span>
    </div>
  );
}

export default function CaseDetail() {
  const [, params] = useRoute("/my-cases/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { activeCode } = useCountry();
  const qc = useQueryClient();
  const { toast } = useToast();

  const caseId = params?.id ? parseInt(params.id) : null;
  const [tab, setTab] = useState<TabKey>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [aiOverview, setAiOverview] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", case_type: "", description: "", location: "", budget_range: "", is_anonymous: false,
  });
  const [uploading, setUploading] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState<number | null>(null);

  const { data: caseData, isLoading, isError } = useQuery({
    queryKey: ["case-req", caseId],
    queryFn: () => apiFetch(`/cases/requirements/${caseId}`),
    enabled: !!user && !!caseId,
  });
  const c = caseData as any;

  const { data: matchesData } = useQuery({
    queryKey: ["client-matches"],
    queryFn: () => apiFetch("/matches/client"),
    enabled: !!user,
    staleTime: 30000,
  });
  const allMatches: any[] = matchesData?.matches ?? [];
  const caseMatches = allMatches.filter((m: any) => m.case_requirement_id === caseId);
  const pendingMatches = caseMatches.filter((m: any) => m.status === "pending");
  const acceptedMatches = caseMatches.filter((m: any) => m.status === "accepted");

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ["client-docs"],
    queryFn: () => apiFetch("/client/documents"),
    enabled: !!user,
  });
  const allDocs: any[] = (docsData?.documents ?? []).filter(
    (d: any) => d.case_requirement_id === caseId || (!d.case_requirement_id && !d.case_id)
  );

  const { data: threadsData } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => apiFetch("/chat/threads"),
    enabled: !!user,
  });
  const allThreads: any[] = threadsData?.threads ?? [];
  const matchIds = new Set(caseMatches.map((m: any) => m.id));
  const caseThreads = allThreads.filter((t: any) => matchIds.has(t.match_id));

  const updateMutation = useMutation({
    mutationFn: (body: any) => apiFetch(`/cases/requirements/${caseId}`, { method: "PATCH", body }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["case-req", caseId] });
      qc.invalidateQueries({ queryKey: ["my-cases"] });
      setShowEdit(false);
      toast({ title: "Case updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiFetch(`/cases/requirements/${caseId}`, { method: "PATCH", body: { status: "closed" } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-req", caseId] });
      qc.invalidateQueries({ queryKey: ["my-cases"] });
      toast({ title: "Case closed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/cases/requirements/${caseId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-cases"] });
      toast({ title: "Case deleted" });
      navigate("/my-cases");
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const acceptMatch = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/accept`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-matches"] }); toast({ title: "Match accepted!" }); },
  });

  const declineMatch = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/decline`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-matches"] }); },
  });

  function handleShare() {
    if (!c) return;
    const text = `Case: ${c.title}\nType: ${c.case_type}\nLocation: ${c.location || "N/A"}\nBudget: ${c.budget_range || "N/A"}\n\n— LitigaForge AI`;
    if (navigator.share) navigator.share({ title: c.title, text });
    else {
      navigator.clipboard?.writeText(text);
      toast({ title: "Link copied to clipboard" });
    }
  }

  function handleDownload() {
    if (!c) return;
    const content = [
      `CASE SUMMARY — ${c.title}`,
      `${"=".repeat(50)}`,
      `Category: ${c.case_type}`,
      `Location: ${c.location || "N/A"}`,
      `Status: ${c.status?.toUpperCase()}`,
      `Budget: ${c.budget_range || "N/A"}`,
      `Posted: ${formatDate(c.created_at, activeCode)}`,
      ``,
      `DESCRIPTION`,
      `${"-".repeat(50)}`,
      c.description || "No description provided.",
      ``,
      `MATCH PROPOSALS (${caseMatches.length})`,
      `${"-".repeat(50)}`,
      ...caseMatches.map((m: any) => `• ${m.lawyer_name} — Score: ${m.match_score}%  Status: ${m.status}`),
      ``,
      `— Generated by LitigaForge AI`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(c.title || "case").replace(/\s+/g, "-")}-summary.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !caseId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/litigaforge/cases/requirements/${caseId}/documents`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Upload failed (${res.status})`);
      }
      refetchDocs();
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function generateOverview() {
    if (!caseId) return;
    setLoadingOverview(true);
    try {
      const res = await apiFetch(`/cases/requirements/${caseId}/ai-overview`, { method: "POST" });
      setAiOverview(res.overview);
    } catch (err: any) {
      toast({ title: "AI overview failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingOverview(false);
    }
  }

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => apiFetch(`/client/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => { refetchDocs(); toast({ title: "Document deleted" }); },
  });

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Lock className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">Sign in to view case details</p>
          <Button size="sm" onClick={() => navigate("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError || !c) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-sm text-red-600 font-semibold">Case not found</p>
          <Button size="sm" variant="outline" onClick={() => navigate("/my-cases")}>← Back to My Cases</Button>
        </div>
      </div>
    );
  }

  const st = STATUS_COLORS[c.status] || STATUS_COLORS.open;
  const aiAnalysis = caseMatches.find((m: any) => m.ai_explanation)?.ai_explanation;

  const activityLog = [
    { icon: FileText, label: "Case created", date: c.created_at, color: "text-blue-500", bg: "bg-blue-50" },
    ...caseMatches.map((m: any) => ({
      icon: Users, label: `Proposal received from ${m.lawyer_name}`, date: m.created_at,
      color: "text-purple-500", bg: "bg-purple-50",
    })),
    ...acceptedMatches.map((m: any) => ({
      icon: Check, label: `Match accepted — ${m.lawyer_name}`, date: m.created_at,
      color: "text-emerald-500", bg: "bg-emerald-50",
    })),
    ...allDocs.slice(0, 3).map((d: any) => ({
      icon: Upload, label: `Document uploaded: ${d.filename}`, date: d.created_at,
      color: "text-amber-500", bg: "bg-amber-50",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <SEOHelmet title={`${c.title} — My Cases`} description={c.description || `Case detail for ${c.title}`} canonical={`/my-cases/${caseId}`} />

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/my-cases">
            <span className="text-gray-500 hover:text-blue-600 transition-colors cursor-pointer font-medium">My Cases</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-900 font-semibold truncate max-w-[200px]">{c.title}</span>
        </nav>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{c.title}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleShare} data-testid="case-share-btn">
                <Share2 className="w-3.5 h-3.5" /> Share Case
              </Button>
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
                setEditForm({ title: c.title || "", case_type: c.case_type || "", description: parseDescription(c.description || "").mainText, location: c.location || "", budget_range: c.budget_range || "", is_anonymous: c.is_anonymous || false });
                setShowEdit(true);
              }} data-testid="case-edit-btn">
                <PenSquare className="w-3.5 h-3.5" /> Edit Case
              </Button>
              <div className="relative">
                <button
                  onClick={() => setShowMore(v => !v)}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  data-testid="case-more-btn"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {showMore && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMore(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute right-0 top-9 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-48"
                      >
                        <button onClick={() => { handleDownload(); setShowMore(false); }}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                          <Download className="w-3.5 h-3.5" /> Download Summary
                        </button>
                        <button onClick={() => {
                          if (!confirm("Close this case? It will no longer appear in proposals.")) return;
                          closeMutation.mutate(); setShowMore(false);
                        }}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                          <X className="w-3.5 h-3.5" /> Close Case
                        </button>
                        <hr className="my-1 border-gray-100" />
                        <button onClick={() => {
                          if (!confirm("Permanently delete this case?")) return;
                          deleteMutation.mutate(); setShowMore(false);
                        }}
                          className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 flex items-center gap-2 text-red-600">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Case
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{c.case_type}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>{c.status?.toUpperCase()}</span>
            {c.location && (
              <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{c.location}</span>
            )}
            <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3 text-gray-400" />{formatDate(c.created_at, activeCode)}</span>
            {c.budget_range && (
              <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">{c.budget_range}</span>
            )}
            {c.is_anonymous && (
              <span className="text-xs text-gray-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Anonymous</span>
            )}
          </div>

          {c.description && (
            <div className="space-y-4">
              <DescriptionBlock raw={c.description} />

              {/* AI Overview */}
              {aiOverview ? (
                <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-purple-900">AI Legal Overview</span>
                    </div>
                    <button onClick={() => setAiOverview(null)}
                      className="text-[10px] text-purple-400 hover:text-purple-600 font-medium transition-colors">
                      Regenerate
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiOverview}</div>
                </div>
              ) : (
                <button
                  onClick={generateOverview}
                  disabled={loadingOverview}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
                >
                  {loadingOverview
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating overview…</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Generate AI Overview</>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
          <TabBtn active={tab === "proposals"} onClick={() => setTab("proposals")} count={caseMatches.length}>Proposals</TabBtn>
          <TabBtn active={tab === "documents"} onClick={() => setTab("documents")} count={allDocs.length}>Documents</TabBtn>
          <TabBtn active={tab === "messages"} onClick={() => setTab("messages")} count={caseThreads.length}>Messages</TabBtn>
          <TabBtn active={tab === "activity"} onClick={() => setTab("activity")}>Activity Log</TabBtn>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="space-y-5">
                {/* Top row: info + additional details + actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Case Information */}
                  <SectionCard title="Case Information">
                    <div className="space-y-3.5">
                      <InfoCard label="Category" value={c.case_type} />
                      <InfoCard label="Location" value={c.location || "—"} valueClass="text-blue-600" />
                      <InfoCard label="Date Posted" value={formatDate(c.created_at, activeCode)} />
                      <InfoCard label="Claim Amount" value={c.budget_range || "—"} valueClass="text-amber-600" />
                      <InfoCard label="Status" value={
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.text }}>
                          {c.status?.toUpperCase()}
                        </span>
                      } />
                    </div>
                  </SectionCard>

                  {/* Additional Details */}
                  <SectionCard title="Additional Details">
                    {c.description ? (
                      <ul className="space-y-2.5">
                        {c.description.split(/[.?!]/).filter((s: string) => s.trim().length > 10).slice(0, 5).map((sentence: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                            <span>{sentence.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No additional details</p>
                    )}
                  </SectionCard>

                  {/* Actions */}
                  <SectionCard title="Actions">
                    <div className="space-y-2">
                      <button onClick={() => { setEditForm({ title: c.title || "", case_type: c.case_type || "", description: c.description || "", location: c.location || "", budget_range: c.budget_range || "", is_anonymous: c.is_anonymous || false }); setShowEdit(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-600 text-sm font-medium transition-colors" data-testid="action-edit-case">
                        <PenSquare className="w-4 h-4" /> Edit Case
                      </button>
                      <button onClick={() => { if (!confirm("Close this case?")) return; closeMutation.mutate(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors" data-testid="action-close-case">
                        <X className="w-4 h-4" /> Close Case
                      </button>
                      <button onClick={handleShare}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-600 text-sm font-medium transition-colors" data-testid="action-share-case">
                        <Share2 className="w-4 h-4" /> Share Case
                      </button>
                      <button onClick={handleDownload}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-purple-50 text-purple-600 text-sm font-medium transition-colors" data-testid="action-download">
                        <Download className="w-4 h-4" /> Download Summary
                      </button>
                      <hr className="border-gray-100" />
                      <button onClick={() => { if (!confirm("Permanently delete this case?")) return; deleteMutation.mutate(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 text-sm font-medium transition-colors" data-testid="action-delete-case">
                        <Trash2 className="w-4 h-4" /> Delete Case
                      </button>
                    </div>
                  </SectionCard>
                </div>

                {/* Next Steps */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Next Steps</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { icon: Users, label: "View Proposals", color: "#3B82F6", bg: "#EFF6FF", action: () => setTab("proposals"), testId: "next-view-proposals" },
                      { icon: Upload, label: "Upload Documents", color: "#F59E0B", bg: "#FFFBEB", action: () => setTab("documents"), testId: "next-upload-docs" },
                      { icon: Sparkles, label: "AI Legal Analysis", color: "#8B5CF6", bg: "#F5F3FF", action: () => setTab("overview"), testId: "next-ai-analysis" },
                      { icon: MessageSquare, label: "Chat with Lawyer", color: "#10B981", bg: "#ECFDF5", action: () => setTab("messages"), testId: "next-chat-lawyer" },
                      { icon: Share2, label: "Share Case", color: "#06B6D4", bg: "#ECFEFF", action: handleShare, testId: "next-share-case" },
                    ].map(({ icon: Icon, label, color, bg, action, testId }) => (
                      <button key={label} onClick={action} data-testid={testId}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:shadow-sm transition-all group">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                          <Icon className="w-5 h-5" style={{ color }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom 2-col grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposals preview */}
                  <SectionCard title={`Proposals (${caseMatches.length})`}
                    action={caseMatches.length > 0 ? <button onClick={() => setTab("proposals")} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View All</button> : undefined}>
                    {caseMatches.length === 0 ? (
                      <div className="text-center py-4">
                        <Users className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No proposals yet</p>
                        <Link href={`/matches?case=${caseId}`}>
                          <Button size="sm" variant="outline" className="mt-2 text-xs h-7 gap-1">
                            <Sparkles className="w-3 h-3" /> Find Lawyers
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {caseMatches.slice(0, 3).map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                                {m.lawyer_name?.[0] || "L"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{m.lawyer_name}</p>
                                <p className="text-[11px] text-gray-400">{m.hourly_rate ? `₹${m.hourly_rate.toLocaleString()}` : "Rate N/A"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {m.status === "pending" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">NEW</span>
                              )}
                              {m.status === "accepted" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ACCEPTED</span>
                              )}
                              <span className="text-xs font-bold text-blue-600">{m.match_score}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Documents preview */}
                  <SectionCard title={`Documents (${allDocs.length})`}
                    action={
                      <label className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer flex items-center gap-1">
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Upload More
                        <input type="file" className="hidden" onChange={handleDocUpload} />
                      </label>
                    }>
                    {allDocs.length === 0 ? (
                      <div className="text-center py-4">
                        <FileText className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No documents uploaded</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allDocs.slice(0, 3).map((d: any) => (
                          <div key={d.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 group">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{d.filename}</p>
                              <p className="text-[11px] text-gray-400">{d.file_size ? `${(d.file_size / 1024 / 1024).toFixed(1)} MB` : d.file_type}</p>
                            </div>
                            {d.file_url && (
                              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Messages preview */}
                  <SectionCard title={`Messages (${caseThreads.length})`}
                    action={caseThreads.length > 0 ? <button onClick={() => setTab("messages")} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View All</button> : undefined}>
                    {caseThreads.length === 0 ? (
                      <div className="text-center py-4">
                        <MessageSquare className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {caseThreads.slice(0, 3).map((t: any) => {
                          const match = caseMatches.find((m: any) => m.id === t.match_id);
                          return (
                            <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                                {match?.lawyer_name?.[0] || "L"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800">{match?.lawyer_name || t.title}</p>
                                {t.last_message && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{t.last_message}</p>}
                              </div>
                              {t.last_message_at && (
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(t.last_message_at, activeCode)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>

                  {/* AI Legal Analysis */}
                  <SectionCard title="AI Legal Analysis">
                    {aiAnalysis ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{aiAnalysis}</p>
                        </div>
                        <button onClick={() => setTab("proposals")}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors">
                          View Full Analysis <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Sparkles className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400 mb-2">Get AI insights for this case</p>
                        <Link href={`/matches?case=${caseId}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                            <Sparkles className="w-3 h-3" /> Find Matches
                          </Button>
                        </Link>
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* Activity Log preview */}
                <SectionCard title="Activity Log"
                  action={<button onClick={() => setTab("activity")} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View All</button>}>
                  {activityLog.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No activity yet</p>
                  ) : (
                    <div className="space-y-2.5">
                      {activityLog.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", a.bg)}>
                            <a.icon className={cn("w-3.5 h-3.5", a.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 font-medium truncate">{a.label}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(a.date, activeCode)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ── PROPOSALS ── */}
            {tab === "proposals" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{caseMatches.length} proposal{caseMatches.length !== 1 ? "s" : ""} received</p>
                  <Link href={`/matches?case=${caseId}`}>
                    <Button size="sm" className="text-xs h-8 gap-1"><Sparkles className="w-3 h-3" /> Find More Lawyers</Button>
                  </Link>
                </div>
                {caseMatches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-4">No proposals yet. Find matched lawyers to get started.</p>
                    <Link href={`/matches?case=${caseId}`}>
                      <Button><Sparkles className="w-4 h-4 mr-2" /> Find Matched Lawyers</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caseMatches.map((m: any) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                              {m.lawyer_name?.[0] || "L"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900">{m.lawyer_name}</p>
                                {m.status === "pending" && <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">NEW</span>}
                                {m.status === "accepted" && <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ACCEPTED</span>}
                                {m.status === "declined" && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">DECLINED</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                {m.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.district}</span>}
                                {m.experience_years && <span>{m.experience_years}y exp</span>}
                                {m.hourly_rate && <span className="font-semibold text-gray-700">₹{m.hourly_rate.toLocaleString()}/hr</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" className="text-xs h-7 text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => declineMatch.mutate(m.id)} disabled={declineMatch.isPending}>
                                  Decline
                                </Button>
                                <Button size="sm" className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => acceptMatch.mutate(m.id)} disabled={acceptMatch.isPending}>
                                  {acceptMatch.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Accept"}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {m.match_score && <MatchScoreBar score={m.match_score} />}
                        {m.ai_explanation && (
                          <div className="mt-3 p-3 bg-purple-50 rounded-xl">
                            <p className="text-xs text-purple-800 leading-relaxed">{m.ai_explanation}</p>
                          </div>
                        )}
                        {m.client_message && (
                          <div className="mt-2 text-xs text-gray-500 italic">"{m.client_message}"</div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {tab === "documents" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{allDocs.length} document{allDocs.length !== 1 ? "s" : ""}</p>
                  <label className="cursor-pointer">
                    <Button size="sm" className="text-xs h-8 gap-1.5" asChild>
                      <span>
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Upload Document
                      </span>
                    </Button>
                    <input type="file" className="hidden" onChange={handleDocUpload} />
                  </label>
                </div>
                {allDocs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-2">No documents uploaded yet</p>
                    <p className="text-xs text-gray-300">Upload PDFs, images, or Word documents for this case</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allDocs.map((d: any) => (
                      <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 group hover:shadow-sm transition-all">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{d.filename}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {d.file_size ? `${(d.file_size / 1024 / 1024).toFixed(1)} MB` : d.file_type}
                            {" · "}{formatDate(d.created_at, activeCode)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button onClick={() => { if (!confirm("Delete this document?")) return; deleteDoc.mutate(d.id); }}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MESSAGES ── */}
            {tab === "messages" && (
              <div className="space-y-4">
                {caseThreads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-2">No messages yet</p>
                    <p className="text-xs text-gray-300">Accept a match proposal to start chatting with a lawyer</p>
                    <button onClick={() => setTab("proposals")} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">
                      View Proposals →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caseThreads.map((t: any) => {
                      const match = caseMatches.find((m: any) => m.id === t.match_id);
                      return (
                        <Link href={`/messages?thread=${t.id}`} key={t.id}>
                          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 flex-shrink-0">
                                {match?.lawyer_name?.[0] || "L"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900">{match?.lawyer_name || t.title}</p>
                                {t.last_message && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.last_message}</p>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {t.unread_count > 0 && (
                                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                                    {t.unread_count}
                                  </span>
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITY LOG ── */}
            {tab === "activity" && (
              <div>
                {activityLog.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No activity recorded yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gray-100" />
                    <div className="space-y-1">
                      {activityLog.map((a, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-4 py-3">
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm z-10", a.bg)}>
                            <a.icon className={cn("w-4 h-4", a.color)} />
                          </div>
                          <div className="flex-1 pt-1.5">
                            <p className="text-sm font-medium text-gray-800">{a.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.date, activeCode)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowEdit(false)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Edit Case</h3>
                <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Case Type</label>
                  <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white" value={editForm.case_type} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))}>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea rows={4} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Budget</label>
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={editForm.budget_range} onChange={e => setEditForm(f => ({ ...f, budget_range: e.target.value }))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
                  <input type="checkbox" checked={editForm.is_anonymous} onChange={e => setEditForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                  <EyeOff className="w-3.5 h-3.5" /> Post anonymously
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button className="flex-1" disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(editForm)}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
