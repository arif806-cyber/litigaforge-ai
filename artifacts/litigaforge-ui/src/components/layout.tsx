import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  Scale, FileText, Menu, X,
  Crown, LogOut, User as UserIcon,
  Shield, Star, Briefcase, Sparkles, FileCheck, Newspaper,
  Plus, MessageSquareText, MessageSquare, FileSearch, BookOpen, Heart, Sun, Moon, Users, Zap, Inbox,
  CalendarSearch, Cpu,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, type User, TIER_LABELS } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/hooks/useLanguage";
import type { Translation } from "@/i18n";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { PublicSiteHeader } from "@/components/public-site-header";

interface NavEntry {
  href: string;
  label: string;
  icon: React.ElementType;
  tKey?: keyof Translation;
  highlight?: boolean;
}

const clientNav: NavEntry[] = [
  { href: "/client-dashboard", label: "Dashboard",       icon: Briefcase, tKey: "dashboard" },
  { href: "/post-case",        label: "Post a Case",     icon: Plus,      tKey: "post_case" },
  { href: "/my-cases",         label: "My Cases",        icon: FileText,  tKey: "my_cases" },
  { href: "/matches",          label: "Match Proposals", icon: Sparkles,  tKey: "match_proposals" },
  { href: "/messages",         label: "Messages",        icon: Inbox },
  { href: "/documents",        label: "Documents",       icon: FileCheck, tKey: "documents" },
];

const lawyerNav: NavEntry[] = [
  { href: "/lawyer-dashboard", label: "Dashboard",        icon: Star,      tKey: "dashboard" },
  { href: "/docket", label: "DocketView", icon: CalendarSearch },
  { href: "/lawyer-dashboard/cases", label: "Cases & Hearings", icon: FileText },
  { href: "/lawyer-dashboard/clients", label: "Clients", icon: Users },
  { href: "/judgments",          label: "Judgments",       icon: BookOpen,  tKey: "judgments" },
  { href: "/cnr-tracker",        label: "CNR Tracker",     icon: CalendarSearch },
  { href: "/lawyer-dashboard/documents", label: "Documents", icon: FileCheck, tKey: "documents" },
  { href: "/lawyer-dashboard/earnings", label: "Earnings", icon: Briefcase },
  { href: "/settings",           label: "Settings",        icon: UserIcon },
  { href: "/matches",          label: "Client Requests",  icon: Users,     tKey: "client_requests" },
  { href: "/messages",         label: "Messages",         icon: Inbox },
  { href: "/review",           label: "Doc Analyzer",     icon: FileSearch, tKey: "doc_analyzer" },
  { href: "/subscription",     label: "Profile & Plans",  icon: Crown,     tKey: "profile_plans" },
];

const commonNav: NavEntry[] = [
  { href: "/legal-chat",     label: "AI Legal Drafting", icon: MessageSquareText },
  { href: "/ask",            label: "Legal Information Q&A", icon: MessageSquare },
  { href: "/review",         label: "Doc Analyzer",    icon: FileSearch,        tKey: "doc_analyzer" },
  { href: "/cnr-tracker",    label: "CNR Tracker",     icon: CalendarSearch },
  { href: "/judgments",      label: "Judgments",       icon: BookOpen,          tKey: "judgments" },
  { href: "/workspace",     label: "Forge Workspace", icon: Zap,               highlight: true },
  { href: "/free-documents", label: "Free Documents",  icon: FileCheck,         tKey: "free_documents" },
  { href: "/legal-aid",      label: "Free Legal Aid",  icon: Heart,             tKey: "free_aid" },
  { href: "/blog",           label: "Legal Guides",    icon: Newspaper,         tKey: "legal_guides" },
];

const publicNav: NavEntry[] = [
  { href: "/ask",            label: "Ask",            icon: MessageSquare },
  { href: "/free-documents", label: "Documents",      icon: FileCheck },
  { href: "/review",         label: "Analyzer",       icon: FileSearch },
  { href: "/judgments",      label: "Judgments",      icon: BookOpen },
  { href: "/legal-aid",      label: "Legal Aid",      icon: Heart },
  { href: "/lawyers",        label: "Find a Lawyer",  icon: Users },
  { href: "/for-lawyers",    label: "For Lawyers",    icon: Briefcase },
  { href: "/login",          label: "Login",          icon: UserIcon },
];

// Translate a nav entry's display label while keeping the English label for
// stable data-testid generation.
function navLabel(item: NavEntry, t: Translation): string {
  return item.tKey && t[item.tKey] ? t[item.tKey] : item.label;
}

/* ─── Unread messages hook ─── */
function useUnreadCount() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["chat-threads", user?.id],
    queryFn: () => apiFetch("/chat/threads"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const threads: Array<{ unread_count?: number }> = data?.threads ?? [];
  return threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
}

/* ─── Nav Item ─── */
function NavItem({
  href, label, icon: Icon, location, onClick, testId, highlight, badge,
}: {
  href: string; label: string; icon: React.ElementType; location: string; onClick?: () => void; testId?: string; highlight?: boolean; badge?: number;
}) {
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return (
    <Link
      href={href}
      data-testid={testId ?? `nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={{
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...(highlight && !active ? {
          background: "color-mix(in oklch, var(--secondary) 12%, transparent)",
          border: "1px solid color-mix(in oklch, var(--secondary) 30%, transparent)",
        } : {}),
      }}
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] transition-all duration-200 cursor-pointer relative group",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm active:opacity-80"
          : highlight
            ? "font-bold hover:bg-secondary/10 active:bg-secondary/10"
            : "font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent active:text-sidebar-foreground"
      )}>
      <Icon className={cn(
        "w-4 h-4 flex-shrink-0",
        active ? "text-sidebar-primary-foreground" : highlight ? "text-secondary" : "group-hover:text-sidebar-foreground"
      )} />
      <span className={cn("tracking-wide flex-1", highlight && !active ? "text-secondary" : "")}>{label}</span>
      {badge != null && badge > 0 && !active && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {highlight && !active && !badge && (
        <span className="ml-auto text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
          style={{ background: "color-mix(in oklch, var(--secondary) 20%, transparent)", color: "var(--secondary-foreground)" }}>
          NEW
        </span>
      )}
    </Link>
  );
}

/* ─── Admin section ─── */
function AdminSection({ location, onNav }: { location: string; onNav?: () => void }) {
  const { user } = useAuth();
  if (!user?.is_superuser) return null;
  return (
    <div className="mt-4 border-t border-sidebar-border/60 pt-3">
      <div className="px-3.5 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">Admin</div>
      <NavItem href="/admin" label="Admin Panel" icon={Shield} location={location} onClick={onNav} testId="nav-admin" />
      <NavItem href="/forgeos" label="ForgeOS Command Center" icon={Cpu} location={location} onClick={onNav} testId="nav-forgeos" />
    </div>
  );
}

/* ─── User panel ─── */
function UserPanel({ onNav }: { onNav?: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  if (!user) return null;

  const handleLogout = () => { logout(); if (onNav) onNav(); setLocation("/login"); };

  return (
    <div className="border-t border-sidebar-border/40 px-3.5 py-4 space-y-2">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">{user.email}</p>
        </div>
      </div>
      <Link href="/settings" onClick={onNav}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-medium cursor-pointer text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent active:text-sidebar-foreground">
          <Shield className="w-4 h-4" /> Account &amp; Privacy
        </div>
      </Link>
      <button onClick={handleLogout}
        style={{ touchAction: "manipulation" }}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent active:text-sidebar-foreground transition-all text-xs font-medium">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}

/* ─── Sidebar content ─── */
function SidebarContent({
  location, onNav, user,
}: {
  location: string;
  onNav?: () => void;
  user: User | null;
}) {
  const { t } = useLanguage();
  const unreadCount = useUnreadCount();
  const isAdvocate = user?.role === "lawyer" || user?.role === "advocate";
  const viewingClientWorkspace = location.startsWith("/client");
  const isClient = !!user && (!isAdvocate || viewingClientWorkspace);
  const roleNav = !user ? publicNav : isClient ? clientNav : lawyerNav;
  const roleLabel = !user ? "Public tools" : isClient ? "Client" : "Advocate";
  const showRoleSwitch = !!user && (isAdvocate || !!user.lawyer_status);
  const roleSwitch: NavEntry | null = showRoleSwitch
    ? isClient
      ? { href: "/lawyer-dashboard", label: "Switch to Advocate", icon: Scale }
      : { href: "/client-dashboard", label: "Switch to Client", icon: UserIcon }
    : null;
  const legalTools = isAdvocate
    ? commonNav.filter(item => !["/cnr-tracker", "/judgments", "/review"].includes(item.href))
    : commonNav;

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0 border-b border-sidebar-border/40">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary/15 flex items-center justify-center">
            <Scale className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">LitigaForge</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.5 rounded-md bg-sidebar-accent text-[10px] font-semibold text-sidebar-accent-foreground uppercase tracking-wide">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
          {!user ? "Explore" : isClient ? "Match & Connect" : "Lawyer Portal"}
        </div>
        {roleNav.map(item => (
          <NavItem
            key={item.href}
            {...item}
            label={navLabel(item, t)}
            testId={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            location={location}
            onClick={onNav}
            badge={item.href === "/messages" ? unreadCount : undefined}
          />
        ))}
        {roleSwitch && (
          <NavItem
            key={roleSwitch.href}
            {...roleSwitch}
            label={roleSwitch.label}
            testId="nav-role-switch"
            location={location}
            onClick={onNav}
          />
        )}

        {user && <div className="px-3 pt-4 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">Legal Tools</div>}
        {user && legalTools.map(item => (
          <NavItem
            key={item.href}
            {...item}
            label={navLabel(item, t)}
            testId={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            location={location}
            onClick={onNav}
          />
        ))}
        <AdminSection location={location} onNav={onNav} />
      </nav>

      <UserPanel onNav={onNav} />
    </div>
  );
}

/* ─── Mobile-only nav arrays (5-slot bottom bar) ─── */
const clientMobileNav: NavEntry[] = [
  { href: "/client-dashboard", label: "Dashboard", icon: Briefcase, tKey: "dashboard" },
  { href: "/my-cases",         label: "Cases",     icon: FileText,  tKey: "my_cases"  },
];
const lawyerMobileNav: NavEntry[] = [
  { href: "/lawyer-dashboard", label: "Dashboard", icon: Star  },
  { href: "/matches",          label: "Cases",     icon: Users },
];

/* ─── Bottom Tab Bar ─── */
function BottomTabBar({ location, user }: { location: string; user: User | null }) {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const unreadCount = useUnreadCount();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useEffect(() => { closeDrawer(); }, [location, closeDrawer]);

  const isLawyer  = user?.role === "lawyer";
  const mobileNav = isLawyer ? lawyerMobileNav : clientMobileNav;
  const fabHref   = isLawyer ? "/lawyer-dashboard" : "/post-case";

  const extraNav: NavEntry[] = isLawyer
    ? [
        { href: "/review",       label: "Doc Analyzer",    icon: FileSearch, tKey: "doc_analyzer"  },
        { href: "/subscription", label: "Profile & Plans", icon: Crown,      tKey: "profile_plans" },
      ]
    : [
        { href: "/matches",   label: "Match Proposals", icon: Sparkles,  tKey: "match_proposals" },
        { href: "/documents", label: "Documents",        icon: FileCheck, tKey: "documents"       },
      ];

  const msgsActive = location.startsWith("/messages");
  const moreActive = [...extraNav, ...commonNav].some(s => location.startsWith(s.href));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-card/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-2 z-30"
        style={{ boxShadow: "0 -1px 0 color-mix(in oklch, var(--foreground) 8%, transparent), 0 -8px 32px color-mix(in oklch, var(--background) 90%, transparent)" }}
      >
        {/* Left 2 primary tabs */}
        {mobileNav.map(({ href, icon: Icon, tKey, label }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-95 transition-all duration-150"
            >
              <div className={cn("flex items-center justify-center w-9 h-9 rounded-xl transition-all", active ? "bg-primary/15" : "")}>
                <Icon className={cn("w-5 h-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[10px] font-medium leading-none transition-colors", active ? "text-primary font-semibold" : "text-muted-foreground")}>
                {(tKey && t[tKey]) ? t[tKey] : label}
              </span>
            </Link>
          );
        })}

        {/* Centre FAB */}
        <Link href={fabHref}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full -mt-3 active:scale-90 transition-all duration-150"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 72%, var(--foreground)))", boxShadow: "0 4px 16px color-mix(in oklch, var(--primary) 40%, transparent)" }}
          >
            <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-semibold text-primary leading-none mt-0.5">
            {isLawyer ? "Add" : "Post"}
          </span>
        </Link>

        {/* Messages */}
        <Link href="/messages"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-95 transition-all duration-150"
        >
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-xl transition-all relative", msgsActive ? "bg-primary/15" : "")}>
            <Inbox className={cn("w-5 h-5 transition-colors", msgsActive ? "text-primary" : "text-muted-foreground")} />
            {unreadCount > 0 && !msgsActive && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className={cn("text-[10px] font-medium leading-none transition-colors", msgsActive ? "text-primary font-semibold" : "text-muted-foreground")}>
            Messages
          </span>
        </Link>

        {/* More */}
        <button
          onPointerDown={openDrawer}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-95 transition-all duration-150"
        >
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-xl transition-all", moreActive ? "bg-primary/15" : "")}>
            <Menu className={cn("w-5 h-5 transition-colors", moreActive ? "text-primary" : "text-muted-foreground")} />
          </div>
          <span className={cn("text-[10px] font-medium leading-none transition-colors", moreActive ? "text-primary font-semibold" : "text-muted-foreground")}>
            More
          </span>
        </button>
      </nav>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div key="btm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9996 }}
                onPointerDown={closeDrawer}
              />
              <motion.div key="btm-drawer" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                style={{ zIndex: 9997 }}
                className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-2xl pb-safe"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Menu</p>
                  <button onPointerDown={closeDrawer} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="px-3 grid grid-cols-3 gap-2">
                  {[...extraNav, ...commonNav].map((item) => {
                    const { href, icon: Icon, label } = item;
                    const active = location.startsWith(href);
                    return (
                      <Link key={href} href={href} onClick={closeDrawer}
                        style={{ touchAction: "manipulation" }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors active:scale-95",
                          active ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground",
                          item.highlight && !active ? "border border-secondary/20" : ""
                        )}
                      >
                        <Icon className={cn("w-5 h-5", active ? "text-primary" : item.highlight ? "text-secondary" : "text-muted-foreground")} />
                        <span className={cn("text-[11px] font-medium leading-tight", item.highlight && !active ? "text-secondary" : "")}>{label}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="px-4 pt-3 pb-6 border-t border-border mt-3">
                  <button
                    onPointerDown={() => { closeDrawer(); logout(); setLocation("/login"); }}
                    style={{ touchAction: "manipulation" }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-all text-sm font-semibold"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/* ─── Desktop header logout button ─── */
function DesktopLogoutButton() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => { logout(); setLocation("/login"); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
      <span>Sign Out</span>
    </button>
  );
}

/* ─── Main Layout ─── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isWorkspace = location.startsWith("/workspace");
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  useMessageNotifications();
  const publicSurface = !user && !isWorkspace && /^(\/ask|\/review|\/judgments(?:\/|$)|\/lawyers(?:\/|$)|\/legal-aid|\/free-documents)/.test(location);

  if (publicSurface) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        <PublicSiteHeader mobileMenu />
        <main className="min-h-[50vh] flex-1">{children}</main>
        <LegalDisclaimerFooter />
      </div>
    );
  }

  return (
    <div className="lf-app-layout flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Mobile top header */}
      <header className="flex-shrink-0 border-b border-border bg-card z-20 flex items-center justify-between px-4 h-14 shadow-sm md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">LitigaForge</span>
            {user && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-accent/20 text-[9px] font-bold text-accent-foreground uppercase tracking-wide">
                {user.role !== "lawyer" && user.role !== "advocate" ? "Client" : "Advocate"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CountrySwitcher />
          <LanguageSwitcher />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors active:scale-95"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col relative z-10" style={{ boxShadow: "var(--cfos-elev-3)" }}>
          <SidebarContent location={location} user={user} />
        </aside>

        {/* Main content */}
        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden relative z-0 flex flex-col pb-[72px] md:pb-0 bg-background",
          isWorkspace && "min-h-0 overflow-hidden pb-0",
        )}>
          {/* Desktop sticky header */}
          <header className="hidden md:flex flex-shrink-0 h-14 border-b border-border bg-card px-6 items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Scale className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">LitigaForge AI</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <CountrySwitcher />
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {user && (
                <Link href="/subscription" className="flex items-center gap-2 text-xs font-semibold text-foreground bg-accent/80 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors border border-accent-border">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  {user.role === "client"
                    ? (user.subscription_tier === "free" ? "Client Free" : "Client Pro")
                    : (TIER_LABELS[user.subscription_tier] ?? "Free")}
                </Link>
              )}
              {user && (
                <DesktopLogoutButton />
              )}
            </div>
          </header>

          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
            <div className={cn("relative z-10 flex flex-col", isWorkspace ? "h-full min-h-0 overflow-hidden" : "min-h-full")}>
              <div className={cn("flex-1", isWorkspace && "min-h-0 overflow-hidden")}>{children}</div>
              {!isWorkspace && <LegalDisclaimerFooter />}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      {user && !isWorkspace && <BottomTabBar location={location} user={user} />}
    </div>
  );
}
