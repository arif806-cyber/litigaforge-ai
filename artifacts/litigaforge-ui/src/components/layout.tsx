import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Scale, FileText, Menu, ChevronLeft,
  Crown, LogOut, User as UserIcon,
  Shield, Star, Briefcase, Sparkles, FileCheck, Newspaper,
  Plus, MessageSquareText, MessageSquare, FileSearch, BookOpen, Heart, Sun, Moon, Users, Zap, Inbox,
  CalendarSearch, CalendarDays, Cpu,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth, type User, TIER_LABELS } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/hooks/useLanguage";
import type { Translation } from "@/i18n";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { PublicSiteHeader } from "@/components/public-site-header";
import { clientNavigationActive } from "@/lib/active-portal";
import { GroupedList, GroupedRow, NavBar, Sheet, TabBar } from "@/components/mobile-primitives";
import { FeatureIcon } from "@/components/FeatureIcon";
import { FEATURE_BY_HREF } from "@/lib/featureIcons";

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
  { href: "/lawyer-dashboard", label: "Today", icon: Star },
  { href: "/lawyer-dashboard/cases", label: "Cases", icon: FileText },
  { href: "/cause-lists", label: "Cause lists", icon: CalendarSearch },
  { href: "/lawyer-dashboard/clients", label: "Clients", icon: Users },
  { href: "/lawyer-dashboard/documents", label: "Documents", icon: FileCheck },
  { href: "/judgments", label: "Research", icon: BookOpen },
  { href: "/lawyer-dashboard/earnings", label: "Earnings", icon: Briefcase },
  { href: "/settings", label: "Settings", icon: UserIcon },
];

const advocateTabGroups = [
  { key: "cases", matches: ["/lawyer-dashboard/cases", "/cnr-tracker", "/cnr"], tabs: [{ label: "Cases", href: "/lawyer-dashboard/cases" }, { label: "CNR Tracker", href: "/cnr-tracker" }] },
  { key: "clients", matches: ["/lawyer-dashboard/clients", "/matches", "/requests", "/messages", "/advocate/cases"], tabs: [{ label: "Clients", href: "/lawyer-dashboard/clients" }, { label: "Requests", href: "/matches" }, { label: "Messages", href: "/messages" }] },
  { key: "documents", matches: ["/lawyer-dashboard/documents", "/documents", "/review"], tabs: [{ label: "Documents", href: "/lawyer-dashboard/documents" }, { label: "Analyzer", href: "/review" }] },
  { key: "research", matches: ["/judgments", "/legal-chat", "/ask", "/workspace"], tabs: [{ label: "Judgments", href: "/judgments" }, { label: "AI drafting", href: "/legal-chat" }, { label: "Q&A", href: "/ask" }, { label: "Workspace", href: "/workspace" }] },
  { key: "settings", matches: ["/settings", "/subscription"], tabs: [{ label: "Account", href: "/settings" }, { label: "Profile & plan", href: "/subscription" }] },
];

function AdvocateGroupTabs({ location }: { location: string }) {
  const group = advocateTabGroups.find(({ matches }) => matches.some((path) => location === path || location.startsWith(`${path}/`)));
  if (!group) return null;
  return (
    <nav aria-label={`${group.key} sections`} data-testid={`advocate-tabs-${group.key}`} className="flex gap-1 overflow-x-auto border-b border-border px-4 md:px-8">
      {group.tabs.map((tab) => {
        const active = location === tab.href || location.startsWith(`${tab.href}/`);
        return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
          className={cn("shrink-0 border-b-2 px-3 py-3 text-sm font-medium", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}</Link>;
      })}
    </nav>
  );
}

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

function isNavPathActive(href: string, location: string): boolean {
  const isPath = (path: string) => location === path || location.startsWith(`${path}/`);
  if (href === "/lawyer-dashboard/cases") return isPath(href) || isPath("/cnr-tracker");
  if (href === "/lawyer-dashboard/clients") return [href, "/matches", "/requests", "/messages", "/advocate/cases"].some(isPath);
  if (href === "/lawyer-dashboard/documents") return [href, "/documents", "/review"].some(isPath);
  if (href === "/judgments") return [href, "/legal-chat", "/ask", "/workspace"].some(isPath);
  if (href === "/cause-lists") return [href, "/docket"].some(isPath);
  if (href === "/settings") return [href, "/subscription"].some(isPath);
  if (href === "/lawyer-dashboard") {
    return location === href || location === "/advocate-dashboard";
  }
  return location === href || location.startsWith(`${href}/`);
}

function mobileTitleForPath(path: string): string {
  if (path.startsWith("/client-dashboard")) return "Dashboard";
  if (path.startsWith("/lawyer-dashboard/cases")) return "Cases";
  if (path.startsWith("/lawyer-dashboard/clients")) return "Clients";
  if (path.startsWith("/lawyer-dashboard/documents")) return "Documents";
  if (path.startsWith("/lawyer-dashboard/earnings")) return "Earnings";
  if (path.startsWith("/lawyer-dashboard")) return "Today";
  if (path.startsWith("/post-case")) return "Post a Case";
  if (path.startsWith("/my-cases/")) return "Case details";
  if (path.startsWith("/my-cases")) return "My cases";
  if (path.startsWith("/advocate/cases/")) return "Case details";
  if (path.startsWith("/requests") || path.startsWith("/matches")) return "Client requests";
  if (path.startsWith("/messages")) return "Messages";
  if (path.startsWith("/judgments/")) return "Judgment details";
  if (path.startsWith("/judgments")) return "Judgment Finder";
  if (path.startsWith("/legal-chat")) return "AI drafting";
  if (path.startsWith("/ask")) return "Legal Q&A";
  if (path.startsWith("/review")) return "Document analyzer";
  if (path.startsWith("/cnr-tracker")) return "CNR Case Tracker";
  if (path.startsWith("/free-documents/") || path.startsWith("/document-template/")) return "Document";
  if (path.startsWith("/free-documents")) return "Free Documents";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/subscription")) return "Subscription Plans";
  if (path.startsWith("/admin")) return "Admin";
  if (path.startsWith("/lawyers/register")) return "Advocate Registration";
  if (path.startsWith("/lawyers")) return "Find a Lawyer";
  if (path.startsWith("/documents")) return "Documents";
  if (path.startsWith("/cause-lists") || path.startsWith("/docket")) return "Cause lists";
  return "LitigaForge";
}

function mobileSubtitleForPath(path: string): string {
  if (path.startsWith("/judgments")) return "Search published Indian court decisions.";
  if (path.startsWith("/subscription")) return "Plans and billing for your account.";
  if (path.startsWith("/cnr-tracker")) return "Track hearings, orders, and case status.";
  if (path.startsWith("/cause-lists") || path.startsWith("/docket")) return "Browse today’s and tomorrow’s cause lists by court.";
  if (path.startsWith("/settings")) return "Manage your account and preferences.";
  if (path.startsWith("/client-dashboard")) return "Your cases, updates, and next steps.";
  if (path.startsWith("/lawyer-dashboard/cases")) return "Your active and completed matters.";
  if (path.startsWith("/lawyer-dashboard/clients")) return "Clients connected to your practice.";
  if (path.startsWith("/lawyer-dashboard/documents")) return "Files and drafts for your cases.";
  if (path.startsWith("/lawyer-dashboard/earnings")) return "Recorded fees and payments.";
  if (path.startsWith("/lawyer-dashboard")) return "Hearings and next steps for your practice.";
  return "";
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
  const active = isNavPathActive(href, location);
  const feature = FEATURE_BY_HREF[href];
  return (
    <Link
      href={href}
      data-testid={testId ?? `nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      style={{
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...(highlight && !active ? {
          background: "color-mix(in oklch, hsl(var(--secondary)) 12%, transparent)",
          border: "1px solid color-mix(in oklch, hsl(var(--secondary)) 30%, transparent)",
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
      {feature
        ? <FeatureIcon feature={feature} size="small" />
        : <Icon className={cn(
            "w-4 h-4 flex-shrink-0",
            active ? "text-sidebar-primary-foreground" : highlight ? "text-secondary" : "group-hover:text-sidebar-foreground"
          )} />}
      <span className={cn("tracking-wide flex-1", highlight && !active ? "text-secondary" : "")}>{label}</span>
      {badge != null && badge > 0 && !active && (
        <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {highlight && !active && !badge && (
        <span className="ml-auto text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
        style={{ background: "color-mix(in oklch, hsl(var(--secondary)) 20%, transparent)", color: "hsl(var(--secondary-foreground))" }}>
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
          <FeatureIcon feature="accountPrivacy" size="small" /> Account &amp; Privacy
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
  const { activePortal, setActivePortal } = useAuth();
  const unreadCount = useUnreadCount();
  const isAdvocateAccount = user?.role === "lawyer" || user?.role === "advocate";
  const isClient = !!user && clientNavigationActive(activePortal, location);
  const isAdvocate = !!user && !isClient;
  const roleNav = !user ? publicNav : isClient ? clientNav : lawyerNav;
  const activeRoleNav = isAdvocate && !isClient ? lawyerNav : roleNav;
  const roleLabel = !user ? "Public tools" : isClient ? "CLIENT" : "ADVOCATE";
  const showRoleSwitch = !!user && (isAdvocateAccount || !!user.has_lawyer_profile || !!user.lawyer_status);
  const roleSwitch: NavEntry | null = showRoleSwitch
    ? isClient
      ? { href: user?.has_lawyer_profile ? "/lawyer-dashboard" : "/lawyers/register?setup=advocate", label: "Switch to Advocate", icon: Scale }
      : { href: "/client-dashboard", label: "Switch to Client", icon: UserIcon }
    : null;
  const legalTools = isAdvocate ? [] : commonNav;

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
        <div data-testid={isAdvocate ? "advocate-group-navigation" : undefined}>
        {activeRoleNav.map(item => (
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
        </div>
        {roleSwitch && (
          <NavItem
            key={roleSwitch.href}
            {...roleSwitch}
            label={roleSwitch.label}
            testId="nav-role-switch"
            location={location}
            onClick={() => {
              setActivePortal(isClient ? "advocate" : "client");
              onNav?.();
            }}
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
  { href: "/lawyer-dashboard", label: "Today", icon: CalendarDays },
  { href: "/lawyer-dashboard/cases", label: "Cases", icon: FileText },
  { href: "/cause-lists", label: "Cause lists", icon: CalendarSearch },
  { href: "/judgments", label: "Research", icon: BookOpen },
];

/* ─── Bottom Tab Bar ─── */
function BottomTabBar({ location, user }: { location: string; user: User | null }) {
  const { t } = useLanguage();
  const { logout, activePortal } = useAuth();
  const [, setLocation] = useLocation();
  const unreadCount = useUnreadCount();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useEffect(() => { closeDrawer(); }, [location, closeDrawer]);

  const isLawyer  = !!user && activePortal === "advocate";
  const mobileNav = isLawyer ? lawyerMobileNav : clientMobileNav;
  const primaryAction = { href: "/post-case", label: "Post", icon: Plus };
  const PrimaryActionIcon = primaryAction.icon;
  const mainTab = mobileNav[0];
  const casesTab = mobileNav[1];
  const extraNav: NavEntry[] = isLawyer
    ? lawyerNav.filter((item) => !lawyerMobileNav.some((mobileItem) => mobileItem.href === item.href))
    : [
        { href: "/my-cases", label: "Cases & Hearings", icon: FileText },
        { href: "/post-case", label: "Post a Case", icon: Plus },
        { href: "/lawyers", label: "Find a Lawyer", icon: Users },
        { href: "/messages", label: "Messages", icon: Inbox },
        { href: "/settings", label: "Settings", icon: UserIcon },
        { href: "/subscription", label: "Subscription / Plans", icon: Crown },
        { href: "/matches",   label: "Match Proposals", icon: Sparkles,  tKey: "match_proposals" },
        { href: "/documents", label: "Documents",        icon: FileCheck, tKey: "documents"       },
      ];

  const tabItems = isLawyer ? lawyerMobileNav.map((item) => ({
    id: item.href, href: item.href, label: item.label, icon: <item.icon aria-hidden="true" />,
  })) : [
    ...(mainTab ? [{ id: mainTab.href, href: mainTab.href, label: mainTab.tKey && t[mainTab.tKey] ? t[mainTab.tKey] : mainTab.label, icon: <mainTab.icon aria-hidden="true" /> }] : []),
    { id: "messages", href: "/messages", label: "Messages", icon: <Inbox aria-hidden="true" />, badge: unreadCount > 0 ? unreadCount : undefined },
    {
      id: "primary-action", href: primaryAction.href, label: primaryAction.label,
      icon: <PrimaryActionIcon aria-hidden="true" />,
    },
    ...(casesTab ? [{
      id: casesTab.href, href: casesTab.href, label: casesTab.tKey && t[casesTab.tKey] ? t[casesTab.tKey] : casesTab.label,
      icon: <casesTab.icon aria-hidden="true" />,
    }] : []),
    { id: "more", label: "More", icon: <Menu aria-hidden="true" />, onSelect: openDrawer },
  ];
  if (isLawyer) tabItems.push({ id: "more", label: "More", icon: <Menu aria-hidden="true" />, onSelect: openDrawer });
  const moreItems = isLawyer
    ? extraNav
    : [...extraNav, ...commonNav].filter((item, index, all) => all.findIndex(candidate => candidate.href === item.href) === index);
  const activeAdvocateTab = lawyerMobileNav.find(({ href }) => isNavPathActive(href, location));
  const selectedTab = isLawyer
    ? activeAdvocateTab?.href ?? "more"
    : location.startsWith("/messages") ? "messages"
      : isNavPathActive(mobileNav[0]?.href ?? "", location) ? (mobileNav[0]?.href ?? "more")
        : location.startsWith(primaryAction.href) ? "primary-action" : "more";

  return (
    <>
      <TabBar items={tabItems} value={selectedTab} label="Main navigation" className="lf-mobile-bottom-nav md:hidden" />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} title="More" size="large">
        <nav aria-label="More tools" className="grid grid-cols-4 gap-x-2 gap-y-3 px-1 pb-4">
          {moreItems.map(({ href, icon: Icon, label }) => {
            const feature = FEATURE_BY_HREF[href];
            return (
              <Link key={href} href={href}
                data-testid={`more-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex min-h-[88px] min-w-0 flex-col items-center justify-start gap-1.5 rounded-xl px-1 py-1 text-center active:bg-muted/70">
                {feature
                  ? <FeatureIcon feature={feature} size="large" />
                  : <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[22.5%] bg-slate-600"><Icon className="h-9 w-9 text-white" strokeWidth={2} /></span>}
                <span className="w-full truncate text-[13px] leading-4 text-foreground">{label}</span>
              </Link>
            );
          })}
        </nav>
        {user?.is_superuser && (
          <GroupedList title="Admin" label="Admin tools">
            <GroupedRow title="Admin panel" leading={<FeatureIcon feature="admin" size="small" />} href="/admin" accessory />
            <GroupedRow title="ForgeOS" leading={<FeatureIcon feature="forgeOs" size="small" />} href="/forgeos" accessory />
          </GroupedList>
        )}
        <GroupedList label="Account">
          <GroupedRow
            title="Account & Privacy"
            leading={<FeatureIcon feature="accountPrivacy" size="small" />}
            href="/settings"
            accessory
            testId="more-account-privacy"
          />
          <GroupedRow
            title="Sign out"
            leading={<LogOut />}
            onClick={() => { closeDrawer(); logout(); setLocation("/login"); }}
            className="lfm-row-destructive"
            accessory={false}
            testId="button-sign-out"
          />
        </GroupedList>
      </Sheet>
    </>
  );
}

/* ─── Main Layout ─── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isWorkspace = location.startsWith("/workspace");
  const { user, activePortal } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const mobileTitle = mobileTitleForPath(location);
  const isAdvocateToday = !!user && (user.role === "advocate" || user.role === "lawyer") && location === "/lawyer-dashboard";
  const isMobileDetail = /^\/(my-cases\/[^/]+|judgments\/[^/]+|advocate\/cases\/[^/]+|free-documents\/[^/]+|document-template\/[^/]+)$/.test(location);
  const backHref = location.startsWith("/judgments/")
    ? "/judgments"
    : location.startsWith("/advocate/cases/")
      ? "/advocate/cases"
      : location.startsWith("/free-documents/") || location.startsWith("/document-template/")
        ? "/free-documents"
        : "/my-cases";
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation(backHref);
  };
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
      {!isAdvocateToday && <NavBar
        className="lf-mobile-topbar md:hidden"
        title={mobileTitle}
        subtitle={mobileSubtitleForPath(location)}
        large={!isMobileDetail}
        scrollEl={scrollElement}
        leading={isMobileDetail
          ? <button type="button" onClick={handleBack} className="inline-flex min-h-11 items-center gap-0.5 text-primary" aria-label="Go back">
              <ChevronLeft className="h-6 w-6" /><span className="text-sm">{backHref === "/judgments" ? "Judgments" : backHref === "/free-documents" ? "Documents" : "Cases"}</span>
            </button>
          : null}
      />}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col relative z-10" style={{ boxShadow: "var(--cfos-elev-3)" }}>
          <SidebarContent location={location} user={user} />
        </aside>

        {/* Main content */}
        <main
          ref={(node) => setScrollElement(node)}
          onTouchStart={isMobileDetail ? (event) => {
            const touch = event.touches[0];
            if (touch.clientX < 20) swipeStart.current = { x: touch.clientX, y: touch.clientY };
          } : undefined}
          onTouchEnd={isMobileDetail ? (event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            const touch = event.changedTouches[0];
            if (start && touch.clientX - start.x > 88 && Math.abs(touch.clientY - start.y) < 60) handleBack();
          } : undefined}
          className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden relative z-0 flex flex-col pb-[72px] md:pb-0 bg-background",
          isWorkspace && "min-h-0 overflow-hidden pb-0",
        )}>
          {/* Desktop sticky header */}
          <header className="hidden md:flex flex-shrink-0 h-14 border-b border-border bg-card px-6 items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Scale className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">LitigaForge AI</span>
              <span aria-hidden="true" className="h-4 border-l border-border" />
              <span data-testid="desktop-page-context" className="text-xs text-muted-foreground">{mobileTitle}</span>
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
                    : user.subscription_tier === "free" ? "Free plan · Upgrade" : (TIER_LABELS[user.subscription_tier] ?? "Free")}
                </Link>
              )}
            </div>
          </header>

          {user && user.role !== "client" && <AdvocateGroupTabs location={location} />}
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
      {user && !isWorkspace && !["/lawyers/register", "/post-case", "/settings", "/verify-email", "/forgot-password", "/reset-password"].some(path => location === path || location.startsWith(`${path}/`)) && <BottomTabBar location={location} user={user} />}
    </div>
  );
}
