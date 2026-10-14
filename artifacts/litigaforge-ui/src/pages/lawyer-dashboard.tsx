import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Star, Briefcase, Users, FileText, BookOpen, User, CalendarDays,
  Search, Bell, ChevronRight, Plus, Upload, CheckCircle2,
  X, LogOut, MessageSquare, ExternalLink, Info,
  FileSearch, Gavel, Phone, Award, AlertTriangle,
  Shield, MapPin, Clock, XCircle, Loader2, Trash2, Sparkles,
  FolderOpen, PenSquare, ChevronDown, Check, Download, Share2, StickyNote, Send, Copy,
  Hourglass,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCountry } from "@/hooks/useCountry";
import { LAWYER_DASHBOARD_COPY } from "@/lib/country-copy";
import { formatDate, caseTerms } from "@/lib/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import IncomingCaseFeed, { type CaseFeedItem } from "@/components/lawyer/IncomingCaseFeed";
import { useToast, toast } from "@/hooks/use-toast";
import { FeatureIcon } from "@/components/FeatureIcon";
import { FEATURE_BY_HREF } from "@/lib/featureIcons";


// ── Sidebar Nav ──────────────────────────────────────────────────────────────
const lawyerPortalNav = [
  { id: "dashboard",  label: "Dashboard",         icon: Briefcase,    href: "/lawyer-dashboard" },
  { id: "leads",      label: "Client Requests",   icon: Users,        href: "/matches" },
  { id: "messages",   label: "Messages",          icon: MessageSquare, href: "/messages" },
  { id: "docs",       label: "Document Analyzer", icon: FileSearch,   href: "/review" },
  { id: "profile",    label: "Profile & Plans",   icon: User,         href: "/subscription" },
];

const legalToolsNav = [
  { id: "chat",      label: "AI Legal Chat",    icon: Sparkles,   href: "/legal-chat",  badge: "AI" },
  { id: "ask",       label: "Legal Q&A",        icon: MessageSquare, href: "/ask" },
  { id: "analyzer",  label: "Document Analyzer", icon: FileText,  href: "/review" },
  { id: "judgments", label: "Judgment Finder",  icon: Gavel,      href: "/judgments" },
  { id: "workspace", label: "Forge Workspace",  icon: Star,       href: "/workspace", badge: "NEW" },
];

const CASE_TYPES = [
  "Criminal Defence", "Property Dispute", "Family Law", "Consumer Forum",
  "Civil Litigation", "Corporate Law", "RERA", "Motor Vehicles",
  "GST / Tax", "Other",
];

const COURTS: Record<string, string[]> = {
  IN: ["High Court", "District Court", "Family Court", "NCLT", "RERA Tribunal", "Consumer Forum", "Revenue Court", "Other"],
  US: ["District Court", "Circuit Court", "State Court", "Small Claims Court", "Bankruptcy Court", "Other"],
  GB: ["High Court", "County Court", "Crown Court", "Family Court", "Employment Tribunal", "Other"],
  AE: ["DIFC Courts", "Dubai Courts", "Abu Dhabi Courts", "Labour Court", "Rental Dispute Centre", "Other"],
  AU: ["Federal Court", "Supreme Court", "District Court", "Local Court", "Family Court", "Other"],
  CA: ["Superior Court", "Provincial Court", "Small Claims Court", "Family Court", "Other"],
  SG: ["High Court", "State Courts", "Family Justice Courts", "Small Claims Tribunals", "Other"],
  DE: ["Landgericht", "Amtsgericht", "Arbeitsgericht", "Verwaltungsgericht", "Oberlandesgericht", "Other"],
};
function getCourts(countryCode: string) {
  return COURTS[countryCode.toUpperCase()] ?? COURTS.IN;
}

// ── Types ────────────────────────────────────────────────────────────────────────────
interface LawyerCase {
  id: number; lawyer_id: number; title: string; case_type: string;
  description: string; client_name: string; court_name: string;
  cnr_number: string; hearing_date: string; case_stage: string;
  status: string; created_at: string; documents?: LawyerDoc[];
  court_hall?: string; hall?: string; courtroom?: string; court_no?: string;
  item_number?: string | number; itemNo?: string | number; item_no?: string | number;
  serialNo?: string | number; serial_no?: string | number;
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

  const NavItem = ({ item }: { item: typeof lawyerPortalNav[0] & { badge?: string } }) => {
    const Icon = item.icon;
    const feature = FEATURE_BY_HREF[item.href];
    const active = item.href === "/lawyer-dashboard"
      ? location === "/lawyer-dashboard"
      : location.startsWith(item.href);
    return (
      <Link key={item.id} href={item.href} onClick={onNav}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer",
          active
            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        {feature
          ? <FeatureIcon feature={feature} size="small" />
          : <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/40")} />}
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
            item.badge === "AI" ? "bg-amber-400 text-primary-foreground" : "bg-secondary text-secondary-foreground"
          )}>{item.badge}</span>
        )}
      </Link>
    );
  };

  const initials = (user?.name ?? "A").slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-sidebar-primary">
          <Scale className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="font-bold text-sm tracking-tight text-sidebar-foreground leading-none">LitigaForge</p>
          <p className="text-[9px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase mt-0.5">Advocate</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Lawyer Portal */}
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">Lawyer Portal</p>
        {lawyerPortalNav.map((item) => <NavItem key={item.id} item={item} />)}

        {/* Legal Tools */}
        <p className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">Legal Tools</p>
        {legalToolsNav.map((item) => <NavItem key={item.id} item={item} />)}
      </nav>

      {/* User section */}
      {user && (
        <div className="flex-shrink-0 px-4 py-4 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-sidebar-primary/20 border border-sidebar-primary/30">
              <span className="text-sm font-bold text-sidebar-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[10px] truncate text-sidebar-foreground/40">{user.email}</p>
            </div>
          </div>
          <Link href="/settings" onClick={onNav}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
            <FeatureIcon feature="accountPrivacy" size="small" /> Account &amp; Privacy
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
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
      <p className="text-3xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
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
        style={{ border: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <h3 className="font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground/60" />
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
  const { activeCode, activeConfig } = useCountry();
  const copy = LAWYER_DASHBOARD_COPY[activeCode.toUpperCase()] ?? LAWYER_DASHBOARD_COPY.IN;
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<"overview" | "cases" | "clients" | "documents" | "earnings">("overview");
  useEffect(() => {
    const section = location.split("/").at(-1);
    if (section && ["cases", "clients", "documents", "earnings"].includes(section)) {
      setActiveSection(section as "cases" | "clients" | "documents" | "earnings");
    } else if (section === "lawyer-dashboard") {
      setActiveSection("overview");
    }
  }, [location]);
  const [feeDrafts, setFeeDrafts] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [caseTab, setCaseTab] = useState<"active" | "pending" | "closed">("active");
  const [matchTab, setMatchTab] = useState<"pending" | "accepted" | "declined">("pending");
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
  const { toast } = useToast();


  // ── Verification polling ──
  useEffect(() => {
    if ((user?.role !== "lawyer" && user?.role !== "advocate") || user?.is_verified) return;
    const id = setInterval(() => { refreshUser(); }, 30_000);
    return () => clearInterval(id);
  }, [user?.role, user?.is_verified, refreshUser]);

  // ── Queries ──
  const { data: lawyerCases, isLoading: casesLoading, isError: casesError } = useQuery({
    queryKey: ["lawyer-cases"],
    queryFn: () => apiFetch("/lawyer/cases"),
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const { data: docketSchedule } = useQuery({
    queryKey: ["docket-schedule-today", user?.id],
    queryFn: () => apiFetch("/docket/schedule"),
    enabled: !!user && location === "/lawyer-dashboard",
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: lawyerDocs, isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ["lawyer-documents"],
    queryFn: () => apiFetch("/lawyer/documents"),
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: authorityAlertData } = useQuery({
    queryKey: ["authority-alerts-today"],
    queryFn: () => apiFetch("/authorities/alerts?unread_only=true"),
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const markAuthorityAlertRead = useMutation({
    mutationFn: (alertId: number) =>
      apiFetch(`/authorities/alerts/${alertId}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authority-alerts-today"] }),
  });

  const { data: matchData, isLoading: matchLoading, isError: matchError } = useQuery({
    queryKey: ["lawyer-matches"],
    queryFn: () => apiFetch("/matches/lawyer"),
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const cases: LawyerCase[] = lawyerCases?.cases ?? [];
  const docs: LawyerDoc[] = lawyerDocs?.documents ?? [];

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
    onError: (e: any) => {
      toast({ title: "Save failed", description: e?.detail ?? e?.message ?? "Failed to save notes. Please try again.", variant: "destructive" });
    },
  });

  const acceptLeadMut = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/accept`, { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["lawyer-matches"] });
      qc.invalidateQueries({ queryKey: ["chat-threads", user?.id] });
      if (data?.thread_id) {
        setLocation(`/messages?thread=${data.thread_id}`);
      }
    },
  });

  const declineLeadMut = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/decline`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lawyer-matches"] }),
  });

  const saveAgreedFeeMut = useMutation({
    mutationFn: ({ matchId, agreedFee }: { matchId: number; agreedFee: number }) =>
      apiFetch(`/matches/${matchId}/agreed-fee`, {
        method: "PATCH",
        body: JSON.stringify({ agreed_fee: agreedFee }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lawyer-matches"] });
      toast({ title: "Agreed fee saved" });
    },
    onError: (e: any) => toast({
      title: "Fee not saved",
      description: e?.detail ?? e?.message ?? "Please try again.",
      variant: "destructive",
    }),
  });

  const allLeads: any[] = matchData?.matches ?? (Array.isArray(matchData) ? matchData : []);
  const feedCases: CaseFeedItem[] = allLeads
    .filter((m: any) => m.status === "pending")
    .map((m: any): CaseFeedItem => ({
      id: m.id,
      case_requirement_id: m.case_requirement_id ?? 0,
      category: m.case_type ?? "Case",
      created_at: m.created_at,
      title: m.case_title ?? "Untitled Case",
      description: m.description ?? "",
      location: m.location ?? undefined,
      budget: m.budget_range ?? "",
      funnelIndex: 0,
      clientIsOnline: false,
    }));

  const isAdvocatePro = user?.subscription_tier === "advocate_pro";
  const hasPaidPlan = ["advocate_pro", "professional"].includes(user?.subscription_tier || "");

  const filteredCases = cases.filter((c) => c.status === caseTab);

  const pendingLeads  = allLeads.filter((m: any) => m.status === "pending");
  const acceptedLeads = allLeads.filter((m: any) => m.status === "accepted");
  const declinedLeads = allLeads.filter((m: any) => m.status === "declined");
  const completedCases = cases.filter((c) => c.status === "closed");

  const stats = [
    { label: "Total Requests", value: allLeads.length, sub: "All client requests", iconEl: <Users className="w-5 h-5" />, iconBg: "rgba(139,92,246,0.12)", iconColor: "#8B5CF6", borderColor: "rgba(139,92,246,0.25)" },
    { label: "Pending", value: pendingLeads.length, sub: "Needs your response", iconEl: <Clock className="w-5 h-5" />, iconBg: "rgba(245,183,84,0.12)", iconColor: "#F5B754", borderColor: "rgba(245,183,84,0.35)" },
    { label: "Accepted", value: acceptedLeads.length, sub: "Active matters", iconEl: <CheckCircle2 className="w-5 h-5" />, iconBg: "rgba(52,211,153,0.12)", iconColor: "#34D399", borderColor: "rgba(52,211,153,0.25)" },
    { label: "Completed", value: completedCases.length, sub: "This month", iconEl: <FileText className="w-5 h-5" />, iconBg: "rgba(139,92,246,0.12)", iconColor: "#8B5CF6", borderColor: "rgba(139,92,246,0.25)" },
  ];

  // ── Verification wall ──
  if ((user?.role === "lawyer" || user?.role === "advocate") && !user?.is_verified) {
    const hasSubmittedProfile = !!user?.lawyer_status;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "hsl(var(--muted))", fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,183,84,0.15)", border: "1px solid rgba(245,183,84,0.25)" }}>
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-xl font-bold text-foreground">LitigaForge AI</span>
          </div>

          {hasSubmittedProfile ? (
            /* ── State 2: Profile submitted, pending admin review ── */
            <div className="rounded-2xl bg-card shadow-lg border border-border px-8 py-10">
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(139,92,246,0.12)", border: "1.5px solid rgba(139,92,246,0.25)" }}
              >
                <Hourglass className="w-7 h-7 text-primary" />
              </motion.div>

                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {user?.lawyer_status === "rejected" ? "Verification rejected" : user?.lawyer_status === "verified" ? "Verified" : "Under review"}
                </h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {user?.lawyer_status === "rejected"
                  ? (user?.lawyer_rejection_reason || "Please update your verification details and contact support.")
                  : "Your profile has been submitted. Our team will review your credentials."}
              </p>

              <div className="space-y-3 text-left mb-6">
                {[
                  { label: "Profile submitted", done: true },
                  { label: "Credentials review", done: false, active: true },
                  { label: "Account activated", done: false },
                ].map(({ label, done, active }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: done ? "rgba(52,211,153,0.12)" : active ? "rgba(139,92,246,0.12)" : "hsl(var(--muted))",
                        border: `1.5px solid ${done ? "rgba(52,211,153,0.35)" : active ? "rgba(139,92,246,0.35)" : "hsl(var(--border))"}`,
                      }}
                    >
                      {done ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : active ? (
                        <Loader2 className="w-3 h-3 text-secondary animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{ color: done ? "#34D399" : active ? "#8B5CF6" : "#94A3B8", fontWeight: active || done ? 600 : 400 }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-primary mb-4"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>Checking for updates every 30 seconds — this page will refresh automatically once approved.</span>
              </div>

              <button
                onClick={() => refreshUser()}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#F5B754", color: "#0A0B10" }}
              >
                Check now
              </button>
            </div>
          ) : (
            /* ── State 1: Registered as lawyer but profile not yet submitted ── */
            <div className="rounded-2xl bg-card shadow-lg border border-border px-8 py-10">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(245,183,84,0.12)", border: "1.5px solid rgba(245,183,84,0.35)" }}
              >
                <User className="w-7 h-7 text-amber-500" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">Complete Your Profile</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                One more step! Submit your advocate profile — bar number, district, and practice areas — so our team can verify you and activate your account.
              </p>

              <div className="space-y-3 text-left mb-6">
                {[
                  { label: "Account created", done: true },
                  { label: "Submit advocate profile", done: false, active: true },
                  { label: "Admin verification", done: false },
                  { label: "Account activated", done: false },
                ].map(({ label, done, active }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: done ? "rgba(52,211,153,0.12)" : active ? "rgba(245,183,84,0.12)" : "hsl(var(--muted))",
                        border: `1.5px solid ${done ? "rgba(52,211,153,0.35)" : active ? "rgba(245,183,84,0.35)" : "hsl(var(--border))"}`,
                      }}
                    >
                      {done ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : active ? (
                        <PenSquare className="w-3 h-3 text-amber-500" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <span
                      className={cn("text-sm", done ? "text-emerald-700 dark:text-emerald-300" : active ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}
                      style={{ fontWeight: active || done ? 600 : 400 }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <Link href="/lawyers">
                <button
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "#F5B754", color: "#0A0B10" }}
                >
                  Submit Advocate Profile →
                </button>
              </Link>
            </div>
          )}

          {/* Footer */}
          <p className="mt-5 text-xs text-muted-foreground/60">
            Questions?{" "}
            <a href="mailto:support@litigaforge.com" className="underline hover:text-muted-foreground">
              Contact support
            </a>
          </p>
          <button
            onClick={() => { logout(); }}
            className="mt-2 text-xs text-muted-foreground/60 hover:text-muted-foreground underline"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Recent activity derived from match + doc data ──
  const recentActivity = [
    ...allLeads.slice(0, 3).map((m: any) => ({
      id: `m-${m.id}`,
      type: m.status === "accepted" ? "accepted" : "match",
      title: m.status === "accepted" ? "Client request accepted" : `New match for ${m.case_title ?? "case"}`,
      sub: m.case_title ?? "",
      time: m.created_at,
    })),
    ...docs.slice(0, 2).map((d) => ({
      id: `d-${d.id}`,
      type: "doc",
      title: "Document analyzed",
      sub: d.filename,
      time: d.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 4);

  const visibleMatches = allLeads.filter((m: any) => m.status === matchTab);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  // ── Client list derived from accepted matches + lawyer cases ──
  const clientList = (() => {
    const seen = new Set<string>();
    const clients: { key: string; name: string; email?: string; caseTitle: string; matchedAt: string; budget?: string }[] = [];
    acceptedLeads.forEach((m: any) => {
      const key = `match-${m.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        clients.push({ key, name: m.client_name ?? "Anonymous", email: m.client_email, caseTitle: m.case_title ?? "Untitled Case", matchedAt: m.created_at, budget: m.budget_range });
      }
    });
    cases.forEach((c) => {
      if (c.client_name) {
        const key = `case-${c.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          clients.push({ key, name: c.client_name, caseTitle: c.title, matchedAt: c.created_at });
        }
      }
    });
    return clients;
  })();

  // ── CNR cases: cases with a CNR number, sorted by nearest hearing date first ──
  const cnrCases = cases
    .filter((c) => c.cnr_number?.trim())
    .sort((a, b) => {
      const aDate = a.hearing_date ? new Date(a.hearing_date).getTime() : Infinity;
      const bDate = b.hearing_date ? new Date(b.hearing_date).getTime() : Infinity;
      return aDate - bDate;
    });
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const scheduledCases = cases
    .filter((c) => c.status !== "closed" && /^\d{4}-\d{2}-\d{2}/.test(c.hearing_date ?? ""))
    .sort((a, b) => a.hearing_date.localeCompare(b.hearing_date));
  const todayCases = scheduledCases.filter((c) => c.hearing_date.slice(0, 10) === todayKey);
  const upcomingCases = scheduledCases.filter((c) => c.hearing_date.slice(0, 10) > todayKey).slice(0, 4);
  const todayLabel = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const hearingMeta = (item: LawyerCase) => {
    const scheduled = (docketSchedule?.courts ?? []).flatMap((court: any) => [
      ...(court.today?.matters ?? []).map((matter: any) => ({ matter, court: court.court })),
      ...(court.tomorrow?.matters ?? []).map((matter: any) => ({ matter, court: court.court })),
    ]).find(({ matter }: any) => {
      const cnr = matter.cnr ?? matter.CNR ?? matter.cnr_number;
      return item.cnr_number && cnr && String(cnr).toUpperCase() === item.cnr_number.toUpperCase();
    });
    const matter = scheduled?.matter;
    const hall = item.court_hall || item.hall || item.courtroom || item.court_no || scheduled?.court?.court_no;
    const itemNumber = item.item_number ?? item.itemNo ?? item.item_no ?? item.serialNo ?? item.serial_no
      ?? matter?.itemNo ?? matter?.item_no ?? matter?.serialNo ?? matter?.serial_no ?? matter?.item_number;
    const courtName = item.court_name || scheduled?.court?.court;
    const hallLabel = hall && !/hall|court|room/i.test(String(hall)) ? `Hall ${hall}` : hall;
    return [courtName, hallLabel, itemNumber != null && itemNumber !== "" ? `Item ${itemNumber}` : null]
      .filter(Boolean).join(" · ");
  };
  const formatHearingDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  // ── Earnings are based only on fees the advocate has entered ──
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthlyFeeCases = acceptedLeads.filter((m: any) => {
    const d = new Date(m.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && m.agreed_fee != null;
  });
  const recordedMonthlyEarnings = monthlyFeeCases.reduce((sum: number, m: any) => sum + Number(m.agreed_fee || 0), 0);
  const recordedTotalEarnings = acceptedLeads.reduce((sum: number, m: any) => sum + Number(m.agreed_fee || 0), 0);
  const recordedFeeCount = acceptedLeads.filter((m: any) => m.agreed_fee != null).length;

  const SECTION_TABS = [
    { id: "overview",   href: "/lawyer-dashboard", label: "Today",   icon: Briefcase },
    { id: "cases",      href: "/lawyer-dashboard/cases", label: "Cases",      icon: FileText, badge: cases.length },
    { id: "clients",    href: "/lawyer-dashboard/clients", label: "Clients",    icon: Users, badge: clientList.length },
    { id: "documents",  href: "/lawyer-dashboard/documents", label: "Documents",  icon: FolderOpen, badge: docs.length },
    { id: "earnings",   href: "/lawyer-dashboard/earnings", label: "Earnings",   icon: Award },
  ] as const;

  return (
    <div className="flex min-h-full" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Main Content ── */}
      <main className={cn("flex-1 min-w-0 px-4 md:px-8 py-6", activeSection === "cases" ? "space-y-2" : "space-y-6")}>

        {/* ── Welcome ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {activeSection === "overview" ? (
              <>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">Today</h1>
                <p className="mt-1 text-sm text-muted-foreground">{todayLabel.replace(",", "")}</p>
              </>
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                {activeSection === "cases" ? "Cases" : activeSection === "clients" ? "Clients" : activeSection === "documents" ? "Documents" : "Earnings"}
              </h1>
            )}
          </div>
          {/* Section quick actions */}
          <div className={cn("flex items-center gap-2 flex-shrink-0", activeSection === "cases" && "hidden")}>
            <button onClick={() => { setActiveSection("cases"); setShowCaseModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "#F5B754", color: "#0A0B10" }}
              data-testid="add-case-btn">
              <FeatureIcon feature="postCase" size="small" /> Add Case
            </button>
            <button onClick={() => { setActiveSection("documents"); setShowDocModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all bg-card"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              data-testid="upload-doc-btn">
              <FeatureIcon feature="documents" size="small" /> Upload Doc
            </button>
          </div>
        </div>

        {/* ── Section Tabs ── */}
        <div className="hidden">
          {SECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button key={tab.id} onClick={() => setLocation(tab.href)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.id}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {"badge" in tab && (tab.badge as number) > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-muted text-muted-foreground">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── OVERVIEW ── */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Today’s hearing agenda" data-testid="today-agenda">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2" data-testid="today-agenda-heading">
                    <h3 className="text-sm font-semibold text-foreground">Hearings today</h3>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{todayCases.length}</span>
                      <Link href="/cause-lists" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-primary hover:bg-primary/5" data-testid="today-cause-lists-link">
                        Cause lists <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                  {todayCases.length ? (
                    <ul className="space-y-2">
                      {todayCases.slice(0, 4).map((item) => (
                        <li key={item.id} className="rounded-xl bg-muted/40 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <Link data-testid="today-hearing-title" href="/lawyer-dashboard/cases" className="block min-w-0 text-sm font-semibold leading-5 text-foreground hover:text-primary">
                              {item.title}
                            </Link>
                            <time className="shrink-0 text-xs font-medium text-primary" dateTime={item.hearing_date.slice(0, 10)}>Today</time>
                          </div>
                          <p data-testid="today-hearing-meta" className="mt-0 truncate text-xs leading-4 text-muted-foreground">{hearingMeta(item) || item.case_stage || "Hearing scheduled"}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      No hearing dates on your active cases today. Check the court cause lists for today’s schedule.
                    </p>
                  )}
                </div>
                <div className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Coming up</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{upcomingCases.length}</span>
                  </div>
                  {upcomingCases.length ? (
                    <ul className="space-y-2">
                      {upcomingCases.map((item) => (
                        <li key={item.id} className="rounded-xl bg-muted/40 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <Link href="/lawyer-dashboard/cases" className="block min-w-0 text-sm font-semibold leading-5 text-foreground hover:text-primary">
                              {item.title}
                            </Link>
                            <time className="shrink-0 text-xs font-medium text-primary" dateTime={item.hearing_date.slice(0, 10)}>
                              {formatHearingDate(item.hearing_date)}
                            </time>
                          </div>
                          <p className="mt-0 truncate text-xs leading-4 text-muted-foreground">{hearingMeta(item) || item.case_stage || "Active matter"}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      No upcoming hearing dates are saved on your active cases.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <p className="whitespace-nowrap text-sm text-muted-foreground" data-testid="client-requests-summary">
              <span>Client requests: {pendingLeads.length} pending · </span>
              <Link href="/matches" className="font-semibold text-primary hover:underline">View</Link>
            </p>
            <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="authority-alerts-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                    <h2 id="authority-alerts-title" className="text-sm font-bold text-foreground">Research alerts</h2>
                </div>
                <Link href="/judgments" className="text-xs font-semibold text-primary hover:underline">
                  Manage saved searches
                </Link>
              </div>
              {authorityAlertData?.alerts?.length ? (
                <ul className="space-y-2">
                  {authorityAlertData.alerts.slice(0, 5).map((alert: {
                    id: number; case_name: string; citation?: string; source_url: string;
                    source_name?: string; monitor_kind: string;
                  }) => (
                    <li key={alert.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                      <div className="min-w-0">
                        <a href={alert.source_url} target="_blank" rel="noreferrer"
                          className="text-sm font-semibold text-foreground hover:text-primary">
                          {alert.case_name}
                        </a>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {alert.citation || alert.source_name || "New case-law result"} · {alert.monitor_kind === "citation_watch" ? "Citation watch" : "Saved search"}
                        </p>
                      </div>
                      <button type="button" aria-label={`Mark ${alert.case_name} as read`}
                        onClick={() => markAuthorityAlertRead.mutate(alert.id)}
                        disabled={markAuthorityAlertRead.isPending}
                        className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-foreground">
                        <Check className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No new saved-search or citation-watch results today.</p>
              )}
            </section>
            <section className="hidden" aria-label="Quick actions" aria-hidden="true">
              {[
                { feature: "postCase" as const, label: "Add Case", action: () => { setActiveSection("cases"); setShowCaseModal(true); } },
                { feature: "documents" as const, label: "Upload Doc", action: () => { setActiveSection("documents"); setShowDocModal(true); } },
                { feature: "aiLegalDrafting" as const, label: "AI Drafting", action: () => setLocation("/legal-chat") },
                { feature: "documentAnalyzer" as const, label: "Analyzer", action: () => setLocation("/review") },
              ].map(item => (
                <button key={item.feature} onClick={item.action} aria-label={item.label}
                  className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-1 py-2 text-center active:scale-[0.98]">
                  <FeatureIcon feature={item.feature} size="large" />
                  <span className="w-full truncate text-[13px] font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </section>
            {/* Stat cards */}
            {(casesError || matchError) && (
              <div className="flex items-center gap-2 text-xs text-red-400 rounded-lg px-3 py-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Some data could not be loaded — showing cached results.
              </div>
            )}
            <div className="hidden" aria-hidden="true">
              {(casesLoading || matchLoading)
                ? stats.map((s) => (
                    <div key={s.label} className="rounded-xl bg-card p-4 shadow-sm overflow-hidden relative animate-pulse"
                      style={{ border: `1px solid ${s.borderColor}` }}>
                      <div className="h-8 w-12 bg-muted rounded mb-2" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                  ))
                : stats.map((s) => <StatCard key={s.label} {...s} />)}
            </div>

            {/* Two-column body */}
            <div className="hidden" aria-hidden="true">
              {/* Left — Match proposals + feature cards */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* Match Proposals */}
                <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                  <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
                        <Sparkles style={{ width: "18px", height: "18px", color: "#8B5CF6" }} />
                      </div>
                      <div>
                        <h2 className="font-bold text-foreground text-base leading-tight">Client requests</h2>
                        <p className="text-[12px] text-muted-foreground/60 mt-0.5">Potential clients matched to your practice.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 rounded-xl p-1" style={{ background: "hsl(var(--muted))" }}>
                      {(["pending", "accepted", "declined"] as const).map((tab) => {
                        const count = allLeads.filter((m: any) => m.status === tab).length;
                        return (
                          <button key={tab} onClick={() => setMatchTab(tab)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                              matchTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-muted-foreground"
                            )}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                              matchTab === tab
                                ? tab === "pending" ? "bg-amber-500/15 text-amber-400"
                                  : tab === "accepted" ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                                : "bg-muted text-muted-foreground"
                            )}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-5 pb-2 space-y-3">
                    {matchLoading ? (
                      <div className="py-10 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
                      </div>
                    ) : matchError ? (
                      <div className="rounded-xl py-8 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
                        <AlertTriangle className="w-6 h-6 text-red-400/60 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Could not load match proposals</p>
                      </div>
                    ) : visibleMatches.length === 0 ? (
                      <div className="rounded-xl py-10 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
                        <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No {matchTab} proposals right now</p>
                        {matchTab === "pending" && <p className="text-xs text-muted-foreground/60 mt-1">New client matches will appear here</p>}
                      </div>
                    ) : visibleMatches.map((m: any) => {
                      const score = Math.round((m.match_score ?? 0.75) * 100);
                      const scoreColor = score >= 85 ? "#34D399" : score >= 70 ? "#F5B754" : "#6B7280";
                      const scoreBg   = score >= 85 ? "rgba(52,211,153,0.12)" : score >= 70 ? "rgba(245,183,84,0.12)" : "hsl(var(--muted))";
                      return (
                        <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-4 rounded-xl p-4 hover:shadow-sm transition-shadow"
                          style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base"
                            style={{ background: scoreBg, color: scoreColor, border: `1.5px solid ${scoreColor}22` }}>
                            {score}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{m.case_title ?? "Untitled Case"}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">{m.case_type ?? "Civil"}{m.location ? ` · ${m.location}` : ""}</p>
                            {m.budget_range && <p className="text-[12px] text-muted-foreground/60 mt-0.5">Budget: {m.budget_range}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className="text-[11px] text-muted-foreground/60">{timeAgo(m.created_at)}</span>
                            <button onClick={() => setLocation("/matches")}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}
                              data-testid={`match-view-${m.id}`}>
                              View Details
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {visibleMatches.length > 0 && (
                    <div className="px-5 py-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                      <button onClick={() => setLocation("/matches")}
                        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                        View all proposals <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Users,    color: "#4F46E5", bg: "rgba(139,92,246,0.12)", label: "AI-Powered Matching", sub: "Get high-quality leads that match your expertise" },
                    { icon: Sparkles, color: "#38BDF8", bg: "rgba(14,165,233,0.12)", label: "Smart Tools",         sub: "AI chat, document analysis, and legal research" },
                    { icon: Award,    color: "#F472B6", bg: "rgba(236,72,153,0.12)", label: "Grow Your Practice",  sub: "Save time and focus on winning cases" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="bg-card rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow" style={{ border: "1px solid hsl(var(--border))" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.bg }}>
                          <Icon className="w-5 h-5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right column */}
              <div className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 space-y-4">
                <div className="bg-card rounded-2xl p-5 shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                  <p className="font-bold text-foreground text-sm mb-4">Quick Actions</p>
                  <div className="space-y-2">
                    {[
                      { feature: "postCase" as const, label: "Add Case", sub: "Create a new case record", action: () => { setActiveSection("cases"); setShowCaseModal(true); } },
                      { feature: "documents" as const, label: "Upload Document", sub: "Add docs to a case", action: () => { setActiveSection("documents"); setShowDocModal(true); } },
                      { feature: "aiLegalDrafting" as const, label: "AI Legal Chat", sub: "Get instant legal insights", action: () => setLocation("/legal-chat") },
                      { feature: "documentAnalyzer" as const, label: "Document Analyzer", sub: "Analyze contracts & FIRs", action: () => setLocation("/review") },
                    ].map((item) => {
                      return (
                        <button key={item.label} onClick={item.action}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                          style={{ border: "1px solid hsl(var(--border))" }}>
                          <FeatureIcon feature={item.feature} size="medium" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-none">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-5 shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-bold text-foreground text-sm">Recent Activity</p>
                    <button onClick={() => setLocation("/matches")} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">View all</button>
                  </div>
                  <div className="space-y-3">
                    {recentActivity.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground/60 text-center py-3">No recent activity</p>
                    ) : recentActivity.map((item) => {
                      const isMatch    = item.type === "match";
                      const isAccepted = item.type === "accepted";
                      const isDoc      = item.type === "doc";
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: isMatch ? "rgba(139,92,246,0.12)" : isAccepted ? "rgba(52,211,153,0.12)" : "rgba(139,92,246,0.12)" }}>
                            {isMatch    && <Users       className="w-3.5 h-3.5 text-primary" />}
                            {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                            {isDoc      && <FileText    className="w-3.5 h-3.5 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-foreground leading-tight">{item.title}</p>
                            {item.sub && <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{item.sub}</p>}
                            <p className="text-[10px] text-muted-foreground/40 mt-0.5">{timeAgo(item.time)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {hasPaidPlan ? (
                  <button onClick={() => setLocation("/subscription")} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">
                    Manage plan
                  </button>
                ) : (
                  <div className="rounded-2xl p-5 flex flex-col items-center text-center"
                    style={{ background: "linear-gradient(135deg, #14151F 0%, #1a1b2e 100%)", border: "1px solid rgba(245,183,84,0.2)" }}>
                    <Scale className="w-10 h-10 text-amber-400 mb-3" />
                    <p className="text-sm font-bold text-foreground leading-tight">Grow Your Practice</p>
                    <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(245,183,84,0.7)" }}>Unlock unlimited leads and AI tools</p>
                    <button onClick={() => setLocation("/subscription")}
                      className="mt-3 text-xs font-bold py-2 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#0A0B10] transition-colors">
                      Upgrade — ₹2,499/mo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CASES ── */}
        {activeSection === "cases" && (
          <div className="space-y-1">
            <button onClick={() => setShowCaseModal(true)}
              className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition-all md:static md:bottom-auto md:right-auto md:rounded-xl md:px-4 md:py-2 md:shadow-none"
              style={{ background: "#F5B754", color: "#0A0B10" }}
              data-testid="cases-add-case-btn">
              <Plus className="w-4 h-4" /> Add Case
            </button>

            {/* Status tabs */}
            <div className="flex items-center gap-1 rounded-xl p-1 w-fit" style={{ background: "hsl(var(--muted))" }}>
              {(["active", "pending", "closed"] as const).map((tab) => {
                const count = cases.filter((c) => c.status === tab).length;
                return (
                  <button key={tab} onClick={() => setCaseTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                      caseTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-muted-foreground"
                    )}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                      caseTab === tab
                        ? tab === "active" ? "bg-emerald-500/15 text-emerald-400"
                          : tab === "closed" ? "bg-muted text-muted-foreground"
                          : "bg-amber-500/15 text-amber-400"
                        : "bg-muted text-muted-foreground"
                    )}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Case cards */}
            {filteredCases.length === 0 ? (
              <div className="rounded-2xl py-16 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
                <Briefcase className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No {caseTab} cases</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Case" to create your first case record</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCases.map((c) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer relative"
                    style={{ border: "1px solid hsl(var(--border))" }}
                    data-testid={`lawyer-case-card-${c.id}`}
                    onClick={() => {
                      setFolderCase(c);
                      setFolderDocs(docs.filter((d) => d.case_id === c.id));
                      setShowFolder(true);
                    }}>
                    <div className="p-5 space-y-3">
                      {/* Title + status */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-foreground text-sm leading-snug flex-1">{c.title}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0",
                          c.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                            : c.status === "closed" ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/15 text-amber-400"
                        )}>{c.status}</span>
                      </div>

                      {/* Case type */}
                      <p className="text-[12px] text-muted-foreground">{c.case_type}</p>

                      {/* Client */}
                      {c.client_name && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                          <span className="text-[12px] text-muted-foreground truncate">{c.client_name}</span>
                        </div>
                      )}

                      {/* Court */}
                      {c.court_name && (
                        <div className="flex items-center gap-1.5">
                          <Gavel className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                          <span className="text-[12px] text-muted-foreground truncate">{c.court_name}</span>
                        </div>
                      )}

                      {/* CNR Number */}
                      {c.cnr_number && (
                        <p data-testid={`lawyer-case-cnr-${c.id}`} className="truncate text-[11px] font-mono tabular-nums text-muted-foreground">{c.cnr_number}</p>
                      )}

                      {/* Docs count + actions */}
                      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                        <span className="text-[11px] text-muted-foreground/60">
                          {docs.filter((d) => d.case_id === c.id).length} document{docs.filter((d) => d.case_id === c.id).length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditingCase(c); }}
                            className="text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                            data-testid={`edit-case-${c.id}`}>Edit</button>
                          <button onClick={(e) => { e.stopPropagation(); setPreselectedCaseId(String(c.id)); setShowDocModal(true); }}
                            className="text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                            data-testid={`upload-case-doc-${c.id}`}>+ Doc</button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* CNR Tracking section */}
            {cnrCases.length > 0 && (
              <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 border border-primary/20" data-testid="cnr-tracker-icon-tile">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">CNR Case Tracker</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Cases with registered CNR numbers</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {cnrCases.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {c.court_name || "Court TBD"} · {c.case_type}
                          {c.hearing_date && (
                            <span className="ml-2 text-amber-400 font-semibold">
                              · Next hearing: {new Date(c.hearing_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>
                          {c.cnr_number}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                          c.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                            : c.status === "closed" ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/15 text-amber-400"
                        )}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CLIENTS ── */}
        {activeSection === "clients" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Client List</h2>
              <p className="text-sm text-muted-foreground mt-0.5">All clients from accepted matches and active cases</p>
            </div>

            {clientList.length === 0 ? (
              <div className="rounded-2xl py-16 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No clients yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Accept match proposals to see clients here</p>
                <button onClick={() => setActiveSection("overview")}
                  className="mt-4 text-xs font-semibold text-primary hover:text-primary/80 underline transition-colors">
                  View match proposals →
                </button>
              </div>
            ) : (
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="px-5 py-3 border-b grid grid-cols-3 gap-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
                  <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Client</span>
                  <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Case</span>
                  <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider text-right">Since</span>
                </div>
                {clientList.map((client) => (
                  <motion.div key={client.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="px-5 py-4 border-b hover:bg-muted/50 transition-colors grid grid-cols-3 gap-4 items-center"
                    style={{ borderColor: "hsl(var(--muted))" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>
                        {(client.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                        {client.email && <p className="text-[11px] text-muted-foreground/60 truncate">{client.email}</p>}
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate">{client.caseTitle}</p>
                    <p className="text-[11px] text-muted-foreground/60 text-right">{formatDate(client.matchedAt, activeCode)}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeSection === "documents" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-foreground">Document Management</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Upload, analyze, and annotate case documents</p>
              </div>
              <button onClick={() => setShowDocModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "#8B5CF6" }}
                data-testid="docs-upload-btn">
                <Upload className="w-4 h-4" /> Upload Document
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="rounded-2xl py-16 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
                <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No documents yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Upload FIRs, charge sheets, contracts, and briefs</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:border-primary transition-colors"
                    style={{ borderColor: "hsl(var(--border))" }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docs
                    .filter((d) => !searchQuery || d.filename.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((d) => (
                      <motion.div key={d.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-card rounded-2xl shadow-sm hover:shadow-md transition-all"
                        style={{ border: "1px solid hsl(var(--border))" }}>
                        <div className="flex items-start gap-3 p-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
                            <FileText className="w-5 h-5" style={{ color: "#8B5CF6" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-sm truncate">{d.filename}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.25)" }}>
                                {d.file_type.toUpperCase()}
                              </span>
                              {d.ai_summary && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AI Analyzed</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDate(d.created_at, activeCode)}</p>
                            {d.ai_summary && (
                              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{d.ai_summary}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 pb-4">
                          {!d.ai_summary && (
                            <button
                              onClick={() => { setAnalyzingDoc(d.id); analyzeDocMut.mutate(d.id, { onSettled: () => setAnalyzingDoc(null) }); }}
                              disabled={analyzeDocMut.isPending && analyzingDoc === d.id}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              style={{ background: "rgba(139,92,246,0.25)", color: "#8B5CF6" }}>
                              {analyzeDocMut.isPending && analyzingDoc === d.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Sparkles className="w-3 h-3" />}
                              {analyzeDocMut.isPending && analyzingDoc === d.id ? "Analyzing…" : "AI Analyze"}
                            </button>
                          )}
                          <button onClick={() => downloadDoc(d)}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted transition-colors">
                            <Download className="w-3 h-3" /> Download
                          </button>
                          <button onClick={() => { setEditingNotesDocId(d.id); setNoteDraft(d.notes || ""); }}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 transition-colors">
                            <StickyNote className="w-3 h-3" /> Notes
                          </button>
                        </div>
                        {/* Notes inline editor */}
                        {editingNotesDocId === d.id && (
                          <div className="px-4 pb-4 space-y-2">
                            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
                              placeholder="Add case notes, strategy reminders..."
                              className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-amber-400 resize-none transition-colors"
                              style={{ borderColor: "hsl(var(--border))" }} />
                            <div className="flex gap-2 items-center flex-wrap">
                              <button onClick={() => saveNotesMut.mutate({ docId: d.id, notes: noteDraft })}
                                disabled={saveNotesMut.isPending}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-60">
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button onClick={() => { setEditingNotesDocId(null); setNoteDraft(""); }}
                                className="text-xs text-muted-foreground hover:text-muted-foreground px-2 py-1.5 transition-colors">Cancel</button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EARNINGS ── */}
        {activeSection === "earnings" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Earnings Overview</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Self-reported fees you record for accepted cases; these are not verified payments.</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-2xl p-6 shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(52,211,153,0.12)" }}>
                  <Award className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-foreground">₹{recordedMonthlyEarnings.toLocaleString("en-IN")}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Recorded This Month</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{monthlyFeeCases.length} fee{monthlyFeeCases.length !== 1 ? "s" : ""} recorded this month</p>
              </div>
              <div className="bg-card rounded-2xl p-6 shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(139,92,246,0.12)" }}>
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <p className="text-3xl font-black text-foreground">₹{recordedTotalEarnings.toLocaleString("en-IN")}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Recorded Fees</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{recordedFeeCount} of {acceptedLeads.length} accepted cases have a fee</p>
              </div>
              <div className="bg-card rounded-2xl p-6 shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(245,183,84,0.12)" }}>
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-3xl font-black text-foreground">{completedCases.length}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">Closed Cases</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Successfully completed matters</p>
              </div>
            </div>

            {/* Fee entry note */}
            <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-emerald-400 leading-relaxed">
                These are self-reported agreed fees, not verified payments. Enter or update the fee on each accepted case below.
              </p>
            </div>

            {/* Accepted cases list for earnings */}
            {acceptedLeads.length > 0 && (
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  <h3 className="font-bold text-foreground text-sm">Accepted Case Revenue Breakdown</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {acceptedLeads.map((m: any, i: number) => (
                    <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-bold text-muted-foreground/60 w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{m.case_title ?? "Untitled Case"}</p>
                          <p className="text-[11px] text-muted-foreground">{m.case_type ?? "Civil"} · {formatDate(m.created_at, activeCode)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="999999999"
                          step="1"
                          aria-label={`Agreed fee for ${m.case_title ?? "case"}`}
                          placeholder="Agreed fee"
                          value={feeDrafts[m.id] ?? (m.agreed_fee == null ? "" : String(m.agreed_fee))}
                          onChange={(event) => setFeeDrafts((drafts) => ({ ...drafts, [m.id]: event.target.value }))}
                          className="w-32 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                        <button
                          type="button"
                          disabled={
                            saveAgreedFeeMut.isPending ||
                            (feeDrafts[m.id] ?? (m.agreed_fee == null ? "" : String(m.agreed_fee))).trim() === ""
                          }
                          onClick={() => {
                            const raw = feeDrafts[m.id] ?? (m.agreed_fee == null ? "" : String(m.agreed_fee));
                            const value = Number(raw);
                            if (Number.isFinite(value) && value >= 0 && value <= 999999999) {
                              saveAgreedFeeMut.mutate({ matchId: m.id, agreedFee: value });
                            }
                          }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                        >
                          Save fee
                        </button>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Accepted</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
                  <span className="text-sm font-bold text-muted-foreground">Total recorded fees</span>
                  <span className="text-lg font-black text-foreground">₹{recordedTotalEarnings.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}

            {/* Upgrade CTA */}
            {hasPaidPlan ? (
              <button onClick={() => setLocation("/subscription")} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
                Manage plan
              </button>
            ) : (
              <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: "linear-gradient(135deg, #14151F, #1a1b2e)", border: "1px solid rgba(245,183,84,0.2)" }}>
                <Scale className="w-12 h-12 text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-foreground">Unlock Advocate Pro</p>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(245,183,84,0.7)" }}>Unlimited leads, priority placement, and advanced AI tools to grow your earnings</p>
                </div>
                <button onClick={() => setLocation("/subscription")}
                  className="flex-shrink-0 text-sm font-bold py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0A0B10] transition-colors">
                  Upgrade ₹2,499/mo
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Modals ── */}
      <Modal open={showCaseModal} onClose={() => setShowCaseModal(false)} title="Add New Case">
        <CaseForm onSubmit={(data) => createCaseMut.mutate(data)} loading={createCaseMut.isPending} countryCode={activeCode} />
      </Modal>

      <Modal open={!!editingCase} onClose={() => setEditingCase(null)} title="Edit Case">
        <CaseForm
          initialCase={editingCase}
          onSubmit={(data) => editingCase && editCaseMut.mutate({ caseId: editingCase.id, body: data })}
          loading={editCaseMut.isPending}
          countryCode={activeCode}
        />
      </Modal>

      <Modal open={showDocModal} onClose={() => { setShowDocModal(false); setPreselectedCaseId(""); }} title="Upload Document">
        <DocForm cases={cases} preselectedCaseId={preselectedCaseId} onSubmit={(data) => createDocMut.mutate(data)} loading={createDocMut.isPending} />
      </Modal>

      <CaseFolderModal
        open={showFolder}
        onClose={() => setShowFolder(false)}
        caseData={folderCase}
        docs={folderDocs}
        isLoading={docsLoading}
        isError={docsError}
        onUpload={() => { setShowFolder(false); setShowDocModal(true); }}
        onAnalyze={(docId: number) => { setAnalyzingDoc(docId); analyzeDocMut.mutate(docId, { onSettled: () => setAnalyzingDoc(null) }); }}
        analyzingDoc={analyzingDoc}
        analyzePending={analyzeDocMut.isPending}
        onSaveNotes={(docId: number, notes: string) => saveNotesMut.mutate({ docId, notes })}
        notesPending={saveNotesMut.isPending}
        countryCode={activeCode}
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
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
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
            style={{ border: "1px solid hsl(var(--border))" }}
          >
            <button onClick={() => { onDownload(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-primary/10 transition-colors text-left">
              <Download className="w-3.5 h-3.5 text-primary" /> Download
            </button>
            <button onClick={() => { onShare(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-primary/10 transition-colors text-left">
              <Share2 className="w-3.5 h-3.5 text-emerald-400" /> Share / Forward
            </button>
            <button onClick={() => { onNotes(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-primary/10 transition-colors text-left">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" /> Add Notes
            </button>
            {onAnalyze && !doc.ai_summary && (
              <button onClick={() => { onAnalyze(); setShowMenu(false); }} disabled={analyzing}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:bg-primary/10 transition-colors text-left disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> {analyzing ? "Analyzing..." : "AI Analyze"}
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
    toast({ title: "Copied to clipboard", description: "Paste in email, WhatsApp, or court filing." });
  }).catch(() => {
    toast({ title: "Copy failed", description: "Could not copy. Copy manually from the document preview.", variant: "destructive" });
  });
}

// ── Case Folder Modal ────────────────────────────────────────────────────────────────────────────────
function CaseFolderModal({
  open, onClose, caseData, docs, isLoading, isError, onUpload, onAnalyze, analyzingDoc, analyzePending, onSaveNotes, notesPending, countryCode,
}: {
  open: boolean; onClose: () => void; caseData: LawyerCase | null; docs: LawyerDoc[];
  isLoading?: boolean;
  isError?: boolean;
  onUpload: () => void;
  onAnalyze: (docId: number) => void;
  analyzingDoc: number | null;
  analyzePending: boolean;
  onSaveNotes: (docId: number, notes: string) => void;
  notesPending: boolean;
  countryCode?: string;
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
        style={{ border: "1px solid hsl(var(--border))" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card z-10 px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg leading-tight">{caseData.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.25)" }}>{caseData.case_type}</span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  caseData.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : caseData.status === "closed" ? "bg-muted text-muted-foreground border border-border"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20")}>{caseData.status.toUpperCase()}</span>
                {caseData.cnr_number && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.25)" }}>
                    <FileText className="w-2.5 h-2.5" /> {caseTerms(countryCode).short}: {caseData.cnr_number}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1"><MapPin className="w-3 h-3" />{caseData.court_name || "No court"}</span>
              </div>
              <p className="text-[12px] text-muted-foreground mt-1">{caseData.description || "No description"}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Client: {caseData.client_name || "N/A"} · Added {formatDate(caseData.created_at, countryCode)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onUpload} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white transition-colors" style={{ background: "#8B5CF6" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#8B5CF6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#8B5CF6"; }}>
              <Plus className="w-3.5 h-3.5" /> Upload
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-muted-foreground/60" />
            </button>
          </div>
        </div>

        {/* Documents */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground text-sm">Case Documents ({docs.length})</h4>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading documents…
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-6 rounded-xl text-center"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-xs text-red-400 font-medium">Could not load documents</p>
              <p className="text-[11px] text-muted-foreground">Check your connection and try reopening the folder.</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents in this case folder yet.</p>
              <button onClick={onUpload} className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors">Upload your first document →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <motion.div key={d.id} layout className="rounded-xl border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
                  {/* Doc header */}
                  <div className="flex items-start gap-3 p-3.5 bg-card">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.12)" }}>
                      <FileText className="w-4 h-4" style={{ color: "#8B5CF6" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{d.filename}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.25)" }}>{d.file_type.toUpperCase()}</span>
                        {d.ai_summary && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AI Analyzed</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDate(d.created_at, countryCode)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setExpandedDoc(expandedDoc === d.id ? null : d.id)}
                        className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">
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
                        <div className="px-4 pb-4 pt-0 bg-card" style={{ borderTop: "1px solid hsl(var(--muted))" }}>
                          {/* Content preview */}
                          <div className="mt-3 rounded-lg p-3 font-mono text-[12px] leading-relaxed text-muted-foreground" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", maxHeight: "200px", overflow: "auto" }}>
                            {d.content_text || "No text content available."}
                          </div>

                          {/* Notes section */}
                          {editingNotes === d.id ? (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-semibold text-muted-foreground">Your Notes</span>
                              </div>
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                rows={3}
                                placeholder="Add observations, strategy reminders, hearing notes..."
                                className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-amber-400 transition-colors resize-none"
                                style={{ borderColor: "hsl(var(--border))" }}
                              />
                              <div className="flex items-center gap-2">
                                <button onClick={() => { onSaveNotes(d.id, noteText); setEditingNotes(null); }} disabled={notesPending}
                                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-60">
                                  <Check className="w-3 h-3" /> Save Notes
                                </button>
                                <button onClick={() => { setEditingNotes(null); setNoteText(""); }}
                                  className="text-xs font-medium text-muted-foreground hover:text-muted-foreground px-2 py-1.5 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : d.notes ? (
                            <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(245,183,84,0.08)", border: "1px solid rgba(245,183,84,0.35)" }}>
                              <div className="flex items-center gap-2 mb-1">
                                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-xs font-semibold text-amber-400">Your Notes</span>
                                <button onClick={() => { setEditingNotes(d.id); setNoteText(d.notes || ""); }}
                                  className="ml-auto text-[10px] text-amber-400 hover:text-amber-400 font-medium">Edit</button>
                              </div>
                              <p className="text-[12px] text-amber-400 leading-relaxed whitespace-pre-wrap">{d.notes}</p>
                            </div>
                          ) : null}

                          {/* AI Summary */}
                          {d.ai_summary && (
                            <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid #A7F3D0" }}>
                              <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-800">AI Analysis Summary</span>
                              </div>
                              <p className="text-[12px] text-emerald-400 leading-relaxed">{d.ai_summary}</p>
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
function CaseForm({ onSubmit, loading, initialCase, countryCode }: { onSubmit: (data: object) => void; loading: boolean; initialCase?: LawyerCase | null; countryCode?: string }) {
  const isEdit = !!initialCase;
  const courts = getCourts(countryCode ?? "IN");
  const [title, setTitle] = useState(initialCase?.title ?? "");
  const [caseType, setCaseType] = useState(initialCase?.case_type ?? CASE_TYPES[0]);
  const [clientName, setClientName] = useState(initialCase?.client_name ?? "");
  const [courtName, setCourtName] = useState(initialCase?.court_name ?? courts[0]);
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
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Case Title *</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Smith vs. ABC Corp"
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors" style={{ borderColor: "var(--border-oklch)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Case Type</label>
          <button type="button" onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-lg border focus:outline-none" style={{ borderColor: "hsl(var(--border))" }}>
            {caseType} <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
          {showTypeDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-card rounded-lg shadow-lg border py-1" style={{ borderColor: "hsl(var(--border))", maxHeight: "200px", overflow: "auto" }}>
              {CASE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => { setCaseType(t); setShowTypeDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors">{t}</button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Court</label>
          <button type="button" onClick={() => setShowCourtDropdown(!showCourtDropdown)}
            className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-lg border focus:outline-none" style={{ borderColor: "hsl(var(--border))" }}>
            {courtName} <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
          {showCourtDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-card rounded-lg shadow-lg border py-1" style={{ borderColor: "hsl(var(--border))", maxHeight: "200px", overflow: "auto" }}>
              {courts.map((c) => (
                <button key={c} type="button" onClick={() => { setCourtName(c); setShowCourtDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors">{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Client Name</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g., Ravi Shankar"
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors" style={{ borderColor: "var(--border-oklch)" }} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{caseTerms(countryCode).label}</label>
          <input value={cnrNumber} onChange={(e) => setCnrNumber(e.target.value)} placeholder={caseTerms(countryCode).placeholder}
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors" style={{ borderColor: "var(--border-oklch)" }} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief case facts..."
          className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors resize-none" style={{ borderColor: "var(--border-oklch)" }} />
      </div>
      {isEdit && (
        <div className="grid grid-cols-3 gap-2">
          {(["active","pending","closed"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={cn("text-[11px] font-bold px-2 py-2 rounded-lg capitalize transition-all",
                status === s
                  ? s === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : s === "closed" ? "bg-muted text-muted-foreground border border-border"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-background text-muted-foreground/60 border border-border hover:border-border")}>
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
      <div className="flex gap-1 rounded-lg p-1" style={{ background: "hsl(var(--muted))" }}>
        <button type="button" onClick={() => setTab("paste")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "paste" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-muted-foreground")}>Paste Text</button>
        <button type="button" onClick={() => setTab("upload")} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", tab === "upload" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-muted-foreground")}>Upload File</button>
      </div>

      {/* Case selector */}
      {cases.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Link to Case (optional)</label>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors bg-card" style={{ borderColor: "var(--border-oklch)" }}>
            <option value="">No case — general document</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}

      {tab === "paste" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Document Name *</label>
            <input required value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="e.g., FIR_2024_001.txt"
              className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors" style={{ borderColor: "var(--border-oklch)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Document Content *</label>
            <textarea required value={contentText} onChange={(e) => setContentText(e.target.value)} rows={6}
              placeholder="Paste FIR text, charge sheet, contract, or legal notice here..."
              className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors resize-none font-mono" style={{ borderColor: "var(--border-oklch)" }} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Select File</label>
            <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:bg-primary/10 hover:border-primary/40"
              style={{ borderColor: "rgba(139,92,246,0.35)" }} onClick={() => fileRef.current?.click()}>
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--primary-oklch)" }} />
              <p className="text-sm font-medium text-muted-foreground">{filename || "Click to select .txt, .pdf, .doc"}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Max 25MB — text extracted for AI analysis</p>
              <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          {contentText && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Extracted Content Preview</label>
              <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} rows={4}
                className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none focus:border-primary transition-colors resize-none font-mono" style={{ borderColor: "var(--border-oklch)" }} />
            </div>
          )}
        </>
      )}

      <button type="submit" disabled={loading || (!filename.trim() && !contentText.trim())}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Save Document
      </button>
    </form>
  );
}
