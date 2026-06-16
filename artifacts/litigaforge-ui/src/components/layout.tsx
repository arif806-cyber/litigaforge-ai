import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  Scale, FileText, Menu, X,
  Crown, LogOut, User as UserIcon,
  Shield, Star, Briefcase, Sparkles, FileCheck, Newspaper,
  Plus, MessageSquareText, MessageSquare, FileSearch, BookOpen, Heart, Sun, Moon, Users, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, type User, TIER_LABELS } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/hooks/useLanguage";
import type { Translation } from "@/i18n";

interface NavEntry {
  href: string;
  label: string;
  icon: React.ElementType;
  tKey?: keyof Translation;
}

const clientNav: NavEntry[] = [
  { href: "/client-dashboard", label: "Dashboard",       icon: Briefcase, tKey: "dashboard" },
  { href: "/post-case",        label: "Post a Case",     icon: Plus,      tKey: "post_case" },
  { href: "/my-cases",         label: "My Cases",        icon: FileText,  tKey: "my_cases" },
  { href: "/matches",          label: "Match Proposals", icon: Sparkles,  tKey: "match_proposals" },
  { href: "/documents",        label: "Documents",       icon: FileCheck, tKey: "documents" },
];

const lawyerNav: NavEntry[] = [
  { href: "/lawyer-dashboard", label: "Dashboard",        icon: Star,      tKey: "dashboard" },
  { href: "/matches",          label: "Client Requests",  icon: Users,     tKey: "client_requests" },
  { href: "/review",           label: "Doc Analyzer",     icon: FileSearch, tKey: "doc_analyzer" },
  { href: "/subscription",     label: "Profile & Plans",  icon: Crown,     tKey: "profile_plans" },
];

const commonNav: NavEntry[] = [
  { href: "/workspace",      label: "Forge Workspace", icon: Zap },
  { href: "/legal-chat",     label: "AI Legal Chat",   icon: MessageSquareText, tKey: "legal_chat" },
  { href: "/ask",            label: "Legal Q&A",       icon: MessageSquare,     tKey: "legal_qa" },
  { href: "/review",         label: "Doc Analyzer",    icon: FileSearch,        tKey: "doc_analyzer" },
  { href: "/judgments",      label: "Judgments",       icon: BookOpen,          tKey: "judgments" },
  { href: "/free-documents", label: "Free Documents",  icon: FileCheck,         tKey: "free_documents" },
  { href: "/legal-aid",      label: "Free Legal Aid",  icon: Heart,             tKey: "free_aid" },
  { href: "/blog",           label: "Legal Guides",    icon: Newspaper,         tKey: "legal_guides" },
];

// Translate a nav entry's display label while keeping the English label for
// stable data-testid generation.
function navLabel(item: NavEntry, t: Translation): string {
  return item.tKey && t[item.tKey] ? t[item.tKey] : item.label;
}

/* ─── Nav Item ─── */
function NavItem({
  href, label, icon: Icon, location, onClick, testId,
}: {
  href: string; label: string; icon: React.ElementType; location: string; onClick?: () => void; testId?: string;
}) {
  const active = href === "/" ? location === "/" : location.startsWith(href);
  return (
    <Link
      href={href}
      data-testid={testId ?? `nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer relative group",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm active:opacity-80"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent active:text-sidebar-foreground"
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
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm active:opacity-80"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent active:text-sidebar-foreground"
      )}>
      <Shield className={cn("w-4 h-4 flex-shrink-0", active ? "text-sidebar-primary-foreground" : "group-hover:text-sidebar-foreground")} />
      <span className="tracking-wide relative z-10">Admin</span>
    </Link>
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
  const isClient = user?.role !== "lawyer";
  const roleNav = isClient ? clientNav : lawyerNav;
  const roleLabel = isClient ? "Client" : "Advocate";

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
          {isClient ? "Match & Connect" : "Lawyer Portal"}
        </div>
        {roleNav.map(item => (
          <NavItem
            key={item.href}
            {...item}
            label={navLabel(item, t)}
            testId={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            location={location}
            onClick={onNav}
          />
        ))}

        <div className="px-3 pt-4 pb-2 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">Legal Tools</div>
        {commonNav.map(item => (
          <NavItem
            key={item.href}
            {...item}
            label={navLabel(item, t)}
            testId={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            location={location}
            onClick={onNav}
          />
        ))}
        <AdminNavItem location={location} onNav={onNav} />
      </nav>

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
  const { t } = useLanguage();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);

  /* Close when route changes */
  useEffect(() => { closeDrawer(); }, [location, closeDrawer]);

  /* Lock body scroll while drawer is open */
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
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
                {user.role !== "lawyer" ? "Client" : "Advocate"}
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
          <button
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
            onPointerDown={openDrawer}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col relative z-10" style={{ boxShadow: "var(--cfos-elev-3)" }}>
          <SidebarContent location={location} user={user} />
        </aside>

        {/* Mobile drawer — portalled to document.body so no overflow ancestor clips it */}
        {typeof document !== "undefined" && createPortal(
          <>
            {/* Backdrop — plain div, onClick is most reliable cross-browser close */}
            <AnimatePresence>
              {drawerOpen && (
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  aria-label="Close menu"
                  role="button"
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.65)",
                    zIndex: 9998,
                  }}
                  onPointerDown={closeDrawer}
                />
              )}
            </AnimatePresence>

            {/* Drawer panel */}
            <AnimatePresence>
              {drawerOpen && (
                <motion.aside
                  key="drawer"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  style={{ zIndex: 9999 }}
                  className="fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl"
                >
                  {/* Close button — top right of drawer */}
                  <button
                    className="absolute top-3.5 right-3.5 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-sidebar-accent/80 text-sidebar-foreground active:scale-90 transition-transform"
                    onPointerDown={closeDrawer}
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <SidebarContent location={location} onNav={closeDrawer} user={user} />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-card/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-1 z-30 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {(user?.role === "lawyer" ? lawyerNav : clientNav).map((item) => {
          const { href, icon: Icon } = item;
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
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
                {navLabel(item, t)}
              </span>
            </Link>
          );
        })}
        <button
          onPointerDown={openDrawer}
          className="flex flex-col items-center justify-center gap-1 w-[72px] h-full rounded-2xl active:scale-95 transition-all"
        >
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
