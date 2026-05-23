import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Star, Briefcase, Users, FileText, BookOpen, User,
  Search, Bell, ChevronRight, Plus, Upload, Zap, CheckCircle2,
  Menu, X, LogOut, MessageSquare, ExternalLink, Info, ArrowRight,
  FileSearch, Gavel, Phone, Award, AlertTriangle, IndianRupee,
  Shield, MapPin, Clock, XCircle, Loader2, Trash2, Sparkles,
  FolderOpen, PenSquare, ChevronDown, Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Sidebar Nav ──────────────────────────────────────────────────────────────
const lawyerNav = [
  { id: "forge",    label: "AI Forge",           icon: Star,      href: "/",            highlight: true },
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
  status: string; created_at: string; documents?: LawyerDoc[];
}

interface LawyerDoc {
  id: number; case_id?: number; filename: string; file_type: string;
  file_url: string; content_text: string; ai_summary: string; created_at: string;
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
    <div className="flex flex-col h-full" style={{ background: "#1a2744" }}>
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FBBF24" }}>
          <Scale className="w-4 h-4" style={{ color: "#1a2744" }} />
        </div>
        <span className="text-white font-bold text-base tracking-tight">LitigaForge AI</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Lawyer Portal</p>
        {lawyerNav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? location === "/lawyer-dashboard" : location.startsWith(item.href);
          return (
            <Link key={item.id} href={item.href} onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer group"
              style={{ background: active ? "rgba(251,191,36,0.15)" : "transparent", color: active ? "#FBBF24" : item.highlight ? "rgba(251,191,36,0.75)" : "rgba(255,255,255,0.6)" }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active || item.highlight ? "#FBBF24" : "rgba(255,255,255,0.4)" }} />
              <span className={cn("flex-1 font-medium", active && "font-semibold")}>{item.label}</span>
              {item.highlight && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ background: "#FBBF24", color: "#1a2744" }}>AI</span>}
            </Link>
          );
        })}
        <div className="mt-5 mx-1 rounded-xl px-4 py-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" style={{ color: "#34D399" }} />
            <span className="text-xs font-semibold" style={{ color: "#34D399" }}>Bar Council Verified</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>Your profile is verified by Telangana Bar Council.</p>
        </div>
        <div className="mt-4 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Quick Access</p>
          <Link href="/ask" onClick={onNav} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-white/45 hover:text-white hover:bg-white/6 transition-colors"><MessageSquare className="w-3.5 h-3.5" /> Legal Q&amp;A</Link>
          <Link href="/chains" onClick={onNav} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-white/45 hover:text-white hover:bg-white/6 transition-colors"><ExternalLink className="w-3.5 h-3.5" /> eCourts &amp; API Chains</Link>
        </div>
      </nav>

      {user && (
        <div className="flex-shrink-0 px-4 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <User className="w-4 h-4" style={{ color: "#FBBF24" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-all" style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
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
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${borderColor}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <span style={{ color: iconColor }}>{iconEl}</span>
        </div>
      </div>
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-auto"
        style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#F1F5F9" }}>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
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
  const { user } = useAuth();
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [analyzingDoc, setAnalyzingDoc] = useState<number | null>(null);

  useEffect(() => { setDrawerOpen(false); }, [location]);

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
      setCompletedSteps((prev) => [...new Set([...prev, 1])]);
    },
  });

  const createDocMut = useMutation({
    mutationFn: (body: object) => apiFetch("/lawyer/documents", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-documents"] });
      setShowDocModal(false);
      setCompletedSteps((prev) => [...new Set([...prev, 2])]);
    },
  });

  const analyzeDocMut = useMutation({
    mutationFn: (docId: number) => apiFetch(`/lawyer/documents/${docId}/analyze`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lawyer-documents"] }),
  });

  const isAdvocatePro = user?.subscription_tier === "advocate_pro";
  const lawyerFirstName = user?.name?.split(" ")[0] ?? "Advocate";

  const toggleStep = (step: number) =>
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );

  const stats = [
    { label: "Active Cases", value: activeCases.length, sub: "in court / ongoing", iconEl: <Briefcase className="w-5 h-5" />, iconBg: "#EFF6FF", iconColor: "#2563EB", borderColor: "#DBEAFE" },
    { label: "New Leads", value: pendingLeads.length, sub: "awaiting response", iconEl: <Users className="w-5 h-5" />, iconBg: "#ECFDF5", iconColor: "#059669", borderColor: "#D1FAE5" },
    { label: "AI Credits Used", value: user?.cases_this_month ?? 0, sub: "this month", iconEl: <Zap className="w-5 h-5" />, iconBg: "#F5F3FF", iconColor: "#7C3AED", borderColor: "#EDE9FE" },
    { label: "Documents", value: docs.length, sub: "uploaded files", iconEl: <FileText className="w-5 h-5" />, iconBg: "#FFFBEB", iconColor: "#D97706", borderColor: "#FEF3C7" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setDrawerOpen(false)} />
            <motion.aside key="drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden shadow-2xl">
              <button className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
                onClick={() => setDrawerOpen(false)}><X className="w-3.5 h-3.5" /></button>
              <DashboardSidebar location={location} onNav={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 lg:w-64 flex-shrink-0 flex-col shadow-lg">
        <DashboardSidebar location={location} />
      </aside>

      {/* ── Main Column ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Nav ── */}
        <header className="flex-shrink-0 h-14 flex items-center gap-3 px-4 md:px-6 shadow-md z-10" style={{ background: "#1E3A8A", color: "white" }}>
          <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} onClick={() => setDrawerOpen(true)}>
            <Menu className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <Scale className="w-5 h-5" style={{ color: "#FBBF24" }} />
            <span className="font-bold text-sm text-white">LitigaForge AI</span>
          </div>
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.45)" }} />
              <input type="text" placeholder="Search Cases, Clients or Laws..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 pr-4 py-2 rounded-lg focus:outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(251,191,36,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }} />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}>
              <BookOpen className="w-3 h-3" /> IPC · CrPC · eCourts
            </span>
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Bell className="w-4 h-4 text-white" />
              {pendingLeads.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: "#FBBF24", color: "#1a2744" }}>{pendingLeads.length}</span>
              )}
            </button>
            <button onClick={() => setLocation("/subscription")} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#FBBF24" }}>
                <User className="w-3.5 h-3.5" style={{ color: "#1a2744" }} />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight text-white truncate max-w-[80px]">{user?.name ?? "Advocate"}</p>
                <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>{isAdvocatePro ? "Advocate Pro" : "Free Plan"}</p>
              </div>
            </button>
          </div>
        </header>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-auto">
          <div className="flex h-full">

            {/* ── Main Content ── */}
            <main className="flex-1 min-w-0 overflow-auto px-4 md:px-6 py-5 space-y-5">

              {/* Welcome */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Welcome back, Advocate {lawyerFirstName} 👋</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Your AI-powered legal practice dashboard — Telangana &amp; AP courts</p>
                </div>
                {isAdvocatePro && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                    <Shield className="w-3.5 h-3.5" /> Bar Council Verified
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((s) => <StatCard key={s.label} {...s} />)}
              </div>

              {/* Launch AI Forge CTA */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl p-5 md:p-6 shadow-lg" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #1d4ed8 100%)" }}>
                <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.04)" }} />
                <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full pointer-events-none blur-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
                <Scale className="absolute right-0 top-0 w-36 h-36 pointer-events-none opacity-5 text-white" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4" style={{ color: "#FBBF24" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#FBBF24" }}>AI Forge</span>
                    </div>
                    <h2 className="text-white font-bold text-lg md:text-xl leading-snug">Set up your AI Forge for better practice</h2>
                    <p className="text-sm mt-1 max-w-md leading-relaxed" style={{ color: "#BFDBFE" }}>
                      AI Forge helps you analyze documents, draft pleadings, research IPC/CrPC cases, and manage client matters efficiently.
                    </p>
                  </div>
                  <button onClick={() => setLocation("/")} className="flex items-center gap-2 font-bold px-5 py-3 rounded-xl transition-all shadow-lg text-sm flex-shrink-0 self-start sm:self-center hover:-translate-y-0.5 hover:shadow-xl" style={{ background: "#FBBF24", color: "#1a2744" }}>
                    <Zap className="w-4 h-4" /> Launch AI Forge <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>

              {/* Getting Started Steps — now functional */}
              <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Get started in 3 steps</h3>
                  <span className="ml-auto text-xs text-gray-400">{completedSteps.length}/3 done</span>
                </div>
                <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: "#F1F5F9" }}>
                  <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #2563EB, #1D4ED8)" }}
                    initial={{ width: 0 }} animate={{ width: `${(completedSteps.length / 3) * 100}%` }} transition={{ duration: 0.4 }} />
                </div>
                <div className="space-y-3">
                  {[
                    { step: 1, title: "Connect your cases", desc: "Add a new case to your practice.", icon: Briefcase, action: () => setShowCaseModal(true) },
                    { step: 2, title: "Upload client documents", desc: "Paste or upload FIRs, charge sheets, contracts.", icon: FileText, action: () => setShowDocModal(true) },
                    { step: 3, title: "Start using AI Forge", desc: "Draft pleadings, research IPC/CrPC, generate strategy.", icon: Zap, action: () => setLocation("/") },
                  ].map((s) => {
                    const isDone = completedSteps.includes(s.step);
                    const Icon = s.icon;
                    return (
                      <motion.div key={s.step} whileHover={{ x: 2 }} onClick={() => { toggleStep(s.step); s.action(); }}
                        className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                        style={{ background: isDone ? "#ECFDF5" : "#F8FAFC", border: `1px solid ${isDone ? "#A7F3D0" : "#F1F5F9"}` }}
                        onMouseEnter={(e) => { if (!isDone) { (e.currentTarget as HTMLDivElement).style.borderColor = "#DBEAFE"; (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF"; } }}
                        onMouseLeave={(e) => { if (!isDone) { (e.currentTarget as HTMLDivElement).style.borderColor = "#F1F5F9"; (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; } }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: isDone ? "#059669" : "white", border: isDone ? "none" : "2px solid #E2E8F0" }}>
                          {isDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs font-bold text-gray-400">{s.step}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold text-sm", isDone ? "text-emerald-800 line-through" : "text-gray-900")}>{s.title}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{s.desc}</p>
                        </div>
                        <Icon className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: isDone ? "#059669" : "#D1D5DB" }} />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* My Cases list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">My Cases</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Cases added to your practice</p>
                  </div>
                  <button onClick={() => setShowCaseModal(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Case
                  </button>
                </div>
                {cases.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                    <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No cases yet. Click "Add Case" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cases.map((c) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#EFF6FF" }}>
                            <Briefcase className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{c.case_type}</span>
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                c.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                  : c.status === "closed" ? "bg-gray-100 text-gray-500 border border-gray-200"
                                  : "bg-amber-50 text-amber-600 border border-amber-200")}>{c.status.toUpperCase()}</span>
                            </div>
                            <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{c.description || "No description"}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                              {c.client_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.client_name}</span>}
                              {c.court_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.court_name}</span>}
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>
                          <button onClick={() => setShowDocModal(true)} className="text-gray-300 hover:text-blue-600 transition-colors flex-shrink-0 mt-1" title="Upload document to case">
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Documents */}
              {docs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">Client Documents</h3>
                    <button onClick={() => setShowDocModal(true)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Upload
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {docs.map((d) => (
                      <motion.div key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#F5F3FF" }}>
                            <FileText className="w-4 h-4" style={{ color: "#7C3AED" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">{d.filename}</span>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #EDE9FE" }}>{d.file_type.toUpperCase()}</span>
                            </div>
                            {d.ai_summary && <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">AI: {d.ai_summary}</p>}
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
                    ))}
                  </div>
                </div>
              )}

              {/* Indian law hint */}
              <div className="rounded-xl p-4 flex gap-3" style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}>
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">AI trained on Indian law</p>
                  <p className="text-[12px] text-blue-700 mt-0.5 leading-relaxed">
                    AI Forge references IPC, CrPC, CPC, Evidence Act, RERA, GST Act, Motor Vehicles Act,
                    Consumer Protection Act, and live eCourts India case data. Always verify AI output before filing in Telangana / AP courts.
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

              {/* Active Cases */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Active Cases</p>
                      <p className="text-[11px] text-gray-400">In progress</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-700">{activeCases.length}</span>
                </div>
                <div className="h-px mb-3" style={{ background: "#F8FAFC" }} />
                <button onClick={() => setShowCaseModal(true)} className="w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors" style={{ background: "#2563EB" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1D4ED8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2563EB"; }}>
                  <Plus className="w-3.5 h-3.5" /> Add New Case
                </button>
                <button onClick={() => setLocation("/cases")} className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium py-2 rounded-lg transition-colors text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                  View all cases <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Client Documents */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F5F3FF" }}>
                    <FileText className="w-4 h-4" style={{ color: "#7C3AED" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Client Documents</p>
                    <p className="text-[11px] text-gray-400">Upload for AI analysis</p>
                  </div>
                </div>
                <div className="rounded-xl p-4 text-center mb-3 cursor-pointer transition-colors" style={{ border: "2px dashed #E9D5FF" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#A78BFA"; (e.currentTarget as HTMLDivElement).style.background = "#F5F3FF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#E9D5FF"; (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  onClick={() => setShowDocModal(true)}>
                  <Upload className="w-6 h-6 mx-auto mb-1.5" style={{ color: "#D1D5DB" }} />
                  <p className="text-[11px] text-gray-400">FIRs, charge sheets, contracts</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Paste text or upload file</p>
                </div>
                <button onClick={() => setShowDocModal(true)} className="w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors" style={{ background: "#7C3AED" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#6D28D9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7C3AED"; }}>
                  <Upload className="w-3.5 h-3.5" /> Upload &amp; Analyze
                </button>
              </div>

              {/* Quick Research */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <p className="text-sm font-bold text-gray-900 mb-3">Quick Research</p>
                <div className="space-y-1.5">
                  {[{ label: "Search Judgments", icon: Gavel, href: "/judgments" },
                    { label: "Legal Q&A", icon: MessageSquare, href: "/ask" },
                    { label: "eCourts Lookup", icon: FileSearch, href: "/chains" }].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.label} onClick={() => setLocation(item.href)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors text-[13px] font-medium text-left">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.label} <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upgrade */}
              {!isAdvocatePro && (
                <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                  <Award className="w-6 h-6 mb-2" style={{ color: "#FBBF24" }} />
                  <p className="font-bold text-sm mb-1">Upgrade to Advocate Pro</p>
                  <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#BFDBFE" }}>Unlimited AI credits, verified badge, priority client matches, WhatsApp alerts.</p>
                  <button onClick={() => setLocation("/subscription")} className="w-full text-xs font-bold py-2 rounded-lg transition-colors" style={{ background: "#FBBF24", color: "#1a2744" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FCD34D"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FBBF24"; }}>Upgrade — ₹2,499/mo</button>
                </div>
              )}

              {/* NALSA */}
              <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: "#F1F5F9" }}>
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-700">NALSA Free Legal Aid</p>
                  <p className="text-[11px] text-gray-500">Toll-free: 15100</p>
                </div>
              </div>

            </aside>

          </div>
        </div>
      </div>

      {/* ── Add Case Modal ── */}
      <Modal open={showCaseModal} onClose={() => setShowCaseModal(false)} title="Add New Case">
        <CaseForm onSubmit={(data) => createCaseMut.mutate(data)} loading={createCaseMut.isPending} />
      </Modal>

      {/* ── Upload Document Modal ── */}
      <Modal open={showDocModal} onClose={() => setShowDocModal(false)} title="Upload Client Document">
        <DocForm cases={cases} onSubmit={(data) => createDocMut.mutate(data)} loading={createDocMut.isPending} />
      </Modal>

    </div>
  );
}

// ── Case Form ────────────────────────────────────────────────────────────────────────────────
function CaseForm({ onSubmit, loading }: { onSubmit: (data: object) => void; loading: boolean }) {
  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState(CASE_TYPES[0]);
  const [clientName, setClientName] = useState("");
  const [courtName, setCourtName] = useState(COURTS[0]);
  const [description, setDescription] = useState("");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCourtDropdown, setShowCourtDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, case_type: caseType, client_name: clientName, court_name: courtName, description, status: "active" });
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
            <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border py-1" style={{ borderColor: "#E2E8F0", maxHeight: "200px", overflow: "auto" }}>
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
            <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border py-1" style={{ borderColor: "#E2E8F0", maxHeight: "200px", overflow: "auto" }}>
              {COURTS.map((c) => (
                <button key={c} type="button" onClick={() => { setCourtName(c); setShowCourtDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors">{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Client Name</label>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g., Ravi Shankar"
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors" style={{ borderColor: "#E2E8F0" }} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief case facts..."
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors resize-none" style={{ borderColor: "#E2E8F0" }} />
      </div>
      <button type="submit" disabled={loading || !title.trim()}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Case
      </button>
    </form>
  );
}

// ── Document Form ───────────────────────────────────────────────────────────────────────────────
function DocForm({ cases, onSubmit, loading }: { cases: LawyerCase[]; onSubmit: (data: object) => void; loading: boolean }) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [filename, setFilename] = useState("");
  const [contentText, setContentText] = useState("");
  const [caseId, setCaseId] = useState<string>("");
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
        <button type="button" onClick={() => setTab("paste")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "paste" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Paste Text</button>
        <button type="button" onClick={() => setTab("upload")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "upload" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Upload File</button>
      </div>

      {/* Case selector */}
      {cases.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Link to Case (optional)</label>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-blue-400 transition-colors bg-white" style={{ borderColor: "#E2E8F0" }}>
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
