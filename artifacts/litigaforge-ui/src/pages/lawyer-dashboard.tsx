import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Star, Briefcase, Users, FileText, BookOpen, User,
  Search, Bell, ChevronRight, Plus, Upload, Zap, CheckCircle2,
  Menu, X, LogOut, MessageSquare, ExternalLink, Info, ArrowRight,
  FileSearch, Gavel, Phone, Award, AlertTriangle, IndianRupee,
  Shield, MapPin, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// ── Sidebar Nav ──────────────────────────────────────────────────────────────
const lawyerNav = [
  { id: "forge",    label: "AI Forge",           icon: Star,      href: "/",            highlight: true },
  { id: "cases",    label: "My Cases",            icon: Briefcase, href: "/cases" },
  { id: "leads",    label: "Client Requests",     icon: Users,     href: "/matches" },
  { id: "docs",     label: "Documents & Files",   icon: FileText,  href: "/review" },
  { id: "research", label: "Research Assistant",  icon: BookOpen,  href: "/judgments" },
  { id: "profile",  label: "Profile & Earnings",  icon: User,      href: "/subscription" },
];

// ── Sample Leads (shown when no real data yet) ───────────────────────────────
const SAMPLE_LEADS = [
  {
    id: 1, name: "Ravi Shankar", type: "Criminal Defence", location: "Hyderabad",
    budget: "₹15,000 – ₹25,000", time: "2 hrs ago", urgent: true,
    detail: "FIR filed under IPC 420, needs urgent bail hearing.",
  },
  {
    id: 2, name: "Priya Reddy", type: "Property Dispute", location: "Warangal",
    budget: "₹20,000 – ₹40,000", time: "5 hrs ago", urgent: false,
    detail: "Revenue court dispute, all documents ready for review.",
  },
  {
    id: 3, name: "Mohammed Iqbal", type: "Consumer Forum", location: "Vijayawada",
    budget: "₹8,000 – ₹12,000", time: "Yesterday", urgent: false,
    detail: "RERA complaint against builder, project delayed 3 years.",
  },
];

// ── Setup Steps ──────────────────────────────────────────────────────────────
const SETUP_STEPS = [
  { step: 1, title: "Connect your cases",    desc: "Import from eCourts or add cases manually.",                    icon: Briefcase },
  { step: 2, title: "Upload client documents", desc: "PDFs, FIRs, charge sheets — AI reads and extracts key facts.", icon: FileText },
  { step: 3, title: "Start using AI Forge",  desc: "Draft pleadings, research IPC/CrPC, generate legal strategy.",  icon: Zap },
];

// ── Sidebar ─────────────────────────────────────────────────────────────────
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
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FBBF24" }}>
          <Scale className="w-4 h-4" style={{ color: "#1a2744" }} />
        </div>
        <span className="text-white font-bold text-base tracking-tight">LitigaForge AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
          Lawyer Portal
        </p>
        {lawyerNav.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/"
            ? location === "/lawyer-dashboard"
            : location.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer group",
              )}
              style={{
                background: active ? "rgba(251,191,36,0.15)" : "transparent",
                color: active ? "#FBBF24" : item.highlight ? "rgba(251,191,36,0.75)" : "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active || item.highlight ? "#FBBF24" : "rgba(255,255,255,0.4)" }} />
              <span className={cn("flex-1 font-medium", active && "font-semibold")}>{item.label}</span>
              {item.highlight && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: "#FBBF24", color: "#1a2744" }}>AI</span>
              )}
            </Link>
          );
        })}

        {/* Verified badge */}
        <div className="mt-5 mx-1 rounded-xl px-4 py-3 space-y-1.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" style={{ color: "#34D399" }} />
            <span className="text-xs font-semibold" style={{ color: "#34D399" }}>Bar Council Verified</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your profile is verified by Telangana Bar Council. Clients see your badge.
          </p>
        </div>

        {/* Quick links */}
        <div className="mt-5 space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            Quick Access
          </p>
          {[
            { label: "Legal Q&A", icon: MessageSquare, href: "/ask" },
            { label: "eCourts & API Chains", icon: ExternalLink, href: "/chains" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} onClick={onNav}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }}
              >
                <Icon className="w-3.5 h-3.5" /> {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Panel */}
      {user && (
        <div className="flex-shrink-0 px-4 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <User className="w-4 h-4" style={{ color: "#FBBF24" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-all"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string | number; sub?: string;
  iconEl: React.ReactNode; iconBg: string; iconColor: string; borderColor: string;
}
function StatCard({ label, value, sub, iconEl, iconBg, iconColor, borderColor }: StatCardProps) {
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

// ── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead }: { lead: typeof SAMPLE_LEADS[0] }) {
  const [, setLocation] = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={() => setLocation("/matches")}
      className="bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
      style={{ border: "1px solid #f1f5f9" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "#EFF6FF" }}>
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{lead.name}</span>
            {lead.urgent && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>URGENT</span>
            )}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>{lead.type}</span>
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">{lead.detail}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.location}</span>
            <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" />{lead.budget}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lead.time}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LawyerDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  const { data: matchData } = useQuery({
    queryKey: ["lawyer-matches"],
    queryFn: () => apiFetch("/matches/lawyer"),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  const activeMatches = Array.isArray(matchData)
    ? matchData.filter((m: { status: string }) => m.status === "accepted")
    : [];
  const pendingLeads = Array.isArray(matchData)
    ? matchData.filter((m: { status: string }) => m.status === "pending")
    : [];

  const isAdvocatePro = user?.subscription_tier === "advocate_pro";
  const lawyerFirstName = user?.name?.split(" ")[0] ?? "Advocate";

  const toggleStep = (step: number) =>
    setCompletedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );

  const stats: StatCardProps[] = [
    {
      label: "Active Cases", value: activeMatches.length,
      sub: "in court / ongoing",
      iconEl: <Briefcase className="w-5 h-5" />, iconBg: "#EFF6FF", iconColor: "#2563EB", borderColor: "#DBEAFE",
    },
    {
      label: "New Leads", value: pendingLeads.length || SAMPLE_LEADS.length,
      sub: "awaiting response",
      iconEl: <Users className="w-5 h-5" />, iconBg: "#ECFDF5", iconColor: "#059669", borderColor: "#D1FAE5",
    },
    {
      label: "AI Credits Used", value: user?.cases_this_month ?? 0,
      sub: "this month",
      iconEl: <Zap className="w-5 h-5" />, iconBg: "#F5F3FF", iconColor: "#7C3AED", borderColor: "#EDE9FE",
    },
    {
      label: "Month Earnings", value: "₹ —",
      sub: "connect Razorpay",
      iconEl: <IndianRupee className="w-5 h-5" />, iconBg: "#FFFBEB", iconColor: "#D97706", borderColor: "#FEF3C7",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden shadow-2xl"
            >
              <button
                className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
                onClick={() => setDrawerOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
        <header className="flex-shrink-0 h-14 flex items-center gap-3 px-4 md:px-6 shadow-md z-10"
          style={{ background: "#1E3A8A", color: "white" }}>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.1)" }}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="w-4 h-4 text-white" />
          </button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <Scale className="w-5 h-5" style={{ color: "#FBBF24" }} />
            <span className="font-bold text-sm text-white">LitigaForge AI</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.45)" }} />
              <input
                type="text"
                placeholder="Search Cases, Clients or Laws..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-white text-sm pl-9 pr-4 py-2 rounded-lg focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "white",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(251,191,36,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Indian law hint */}
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}>
              <BookOpen className="w-3 h-3" /> IPC · CrPC · eCourts
            </span>

            {/* Bell */}
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <Bell className="w-4 h-4 text-white" />
              {pendingLeads.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "#FBBF24", color: "#1a2744" }}>
                  {pendingLeads.length}
                </span>
              )}
            </button>

            {/* Profile chip */}
            <button
              onClick={() => setLocation("/subscription")}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "#FBBF24" }}>
                <User className="w-3.5 h-3.5" style={{ color: "#1a2744" }} />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight text-white truncate max-w-[80px]">
                  {user?.name ?? "Advocate"}
                </p>
                <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {isAdvocatePro ? "Advocate Pro" : "Free Plan"}
                </p>
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
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                    Welcome back, Advocate {lawyerFirstName} 👋
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Your AI-powered legal practice dashboard — Telangana &amp; AP courts
                  </p>
                </div>
                {isAdvocatePro && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                    <Shield className="w-3.5 h-3.5" /> Bar Council Verified
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((s) => <StatCard key={s.label} {...s} />)}
              </div>

              {/* Launch AI Forge CTA */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl p-5 md:p-6 shadow-lg"
                style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #1d4ed8 100%)" }}
              >
                {/* Decorative circle */}
                <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full pointer-events-none"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
                <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full pointer-events-none blur-2xl"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
                <Scale className="absolute right-0 top-0 w-36 h-36 pointer-events-none opacity-5 text-white" />

                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4" style={{ color: "#FBBF24" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#FBBF24" }}>AI Forge</span>
                    </div>
                    <h2 className="text-white font-bold text-lg md:text-xl leading-snug">
                      Set up your AI Forge for better practice
                    </h2>
                    <p className="text-sm mt-1 max-w-md leading-relaxed" style={{ color: "#BFDBFE" }}>
                      AI Forge helps you analyze documents, draft pleadings, research IPC/CrPC cases, and manage client matters efficiently.
                    </p>
                  </div>
                  <button
                    onClick={() => setLocation("/")}
                    className="flex items-center gap-2 font-bold px-5 py-3 rounded-xl transition-all shadow-lg text-sm flex-shrink-0 self-start sm:self-center hover:-translate-y-0.5 hover:shadow-xl"
                    style={{ background: "#FBBF24", color: "#1a2744" }}
                  >
                    <Zap className="w-4 h-4" />
                    Launch AI Forge
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>

              {/* Getting Started */}
              <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Get started in 3 steps</h3>
                  <span className="ml-auto text-xs text-gray-400">{completedSteps.length}/3 done</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: "#F1F5F9" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #2563EB, #1D4ED8)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(completedSteps.length / 3) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                <div className="space-y-3">
                  {SETUP_STEPS.map((s) => {
                    const isDone = completedSteps.includes(s.step);
                    const Icon = s.icon;
                    return (
                      <motion.div
                        key={s.step}
                        whileHover={{ x: 2 }}
                        onClick={() => toggleStep(s.step)}
                        className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: isDone ? "#ECFDF5" : "#F8FAFC",
                          border: `1px solid ${isDone ? "#A7F3D0" : "#F1F5F9"}`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isDone) {
                            (e.currentTarget as HTMLDivElement).style.borderColor = "#DBEAFE";
                            (e.currentTarget as HTMLDivElement).style.background = "#EFF6FF";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isDone) {
                            (e.currentTarget as HTMLDivElement).style.borderColor = "#F1F5F9";
                            (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC";
                          }
                        }}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: isDone ? "#059669" : "white",
                            border: isDone ? "none" : "2px solid #E2E8F0",
                          }}>
                          {isDone
                            ? <CheckCircle2 className="w-4 h-4 text-white" />
                            : <span className="text-xs font-bold text-gray-400">{s.step}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-semibold text-sm", isDone ? "text-emerald-800 line-through" : "text-gray-900")}>
                            {s.title}
                          </p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{s.desc}</p>
                        </div>
                        <Icon className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: isDone ? "#059669" : "#D1D5DB" }} />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Leads */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">Recent Consultation Requests</h3>
                    <p className="text-xs text-gray-400 mt-0.5">AI-matched cases from Telangana &amp; AP clients</p>
                  </div>
                  <button
                    onClick={() => setLocation("/matches")}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {SAMPLE_LEADS.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
                </div>
              </div>

              {/* Indian law hint */}
              <div className="rounded-xl p-4 flex gap-3" style={{ background: "#EFF6FF", border: "1px solid #DBEAFE" }}>
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">AI trained on Indian law</p>
                  <p className="text-[12px] text-blue-700 mt-0.5 leading-relaxed">
                    AI Forge references IPC, CrPC, CPC, Evidence Act, RERA, GST Act, Motor Vehicles Act,
                    Consumer Protection Act, and live eCourts India case data. Always verify AI output before
                    filing in Telangana / AP courts.
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
            <aside className="hidden xl:flex flex-col w-64 2xl:w-72 flex-shrink-0 overflow-auto px-4 py-5 space-y-4"
              style={{ borderLeft: "1px solid #F1F5F9", background: "#F8FAFC" }}>

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
                  <span className="text-2xl font-bold text-blue-700">{activeMatches.length}</span>
                </div>
                <div className="h-px mb-3" style={{ background: "#F8FAFC" }} />
                <button
                  onClick={() => setLocation("/cases")}
                  className="w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
                  style={{ background: "#2563EB" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1D4ED8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2563EB"; }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Case
                </button>
                <button
                  onClick={() => setLocation("/cases")}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium py-2 rounded-lg transition-colors text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                >
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
                    <p className="text-[11px] text-gray-400">Upload PDFs for AI analysis</p>
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 text-center mb-3 cursor-pointer transition-colors"
                  style={{ border: "2px dashed #E9D5FF" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#A78BFA";
                    (e.currentTarget as HTMLDivElement).style.background = "#F5F3FF";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#E9D5FF";
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                  onClick={() => setLocation("/review")}
                >
                  <Upload className="w-6 h-6 mx-auto mb-1.5" style={{ color: "#D1D5DB" }} />
                  <p className="text-[11px] text-gray-400">FIRs, charge sheets, contracts</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Max 25MB per file</p>
                </div>
                <button
                  onClick={() => setLocation("/review")}
                  className="w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
                  style={{ background: "#7C3AED" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#6D28D9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7C3AED"; }}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload &amp; Analyze
                </button>
              </div>

              {/* Quick Research */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #F1F5F9" }}>
                <p className="text-sm font-bold text-gray-900 mb-3">Quick Research</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Search Judgments", icon: Gavel, href: "/judgments" },
                    { label: "Legal Q&A", icon: MessageSquare, href: "/ask" },
                    { label: "eCourts Lookup", icon: FileSearch, href: "/chains" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => setLocation(item.href)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors text-[13px] font-medium text-left"
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {item.label}
                        <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upgrade card (free tier) */}
              {!isAdvocatePro && (
                <div className="rounded-2xl p-4 text-white"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                  <Award className="w-6 h-6 mb-2" style={{ color: "#FBBF24" }} />
                  <p className="font-bold text-sm mb-1">Upgrade to Advocate Pro</p>
                  <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#BFDBFE" }}>
                    Unlimited AI credits, verified badge, priority client matches, WhatsApp alerts.
                  </p>
                  <button
                    onClick={() => setLocation("/subscription")}
                    className="w-full text-xs font-bold py-2 rounded-lg transition-colors"
                    style={{ background: "#FBBF24", color: "#1a2744" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FCD34D"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FBBF24"; }}
                  >
                    Upgrade — ₹2,499/mo
                  </button>
                </div>
              )}

              {/* NALSA helpline */}
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
    </div>
  );
}
