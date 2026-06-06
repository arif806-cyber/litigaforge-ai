import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Star, Briefcase, Users, FileText, BookOpen, User,
  Search, Bell, ChevronRight, Plus, Upload, CheckCircle2,
  X, LogOut, MessageSquare, ExternalLink, Info,
  FileSearch, Gavel, Phone, Award, AlertTriangle, IndianRupee,
  Shield, MapPin, Clock, XCircle, Loader2, Trash2, Sparkles,
  FolderOpen, PenSquare, ChevronDown, Check, Download, Share2, StickyNote, Send, Copy,
  Hourglass,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


// ── Sidebar Nav ──────────────────────────────────────────────────────────────
const lawyerNav = [
  { id: "chat",     label: "AI Legal Chat",       icon: Star,      href: "/legal-chat",  highlight: true },
  { id: "cases",    label: "My Cases",            icon: Briefcase, href: "/cases" },
  { id: "leads",    label: "Client Requests",     icon: Users,     href: "/matches" },
  { id: "docs",     label: "Documents & Files",   icon: FileText,  href: "/review" },
  { id: "research", label: "Research Assistant",  icon: BookOpen,  href: "/judgments" },
  { id: "profile",  label: "Profile & Earnings", icon: User,      href: "/subscription" },
];

const CASE_TYPES = [
  "Criminal Defence", "Property Dispute", "Family Law", "Consumer Forum",
  "Civil Litigation", "Corporate Law", "RERA", "Motor Vehicles",
  "GST / Tax", "Other",
];

const COURTS = [
  "High Court of Telangana", "District Court Hyderabad", "District Court Warangal",
  "District Court Vijayawada", "District Court Visakhapatnam",
  "Family Court Hyderabad", "NCLT Hyderabad", "RERA Tribunal",
  "Consumer Forum", "Revenue Court", "Other",
];

// ── Types ────────────────────────────────────────────────────────────────────────────
interface LawyerCase {
  id: number; lawyer_id: number; title: string; case_type: string;
  description: string; client_name: string; court_name: string;
  cnr_number: string; status: string; created_at: string; documents?: LawyerDoc[];
}

interface LawyerDoc {
  id: number; case_id?: number; filename: string; file_type: string;
  file_url: string; content_text: string; ai_summary: string; notes?: string; created_at: string;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────────────────────
function DashboardSidebar({ location, onNav }: { location: string; onNav?: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    onNav?.();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-sidebar-primary">
          <Scale className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-bold text-base tracking-tight text-sidebar-foreground">LitigaForge AI</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">Lawyer Portal</p>
        {lawyerNav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? location === "/lawyer-dashboard" : location.startsWith(item.href);
          return (
            <Link key={item.id} href={item.href} onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer group ${active ? "bg-sidebar-accent text-sidebar-primary" : item.highlight ? "text-sidebar-primary/75" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active || item.highlight ? "hsl(var(--sidebar-primary))" : "hsl(var(--sidebar-foreground) / 0.4)" }} />
              <span className={cn("flex-1 font-medium", active && "font-semibold")}>{item.label}</span>
              {item.highlight && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-sidebar-primary text-sidebar-primary-foreground">AI</span>}
            </Link>
          );
        })}
        <div className="mt-5 mx-1 rounded-xl px-4 py-3 space-y-1.5 bg-sidebar-accent/40 border border-sidebar-border">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Bar Council Verified</span>
          </div>
          <p className="text-[11px] leading-relaxed text-sidebar-foreground/40">Your profile is verified by Telangana Bar Council.</p>
        </div>
        <div className="mt-4 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">Quick Access</p>
          <Link href="/ask" onClick={onNav} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"><MessageSquare className="w-3.5 h-3.5" /> Legal Q&amp;A</Link>
          <Link href="/free-documents" onClick={onNav} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"><ExternalLink className="w-3.5 h-3.5" /> Free Documents</Link>
        </div>
      </nav>

      {user && (
        <div className="flex-shrink-0 px-4 py-4 space-y-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-sidebar-accent border border-sidebar-primary/30">
              <User className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[11px] truncate text-sidebar-foreground/40">{user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-all text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/60">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, iconEl, iconBg, iconColor, borderColor }:
  { label: string; value: string | number; sub?: string; iconEl: React.ReactNode; iconBg: string; iconColor: string; borderColor: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm overflow-hidden relative hover:shadow-md transition-shadow" style={{ border: `1px solid ${borderColor}` }}>
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: iconColor }} />
      <div className="pt-1 flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <span style={{ color: iconColor }}>{iconEl}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-[11px] font-medium text-gray-500 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Modal wrapper ────────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-auto"
        style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#F1F5F9" }}>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────────────
export default function LawyerDashboard() {
  const { user, refreshUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [caseTab, setCaseTab] = useState<"active" | "pending" | "closed">("active");
  const [statusMenuCaseId, setStatusMenuCaseId] = useState<number | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<LawyerCase | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [preselectedCaseId, setPreselectedCaseId] = useState<string>("");
  const [analyzingDoc, setAnalyzingDoc] = useState<number | null>(null);
  const [folderCase, setFolderCase] = useState<LawyerCase | null>(null);
  const [folderDocs, setFolderDocs] = useState<LawyerDoc[]>([]);
  const [showFolder, setShowFolder] = useState(false);
  const [editingNotesDocId, setEditingNotesDocId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");


  // ── Verification polling ──
  useEffect(() => {
    if (user?.role !== "lawyer" || user?.is_verified) return;
    const id = setInterval(() => { refreshUser(); }, 30_000);
    return () => clearInterval(id);
  }, [user?.role, user?.is_verified, refreshUser]);

  // ── Queries ──
  const { data: lawyerCases } = useQuery({
    queryKey: ["lawyer-cases"],
    queryFn: () => apiFetch("/lawyer/cases"),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  const { data: lawyerDocs } = useQuery({
    queryKey: ["lawyer-documents"],
    queryFn: () => apiFetch("/lawyer/documents"),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  const { data: matchData } = useQuery({
    queryKey: ["lawyer-matches"],
    queryFn: () => apiFetch("/matches/lawyer"),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  const cases: LawyerCase[] = lawyerCases?.cases ?? [];
  const activeCases = cases.filter((c) => c.status === "active");
  const docs: LawyerDoc[] = lawyerDocs?.documents ?? [];
  const pendingLeads = Array.isArray(matchData)
    ? matchData.filter((m: { status: string }) => m.status === "pending")
    : [];

  // ── Mutations ──
  const createCaseMut = useMutation({
    mutationFn: (body: object) => apiFetch("/lawyer/cases", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-cases"] });
      setShowCaseModal(false);
    },
  });

  const createDocMut = useMutation({
    mutationFn: (body: object) => apiFetch("/lawyer/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-documents"] });
      setShowDocModal(false);
    },
  });

  const analyzeDocMut = useMutation({
    mutationFn: (docId: number) => apiFetch(`/lawyer/documents/${docId}/analyze`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lawyer-documents"] }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ caseId, status }: { caseId: number; status: string }) =>
      apiFetch(`/lawyer/cases/${caseId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-cases"] });
      setStatusMenuCaseId(null);
    },
  });

  const editCaseMut = useMutation({
    mutationFn: ({ caseId, body }: { caseId: number; body: object }) =>
      apiFetch(`/lawyer/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-cases"] });
      setEditingCase(null);
    },
  });

  const saveNotesMut = useMutation({
    mutationFn: ({ docId, notes }: { docId: number; notes: string }) =>
      apiFetch(`/lawyer/documents/${docId}/notes`, { method: "POST", body: JSON.stringify({ notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-documents"] });
      setEditingNotesDocId(null);
      setNoteDraft("");
    },
  });

  const isAdvocatePro = user?.subscription_tier === "advocate_pro";
  const lawyerFirstName = user?.name?.split(" ")[0] ?? "Advocate";

  const filteredCases = cases.filter((c) => c.status === caseTab);

  const stats = [
    { label: "Active Cases", value: cases.filter((c) => c.status === "active").length, sub: "in progress", iconEl: <Briefcase className="w-5 h-5" />, iconBg: "#EFF6FF", iconColor: "#2563EB", borderColor: "#DBEAFE" },
    { label: "Pending", value: cases.filter((c) => c.status === "pending").length, sub: "awaiting action", iconEl: <Clock className="w-5 h-5" />, iconBg: "#FEF3C7", iconColor: "#D97706", borderColor: "#FDE68A" },
    { label: "Closed", value: cases.filter((c) => c.status === "closed").length, sub: "resolved / archived", iconEl: <CheckCircle2 className="w-5 h-5" />, iconBg: "#ECFDF5", iconColor: "#059669", borderColor: "#D1FAE5" },
    { label: "Documents", value: docs.length, sub: "uploaded files", iconEl: <FileText className="w-5 h-5" />, iconBg: "#F5F3FF", iconColor: "#7C3AED", borderColor: "#EDE9FE" },
  ];

  // ── Verification wall ──
  if (user?.role === "lawyer" && !user?.is_verified) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#1a2744" }}>
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-xl font-bold text-gray-900">LitigaForge AI</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl bg-card shadow-lg border border-border px-8 py-10">
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}
            >
              <Hourglass className="w-7 h-7 text-blue-500" />
            </motion.div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Verification</h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Your advocate profile has been submitted. Our team will review your Bar Council credentials and
              verify your account — usually within 24 hours.
            </p>

            {/* Steps */}
            <div className="space-y-3 text-left mb-6">
              {[
                { label: "Profile submitted", done: true },
                { label: "Bar Council credentials review", done: false, active: true },
                { label: "Account activated", done: false },
              ].map(({ label, done, active }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: done ? "#ECFDF5" : active ? "#EFF6FF" : "#F1F5F9",
                      border: `1.5px solid ${done ? "#6EE7B7" : active ? "#93C5FD" : "#E2E8F0"}`,
                    }}
                  >
                    {done ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : active ? (
                      <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: done ? "#059669" : active ? "#2563EB" : "#94A3B8", fontWeight: active || done ? 600 : 400 }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Polling notice */}
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-blue-600 mb-4"
              style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>Checking for updates every 30 seconds — this page will refresh automatically once approved.</span>
            </div>

            <button
              onClick={() => refreshUser()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#1a2744", color: "#ffffff" }}
            >
              Check now
            </button>
          </div>

          {/* Footer */}
          <p className="mt-5 text-xs text-gray-400">
            Questions?{" "}
            <a href="mailto:support@litigaforge.ai" className="underline hover:text-gray-600">
              Contact support
            </a>
          </p>
          <button
            onClick={() => { logout(); }}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 px-4 md:px-6 py-5 space-y-5">

              {/* Welcome */}
              <div className="rounded-2xl px-5 py-4 border border-blue-100 bg-gradient-to-r from-white to-blue-50/60 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Welcome back, Advocate {lawyerFirstName} 👋</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Your AI-powered legal practice dashboard — Telangana &amp; AP courts</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdvocatePro ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                      <Shield className="w-3.5 h-3.5" /> Bar Council Verified
                    </span>
                  ) : (
                    <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Shield className="w-3.5 h-3.5" /> LitigaForge AI
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((s) => <StatCard key={s.label} {...s} />)}
              </div>

              {/* ── Quick Action Pills ── */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { label: "New Case", icon: Briefcase, action: () => setShowCaseModal(true), bg: "#EFF6FF", color: "#2563EB", border: "#DBEAFE" },
                  { label: "Upload Doc", icon: FileText, action: () => setShowDocModal(true), bg: "#F5F3FF", color: "#7C3AED", border: "#EDE9FE" },
                  { label: "AI Draft", icon: Sparkles, action: () => setLocation("/legal-chat"), bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
                  { label: "Find Client", icon: Users, action: () => setLocation("/matches"), bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" },
                ].map((pill) => (
                  <motion.button key={pill.label} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    onClick={pill.action} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                    style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}` }}>
                    <pill.icon className="w-3.5 h-3.5" /> {pill.label}
                  </motion.button>
                ))}
              </div>

              {/* ── Case Tabs + Search ── */}
              <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                <div className="px-4 pt-4 pb-0 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-1 bg-muted/70 rounded-xl p-1 flex-shrink-0">
                    {(["active","pending","closed"] as const).map((tab) => (
                      <button key={tab} onClick={() => setCaseTab(tab)}
                        className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                          caseTab === tab ? "bg-card shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                        {tab} <span className="ml-0.5 opacity-60">({cases.filter((c) => c.status === tab).length})</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search cases by title, client, court..."
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20" style={{ borderColor: "#E2E8F0" }} />
                  </div>
                  <button onClick={() => setShowCaseModal(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0 transition-all hover:shadow-sm" style={{ background: "#2563EB", color: "white" }}>
                    <Plus className="w-3.5 h-3.5" /> Add Case
                  </button>
                </div>

                {/* Case List */}
                <div className="p-4 pt-3">
                  {filteredCases.length === 0 ? (
                    <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                      <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No {caseTab} cases. <button onClick={() => setShowCaseModal(true)} className="text-blue-600 font-semibold hover:underline">Add one</button></p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredCases.filter((c) => {
                        const q = searchQuery.toLowerCase();
                        return !q || c.title.toLowerCase().includes(q) || c.client_name?.toLowerCase().includes(q) || c.court_name?.toLowerCase().includes(q) || c.case_type.toLowerCase().includes(q);
                      }).map((c) => (
                        <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-card rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow" 
                          style={{ border: "1px solid #F1F5F9", borderLeftColor: c.status === "active" ? "#10b981" : c.status === "pending" ? "#f59e0b" : "#94a3b8", borderLeftWidth: "3px" }}
                          onClick={() => { setFolderCase(c); setFolderDocs(docs.filter((d) => d.case_id === c.id)); setShowFolder(true); }}>
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#EFF6FF" }}>
                              <Briefcase className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{c.case_type}</span>
                                {c.cnr_number && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#F0F9FF", color: "#0284C7", border: "1px solid #BAE6FD" }}>
                                    <FileText className="w-2.5 h-2.5" /> CNR: {c.cnr_number}
                                  </span>
                                )}
                                {/* Status changer dropdown */}
                                <div className="relative inline-block">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setStatusMenuCaseId(statusMenuCaseId === c.id ? null : c.id); }}
                                    className={cn("flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                                      c.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                                        : c.status === "closed" ? "bg-muted text-gray-500 border border-border hover:bg-gray-200"
                                        : "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100")}>
                                    {c.status.toUpperCase()} <ChevronDown className="w-2.5 h-2.5" />
                                  </button>
                                  {statusMenuCaseId === c.id && (
                                    <div className="absolute top-full left-0 mt-1 z-20 bg-card rounded-lg shadow-lg border p-1 min-w-[110px]" style={{ borderColor: "#E2E8F0" }}>
                                      {(["active","pending","closed"] as const).map((s) => (
                                        <button key={s} onClick={(e) => { e.stopPropagation(); updateStatusMut.mutate({ caseId: c.id, status: s }); }}
                                          disabled={updateStatusMut.isPending}
                                          className={cn("w-full text-left text-[11px] font-semibold px-2.5 py-1.5 rounded-md capitalize transition-colors",
                                            c.status === s ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-background")}>
                                          {s}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {docs.filter((d) => d.case_id === c.id).length > 0 && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #EDE9FE" }}>
                                    <FileText className="w-2.5 h-2.5" /> {docs.filter((d) => d.case_id === c.id).length} doc{docs.filter((d) => d.case_id === c.id).length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{c.description || "No description added"}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                {c.client_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.client_name}</span>}
                                {c.court_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.court_name}</span>}
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); setEditingCase(c); }} className="text-gray-300 hover:text-blue-600 transition-colors mt-1" title="Edit case">
                                <PenSquare className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setPreselectedCaseId(String(c.id)); setShowDocModal(true); }} className="text-gray-300 hover:text-blue-600 transition-colors mt-1" title="Upload document">
                                <Upload className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Client Documents — grouped with case linkage */}
              {docs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">Client Documents</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Linked to cases — upload from any case card</p>
                    </div>
                    <button onClick={() => setShowDocModal(true)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Upload
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {docs.map((d) => {
                      const linkedCase = cases.find((c) => c.id === d.case_id);
                      return (
                        <motion.div key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-card rounded-xl p-4 shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#F5F3FF" }}>
                              <FileText className="w-4 h-4" style={{ color: "#7C3AED" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm">{d.filename}</span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #EDE9FE" }}>{d.file_type.toUpperCase()}</span>
                                {linkedCase ? (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>
                                    <Briefcase className="w-2.5 h-2.5" /> {linkedCase.title}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>Unlinked</span>
                                )}
                              </div>
                              {d.ai_summary ? (
                                <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">AI: {d.ai_summary}</p>
                              ) : (
                                <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">{d.content_text?.slice(0, 80) || "No content preview"}{d.content_text && d.content_text.length > 80 ? "…" : ""}</p>
                              )}
                              <p className="text-[11px] text-gray-400 mt-1">{new Date(d.created_at).toLocaleDateString("en-IN")}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!d.ai_summary && (
                                <button onClick={() => { setAnalyzingDoc(d.id); analyzeDocMut.mutate(d.id, { onSettled: () => setAnalyzingDoc(null) }); }}
                                  disabled={analyzeDocMut.isPending && analyzingDoc === d.id}
                                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-60">
                                  {analyzeDocMut.isPending && analyzingDoc === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  Analyze
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indian law hint */}
              <div className="rounded-xl p-4 flex gap-3" style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}>
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">AI trained on Indian law</p>
                  <p className="text-[12px] text-blue-700 mt-0.5 leading-relaxed">
                    AI references IPC, CrPC, CPC, Evidence Act, RERA, GST Act, Motor Vehicles Act,
                    and Consumer Protection Act. Always verify AI output before filing in Telangana / AP courts.
                  </p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl p-4 flex gap-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-relaxed">
                  <strong>Disclaimer:</strong> LitigaForge AI assists lawyers but does not provide legal advice.
                  All AI outputs must be reviewed and verified by a qualified advocate before use in court proceedings.
                  The platform connects clients to lawyers and is not a substitute for professional legal counsel.
                </p>
              </div>

            </main>

            {/* ── Right Sidebar ── */}
            <aside className="hidden xl:flex flex-col w-64 2xl:w-72 flex-shrink-0 overflow-auto px-4 py-5 space-y-4" style={{ borderLeft: "1px solid #F1F5F9", background: "#F8FAFC" }}>

              {/* Upcoming Deadlines */}
              <div className="bg-card rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FEF3C7" }}>
                    <Clock className="w-4 h-4" style={{ color: "#D97706" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Upcoming</p>
                    <p className="text-[11px] text-gray-400">Hearings & deadlines</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {cases.filter((c) => c.status === "active").slice(0, 3).map((c) => (
                    <button key={c.id} onClick={() => { setFolderCase(c); setFolderDocs(docs.filter((d) => d.case_id === c.id)); setShowFolder(true); }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-background transition-colors text-left">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#D97706" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-gray-800 truncate">{c.title}</p>
                        <p className="text-[11px] text-gray-400">{c.court_name || "Court TBD"}</p>
                      </div>
                    </button>
                  ))}
                  {cases.filter((c) => c.status === "active").length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-2">No upcoming hearings</p>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-card rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#ECFDF5" }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Recent Activity</p>
                </div>
                <div className="space-y-2.5">
                  {docs.slice().reverse().slice(0, 3).map((d) => {
                    const linkedCase = cases.find((c) => c.id === d.case_id);
                    return (
                      <div key={d.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#F5F3FF" }}>
                          <FileText className="w-3 h-3" style={{ color: "#7C3AED" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-800 truncate">{d.filename}</p>
                          <p className="text-[11px] text-gray-400">{linkedCase ? `Linked: ${linkedCase.title}` : "Unlinked document"}</p>
                          <p className="text-[10px] text-gray-300">{new Date(d.created_at).toLocaleDateString("en-IN")}</p>
                        </div>
                      </div>
                    );
                  })}
                  {docs.length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-2">No documents yet</p>
                  )}
                </div>
              </div>

              {/* Quick Research */}
              <div className="bg-card rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <p className="text-sm font-bold text-gray-900 mb-3">Quick Research</p>
                <div className="space-y-1">
                  {[{ label: "Search Judgments", icon: Gavel, href: "/judgments" },
                    { label: "Legal Q&A", icon: MessageSquare, href: "/ask" },
                    { label: "Document Analyzer", icon: FileSearch, href: "/review" },
                    { label: "Find Precedents", icon: BookOpen, href: "/judgments" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.label} onClick={() => setLocation(item.href)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors text-[12px] font-medium text-left">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.label} <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upgrade */}
              {!isAdvocatePro && (
                <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-[#1a2744] to-[#0f1a35] border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <p className="font-bold text-sm">Upgrade to Advocate Pro</p>
                  </div>
                  <p className="text-[11px] mb-3 leading-relaxed text-blue-200">Unlimited AI credits, verified badge, priority client matches, WhatsApp alerts.</p>
                  <button onClick={() => setLocation("/subscription")} className="w-full text-xs font-bold py-2.5 rounded-lg transition-colors bg-amber-400 hover:bg-amber-300 text-[#1a2744]">Upgrade — ₹2,499/mo</button>
                </div>
              )}

              {/* NALSA Helpline */}
              <a href="tel:15100" className="rounded-xl p-3 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800">NALSA Free Legal Aid</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Toll-free: 15100</p>
                </div>
              </a>

      </aside>

      {/* ── Add Case Modal ── */}
      <Modal open={showCaseModal} onClose={() => setShowCaseModal(false)} title="Add New Case">
        <CaseForm onSubmit={(data) => createCaseMut.mutate(data)} loading={createCaseMut.isPending} />
      </Modal>

      {/* ── Edit Case Modal ── */}
      <Modal open={!!editingCase} onClose={() => setEditingCase(null)} title="Edit Case">
        <CaseForm
          initialCase={editingCase}
          onSubmit={(data) => editingCase && editCaseMut.mutate({ caseId: editingCase.id, body: data })}
          loading={editCaseMut.isPending}
        />
      </Modal>

      {/* ── Upload Document Modal ── */}
      <Modal open={showDocModal} onClose={() => { setShowDocModal(false); setPreselectedCaseId(""); }} title="Upload Client Document">
        <DocForm cases={cases} preselectedCaseId={preselectedCaseId} onSubmit={(data) => createDocMut.mutate(data)} loading={createDocMut.isPending} />
      </Modal>

      {/* ── Case Folder Modal ── */}
      <CaseFolderModal
        open={showFolder}
        onClose={() => setShowFolder(false)}
        caseData={folderCase}
        docs={folderDocs}
        onUpload={() => { setShowFolder(false); setShowDocModal(true); }}
        onAnalyze={(docId: number) => { setAnalyzingDoc(docId); analyzeDocMut.mutate(docId, { onSettled: () => setAnalyzingDoc(null) }); }}
        analyzingDoc={analyzingDoc}
        analyzePending={analyzeDocMut.isPending}
        onSaveNotes={(docId: number, notes: string) => saveNotesMut.mutate({ docId, notes })}
        notesPending={saveNotesMut.isPending}
      />

    </div>
  );
}

// ── Document Actions (shared) ─────────────────────────────────────────────────────────────────────────────
function DocumentActions({
  doc,
  onDownload,
  onShare,
  onNotes,
  onAnalyze,
  analyzing,
}: {
  doc: LawyerDoc;
  onDownload: () => void;
  onShare: () => void;
  onNotes: () => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-muted transition-colors"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 w-40 bg-card rounded-xl shadow-xl z-30 py-1"
            style={{ border: "1px solid #E2E8F0" }}
          >
            <button onClick={() => { onDownload(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-blue-50 transition-colors text-left">
              <Download className="w-3.5 h-3.5 text-blue-600" /> Download
            </button>
            <button onClick={() => { onShare(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-blue-50 transition-colors text-left">
              <Share2 className="w-3.5 h-3.5 text-emerald-600" /> Share / Forward
            </button>
            <button onClick={() => { onNotes(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-blue-50 transition-colors text-left">
              <StickyNote className="w-3.5 h-3.5 text-amber-600" /> Add Notes
            </button>
            {onAnalyze && !doc.ai_summary && (
              <button onClick={() => { onAnalyze(); setShowMenu(false); }} disabled={analyzing}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-blue-50 transition-colors text-left disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" /> {analyzing ? "Analyzing..." : "AI Analyze"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function downloadDoc(doc: LawyerDoc) {
  const blob = new Blob([doc.content_text || "No content"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function shareDoc(doc: LawyerDoc) {
  const shareText = `Document: ${doc.filename}\nType: ${doc.file_type.toUpperCase()}\nContent:\n${doc.content_text?.slice(0, 500) || "No content"}${doc.content_text && doc.content_text.length > 500 ? "\n..." : ""}`;
  navigator.clipboard.writeText(shareText).then(() => {
    alert("Document copied to clipboard! Paste in email, WhatsApp, or court filing.");
  }).catch(() => {
    alert("Could not copy. Copy manually from the document preview.");
  });
}

// ── Case Folder Modal ────────────────────────────────────────────────────────────────────────────────
function CaseFolderModal({
  open, onClose, caseData, docs, onUpload, onAnalyze, analyzingDoc, analyzePending, onSaveNotes, notesPending,
}: {
  open: boolean; onClose: () => void; caseData: LawyerCase | null; docs: LawyerDoc[];
  onUpload: () => void;
  onAnalyze: (docId: number) => void;
  analyzingDoc: number | null;
  analyzePending: boolean;
  onSaveNotes: (docId: number, notes: string) => void;
  notesPending: boolean;
}) {
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card z-10 px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}>
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg leading-tight">{caseData.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{caseData.case_type}</span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  caseData.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : caseData.status === "closed" ? "bg-muted text-gray-500 border border-border"
                    : "bg-amber-50 text-amber-600 border border-amber-200")}>{caseData.status.toUpperCase()}</span>
                {caseData.cnr_number && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#F0F9FF", color: "#0284C7", border: "1px solid #BAE6FD" }}>
                    <FileText className="w-2.5 h-2.5" /> CNR: {caseData.cnr_number}
                  </span>
                )}
                <span className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{caseData.court_name || "No court"}</span>
              </div>
              <p className="text-[12px] text-gray-500 mt-1">{caseData.description || "No description"}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Client: {caseData.client_name || "N/A"} · Added {new Date(caseData.created_at).toLocaleDateString("en-IN")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onUpload} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white transition-colors" style={{ background: "#2563EB" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1D4ED8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2563EB"; }}>
              <Plus className="w-3.5 h-3.5" /> Upload
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Documents */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 text-sm">Case Documents ({docs.length})</h4>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No documents in this case folder yet.</p>
              <button onClick={onUpload} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Upload your first document →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <motion.div key={d.id} layout className="rounded-xl border overflow-hidden" style={{ borderColor: "#F1F5F9" }}>
                  {/* Doc header */}
                  <div className="flex items-start gap-3 p-3.5 bg-card">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#F5F3FF" }}>
                      <FileText className="w-4 h-4" style={{ color: "#7C3AED" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{d.filename}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #EDE9FE" }}>{d.file_type.toUpperCase()}</span>
                        {d.ai_summary && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">AI Analyzed</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{new Date(d.created_at).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setExpandedDoc(expandedDoc === d.id ? null : d.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                        {expandedDoc === d.id ? "Collapse" : "View"}
                      </button>
                      <DocumentActions
                        doc={d}
                        onDownload={() => downloadDoc(d)}
                        onShare={() => shareDoc(d)}
                        onNotes={() => { setEditingNotes(d.id); setNoteText(d.notes || ""); }}
                        onAnalyze={d.ai_summary ? undefined : () => onAnalyze(d.id)}
                        analyzing={analyzePending && analyzingDoc === d.id}
                      />
                    </div>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {expandedDoc === d.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="px-4 pb-4 pt-0 bg-card" style={{ borderTop: "1px solid #F8FAFC" }}>
                          {/* Content preview */}
                          <div className="mt-3 rounded-lg p-3 font-mono text-[12px] leading-relaxed text-gray-600" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", maxHeight: "200px", overflow: "auto" }}>
                            {d.content_text || "No text content available."}
                          </div>

                          {/* Notes section */}
                          {editingNotes === d.id ? (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-semibold text-gray-700">Your Notes</span>
                              </div>
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                rows={3}
                                placeholder="Add observations, strategy reminders, hearing notes..."
                                className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-amber-400 transition-colors resize-none"
                                style={{ borderColor: "#E2E8F0" }}
                              />
                              <div className="flex items-center gap-2">
                                <button onClick={() => { onSaveNotes(d.id, noteText); setEditingNotes(null); }} disabled={notesPending}
                                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-60">
                                  <Check className="w-3 h-3" /> Save Notes
                                </button>
                                <button onClick={() => { setEditingNotes(null); setNoteText(""); }}
                                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : d.notes ? (
                            <div className="mt-3 rounded-lg p-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                              <div className="flex items-center gap-2 mb-1">
                                <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-semibold text-amber-800">Your Notes</span>
                                <button onClick={() => { setEditingNotes(d.id); setNoteText(d.notes || ""); }}
                                  className="ml-auto text-[10px] text-amber-600 hover:text-amber-800 font-medium">Edit</button>
                              </div>
                              <p className="text-[12px] text-amber-700 leading-relaxed whitespace-pre-wrap">{d.notes}</p>
                            </div>
                          ) : null}

                          {/* AI Summary */}
                          {d.ai_summary && (
                            <div className="mt-3 rounded-lg p-3" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                              <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-semibold text-emerald-800">AI Analysis Summary</span>
                              </div>
                              <p className="text-[12px] text-emerald-700 leading-relaxed">{d.ai_summary}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Case Form ────────────────────────────────────────────────────────────────────────────────
function CaseForm({ onSubmit, loading, initialCase }: { onSubmit: (data: object) => void; loading: boolean; initialCase?: LawyerCase | null }) {
  const isEdit = !!initialCase;
  const [title, setTitle] = useState(initialCase?.title ?? "");
  const [caseType, setCaseType] = useState(initialCase?.case_type ?? CASE_TYPES[0]);
  const [clientName, setClientName] = useState(initialCase?.client_name ?? "");
  const [courtName, setCourtName] = useState(initialCase?.court_name ?? COURTS[0]);
  const [cnrNumber, setCnrNumber] = useState(initialCase?.cnr_number ?? "");
  const [description, setDescription] = useState(initialCase?.description ?? "");
  const [status, setStatus] = useState(initialCase?.status ?? "active");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, case_type: caseType, client_name: clientName, court_name: courtName, cnr_number: cnrNumber, description, status });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Case Title *</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Ravi vs. State of Telangana"
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors" style={{ borderColor: "#E2E8F0" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Case Type</label>
          <button type="button" onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-lg border focus:outline-none" style={{ borderColor: "#E2E8F0" }}>
            {caseType} <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {showTypeDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-card rounded-lg shadow-lg border py-1" style={{ borderColor: "#E2E8F0", maxHeight: "200px", overflow: "auto" }}>
              {CASE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => { setCaseType(t); setShowTypeDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors">{t}</button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Court</label>
          <button type="button" onClick={() => setShowCourtDropdown(!showCourtDropdown)}
            className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-lg border focus:outline-none" style={{ borderColor: "#E2E8F0" }}>
            {courtName} <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {showCourtDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-card rounded-lg shadow-lg border py-1" style={{ borderColor: "#E2E8F0", maxHeight: "200px", overflow: "auto" }}>
              {COURTS.map((c) => (
                <button key={c} type="button" onClick={() => { setCourtName(c); setShowCourtDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors">{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Client Name</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g., Ravi Shankar"
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors" style={{ borderColor: "#E2E8F0" }} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">CNR Number</label>
          <input value={cnrNumber} onChange={(e) => setCnrNumber(e.target.value)} placeholder="e.g., AP0101234567890"
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors" style={{ borderColor: "#E2E8F0" }} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief case facts..."
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors resize-none" style={{ borderColor: "#E2E8F0" }} />
      </div>
      {isEdit && (
        <div className="grid grid-cols-3 gap-2">
          {(["active","pending","closed"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={cn("text-[11px] font-bold px-2 py-2 rounded-lg capitalize transition-all",
                status === s
                  ? s === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : s === "closed" ? "bg-muted text-gray-700 border border-border"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-background text-gray-400 border border-border hover:border-border")}>
              {s}
            </button>
          ))}
        </div>
      )}
      <button type="submit" disabled={loading || !title.trim()}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <PenSquare className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {isEdit ? "Save Changes" : "Add Case"}
      </button>
    </form>
  );
}

// ── Document Form ───────────────────────────────────────────────────────────────────────────────
function DocForm({ cases, onSubmit, loading, preselectedCaseId }: { cases: LawyerCase[]; onSubmit: (data: object) => void; loading: boolean; preselectedCaseId?: string }) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [filename, setFilename] = useState("");
  const [contentText, setContentText] = useState("");
  const [caseId, setCaseId] = useState<string>(preselectedCaseId ?? "");
  const [fileType, setFileType] = useState("pdf");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setFileType(file.name.split(".").pop()?.toLowerCase() || "txt");
    // Read text content if possible
    if (file.type.includes("text") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => setContentText(String(ev.target?.result || ""));
      reader.readAsText(file);
    } else {
      setContentText(`[Uploaded file: ${file.name}, size: ${(file.size / 1024).toFixed(1)} KB]`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim() && !contentText.trim()) return;
    const name = filename.trim() || "Untitled Document";
    onSubmit({ case_id: caseId ? parseInt(caseId) : null, filename: name, file_type: fileType, content_text: contentText, file_url: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: "#F1F5F9" }}>
        <button type="button" onClick={() => setTab("paste")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "paste" ? "bg-card shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Paste Text</button>
        <button type="button" onClick={() => setTab("upload")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "upload" ? "bg-card shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Upload File</button>
      </div>

      {/* Case selector */}
      {cases.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Link to Case (optional)</label>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors bg-card" style={{ borderColor: "#E2E8F0" }}>
            <option value="">No case — general document</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}

      {tab === "paste" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Document Name *</label>
            <input required value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="e.g., FIR_2024_001.txt"
              className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors" style={{ borderColor: "#E2E8F0" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Document Content *</label>
            <textarea required value={contentText} onChange={(e) => setContentText(e.target.value)} rows={6}
              placeholder="Paste FIR text, charge sheet, contract, or legal notice here..."
              className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors resize-none font-mono" style={{ borderColor: "#E2E8F0" }} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select File</label>
            <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:bg-violet-50 hover:border-violet-300"
              style={{ borderColor: "#E9D5FF" }} onClick={() => fileRef.current?.click()}>
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "#A78BFA" }} />
              <p className="text-sm font-medium text-gray-600">{filename || "Click to select .txt, .pdf, .doc"}</p>
              <p className="text-[11px] text-gray-400 mt-1">Max 25MB — text extracted for AI analysis</p>
              <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          {contentText && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Extracted Content Preview</label>
              <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} rows={4}
                className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors resize-none font-mono" style={{ borderColor: "#E2E8F0" }} />
            </div>
          )}
        </>
      )}

      <button type="submit" disabled={loading || (!filename.trim() && !contentText.trim())}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Save Document
      </button>
    </form>
  );
}
