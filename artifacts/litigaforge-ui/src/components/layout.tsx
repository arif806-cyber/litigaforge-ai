import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  Scale, FileText, Link2, Activity, Clock, Menu, X, Lightbulb,
  Crown, LogOut, User as UserIcon, ChevronRight, MessageSquare, FileSearch,
  BookOpen, Users, Heart, Sun, Moon, Plus, Gavel, MessageSquareText,
  AlertTriangle, Shield, Star, Briefcase, Sparkles, FileCheck, Newspaper
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, type User, TIER_LABELS } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";

const clientNav = [
  { href: "/client-dashboard", label: "Dashboard",       icon: Briefcase },
  { href: "/post-case",       label: "Post a Case",     icon: Plus },
  { href: "/my-cases",        label: "My Cases",        icon: FileText },
  { href: "/matches",         label: "Match Proposals", icon: Sparkles },
  { href: "/documents",       label: "Documents",       icon: FileCheck },
];

const lawyerNav = [
  { href: "/lawyer-dashboard", label: "Dashboard",        icon: Star },
  { href: "/",                 label: "AI Forge",          icon: Scale },
  { href: "/matches",          label: "Client Requests",  icon: Users },
  { href: "/cases",            label: "Forged Cases",     icon: Gavel },
  { href: "/review",           label: "Doc Analyzer",     icon: FileSearch },
  { href: "/subscription",     label: "Profile & Plans",  icon: Crown },
];

const commonNav = [
  { href: "/legal-chat",     label: "AI Legal Chat",   icon: MessageSquareText },
  { href: "/ask",            label: "Legal Q&A",       icon: MessageSquare },
  { href: "/review",         label: "Doc Analyzer",    icon: FileSearch },
  { href: "/judgments",      label: "Judgments",       icon: BookOpen },
  { href: "/cases",          label: "Forged Cases",    icon: Gavel },
  { href: "/use-cases",      label: "Use Cases",       icon: Lightbulb },
  { href: "/free-documents", label: "Free Documents",  icon: FileCheck },
  { href: "/chains",         label: "API Chains",      icon: Link2 },
  { href: "/legal-aid",      label: "Free Legal Aid",  icon: Heart },
  { href: "/blog",           label: "Legal Guides",    icon: Newspaper },
];

/* ─── Animated counter ─── */
function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let start = displayValue;
    const increment = (value - start) / (1000 / 16);
    if (increment === 0) return;
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= value) || (increment < 0 && start <= value)) {
        clearInterval(timer);
        setDisplayValue(value);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{displayValue}</span>;
}

/* ─── Nav Item ─── */
function NavItem({
  href, label, icon: Icon, location, onClick,
}: {
  href: string; label: string; icon: React.ElementType; location: string; onClick?: () => void;
}) {
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return (
    <Link
      href={href}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer relative group",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}>
      <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-sidebar-primary-foreground" : "group-hover:text-sidebar-foreground")} />
      <span className="tracking-wide">{label}</span>
    </Link>
  );
}

/* ─── Admin nav item ─── */
function AdminNavItem({ location, onNav }: { location: string; onNav?: () => void }) {
  const { user } = useAuth();
  if (!user?.is_superuser) return null;
  const href = "/admin";
  const active = location.startsWith(href);
  return (
    <Link href={href} data-testid="nav-admin" onClick={onNav}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer relative group",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}>
      <Shield className={cn("w-4 h-4 flex-shrink-0", active ? "text-sidebar-primary-foreground" : "group-hover:text-sidebar-foreground")} />
      <span className="tracking-wide relative z-10">Admin</span>
    </Link>
  );
}

/* ─── User panel ─── */
function UserPanel({ onNav }: { onNav?: () => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
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
      <Link href="/settings" onClick={onNav}>
        <div className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-medium cursor-pointer ${
          location === "/settings"
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        }`}>
          <Shield className="w-4 h-4" /> Account &amp; Privacy
        </div>
      </Link>
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all text-xs font-medium">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}

/* ─── Sidebar content ─── */
function SidebarContent({
  location, health, stats, onNav, user,
}: {
  location: string;
  health: { dummy_mode: boolean; ai_mode?: string; active_providers?: string[] } | undefined;
  stats: { total_cases: number; total_patterns: number } | undefined;
  onNav?: () => void;
  user: User | null;
}) {
  const isClient = user?.role !== "lawyer";
  const roleNav = isClient ? clientNav : lawyerNav;
  const toolsNav = isClient ? commonNav.filter(i => i.href !== "/chains") : commonNav;
  const roleLabel = isClient ? "Client" : "Advocate";

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
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
      <nav className="flex-1 px-3 space-y-1 overflow-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
          {isClient ? "Match & Connect" : "Lawyer Portal"}
        </div>
        {roleNav.map(item => <NavItem key={item.href} {...item} location={location} onClick={onNav} />)}

        <div className="px-3 pt-4 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">Legal Tools</div>
        {toolsNav.map(item => <NavItem key={item.href} {...item} location={location} onClick={onNav} />)}
        <AdminNavItem location={location} onNav={onNav} />
      </nav>

      {/* Stats */}
      {stats && (
        <div className="px-5 py-3 border-t border-sidebar-border/40 flex-shrink-0">
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/40">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {health?.dummy_mode ? "Fallback" : "Live"} AI
            </span>
            <span>{stats.total_cases} cases</span>
          </div>
        </div>
      )}

      <UserPanel onNav={onNav} />
    </div>
  );
}

/* ─── Main Layout ─── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => { setDrawerOpen(false); }, [location]);

  /* Lock body scroll while drawer is open — prevents background scroll
     capture on Android Chrome that swallows the backdrop tap event */
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (drawerOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch("/healthz"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ["memory-stats"],
    queryFn: () => apiFetch("/memory/stats"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile header */}
      <header className="flex-shrink-0 border-b border-border bg-card z-20 flex items-center justify-between px-4 h-14 shadow-sm md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">LitigaForge</span>
            {user && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-accent/20 text-[9px] font-bold text-accent-foreground uppercase tracking-wide">
                {user.role !== "lawyer" ? "Client" : "Advocate"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors active:scale-95"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col relative z-10 shadow-xl">
          <SidebarContent location={location} health={health} stats={stats} user={user} />
        </aside>

        {/* Mobile drawer + backdrop — portal into document.body (no overflow ancestor).
            Backdrop uses a plain <div> (not motion.div) with onTouchStart+preventDefault
            — the most reliable Android Chrome touch dismiss pattern. */}
        {typeof document !== "undefined" && createPortal(
          <>
            {drawerOpen && (
              <div
                aria-label="Close menu"
                role="button"
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  zIndex: 9998,
                  touchAction: "none",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
                onTouchStart={(e) => { e.preventDefault(); setDrawerOpen(false); }}
                onPointerDown={() => setDrawerOpen(false)}
              />
            )}
            <AnimatePresence>
              {drawerOpen && (
                <motion.aside
                  key="drawer"
                  initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 350, damping: 32 }}
                  style={{ zIndex: 9999 }}
                  className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl"
                >
                  <button
                    className="absolute top-3.5 right-3.5 flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
                    onTouchStart={(e) => { e.preventDefault(); setDrawerOpen(false); }}
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <SidebarContent
                    location={location} health={health} stats={stats}
                    onNav={() => setDrawerOpen(false)} user={user}
                  />
                </motion.aside>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto relative z-0 flex flex-col pb-[72px] md:pb-0 bg-background">
          {/* Desktop sticky header */}
          <header className="hidden md:flex flex-shrink-0 h-14 border-b border-border bg-card/80 backdrop-blur-md px-6 items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              {health?.dummy_mode ? (
                <span className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg text-xs border border-amber-200 dark:border-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fallback Mode
                </span>
              ) : (
                <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg text-xs border border-emerald-200 dark:border-emerald-900">
                  <Activity className="w-3.5 h-3.5" /> Live AI Engine
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {user && (
                <Link href="/subscription" className="flex items-center gap-2 text-xs font-semibold text-foreground bg-accent/80 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors border border-accent-border">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  {TIER_LABELS[user.subscription_tier] ?? "Free"}
                </Link>
              )}
            </div>
          </header>

          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <LegalDisclaimerFooter />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-card/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-1 z-30 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
        {(user?.role === "lawyer" ? lawyerNav : clientNav).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-[72px] h-full rounded-2xl transition-all duration-200 active:scale-95",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                active ? "bg-primary/10" : ""
              )}>
                <Icon className={cn("w-[22px] h-[22px] transition-colors", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[11px] font-medium transition-colors leading-none", active ? "text-primary font-semibold" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
        <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center justify-center gap-1 w-[72px] h-full rounded-2xl active:scale-95 transition-all">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
            commonNav.some(s => location.startsWith(s.href)) ? "bg-primary/10" : ""
          )}>
            <Menu className={cn("w-[22px] h-[22px] transition-colors", commonNav.some(s => location.startsWith(s.href)) ? "text-primary" : "text-muted-foreground")} />
          </div>
          <span className={cn("text-[11px] font-medium leading-none", commonNav.some(s => location.startsWith(s.href)) ? "text-primary font-semibold" : "text-muted-foreground")}>
            More
          </span>
        </button>
      </nav>
    </div>
  );
}
