import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Scale, FileText, Link2, Activity, Clock, Menu, X, Lightbulb, Crown, LogOut, User, ChevronRight, LayoutDashboard, PenTool, Search, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleCanvas } from "@/components/graphics/ParticleCanvas";
import { useAuth, TIER_LABELS, TIER_LIMITS } from "@/lib/auth-context";

const ADVOCATE_NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/",          label: "Forge",       icon: Scale },
  { href: "/templates", label: "Templates",   icon: LayoutTemplate },
  { href: "/draft",     label: "AI Drafting", icon: PenTool },
  { href: "/research",  label: "Research",    icon: Search },
  { href: "/cases",     label: "Cases",       icon: FileText },
  { href: "/chains",    label: "Chains",      icon: Link2 },
];

const CLIENT_NAV = [
  { href: "/",      label: "Forge",  icon: Scale },
  { href: "/cases", label: "Cases",  icon: FileText },
];

const TIER_COLORS: Record<string, string> = {
  free: "text-gray-500 bg-gray-100",
  professional: "text-amber-700 bg-amber-100",
  advocate_pro: "text-primary bg-primary/10 font-bold",
};

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

function UserPanel({ onNav }: { onNav?: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const tier = user.subscription_tier;
  const limit = TIER_LIMITS[tier] ?? 5;
  const used = user.cases_this_month;
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

  const handleLogout = () => {
    logout();
    if (onNav) onNav();
    setLocation("/login");
  };

  const handleSubscription = () => {
    if (onNav) onNav();
    setLocation("/subscription");
  };

  return (
    <div className="border-t border-gray-200 px-4 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
          <p className="text-[10px] text-gray-400 truncate font-mono">
            {user.user_type === "advocate" ? "Advocate" : "Client"} · {user.email}
          </p>
        </div>
      </div>

      <button
        onClick={handleSubscription}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-primary/5 border border-gray-200 hover:border-primary/20 transition-all group"
      >
        <div className="flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-primary" />
          <span className={cn("text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded", TIER_COLORS[tier])}>
            {TIER_LABELS[tier] ?? tier}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" />
      </button>

      <div>
        <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono text-gray-400">
          <span>CASES THIS MONTH</span>
          <span className="text-gray-600 font-semibold">{used} / {limit === -1 ? "∞" : limit}</span>
        </div>
        {limit !== -1 && (
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-red-400" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all text-[11px] font-mono uppercase tracking-widest"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign Out
      </button>
    </div>
  );
}

function SidebarContent({
  location,
  health,
  stats,
  onNav,
}: {
  location: string;
  health: { dummy_mode: boolean; ai_mode?: string; active_providers?: string[] } | undefined;
  stats: { total_cases: number; total_patterns: number } | undefined;
  onNav?: () => void;
}) {
  const { user } = useAuth();
  const isAdvocate = !user || user.user_type === "advocate";
  const navItems = isAdvocate ? ADVOCATE_NAV : CLIENT_NAV;

  return (
    <>
      {/* Logo */}
      <div className="px-6 py-7 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full animate-pulse-glow" />
            <Scale className="w-6 h-6 text-primary relative z-10" />
          </div>
          <div>
            <div className="text-gray-900 font-bold text-base leading-none tracking-wide">LITIGAFORGE</div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] mt-1">
              {isAdvocate
                ? <span className="text-primary">Advocate Workspace</span>
                : <span className="text-blue-500">Client Portal</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      {user && (
        <div className="px-4 pt-3 pb-1">
          <span className={cn(
            "text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border",
            isAdvocate
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-blue-50 text-blue-600 border-blue-200"
          )}>
            {isAdvocate ? "Advocate Mode" : "Client Mode"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer relative group",
                active
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              {active && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "group-hover:text-gray-900")} />
              <span className="tracking-wide relative z-10">{label}</span>
            </Link>
          );
        })}

        {/* Use Cases link for advocates only */}
        {isAdvocate && (
          <Link
            href="/use-cases"
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer relative group",
              location.startsWith("/use-cases")
                ? "text-primary font-semibold bg-primary/10"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            {location.startsWith("/use-cases") && (
              <motion.div
                layoutId="activeNav"
                className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Lightbulb className="w-4 h-4 flex-shrink-0" />
            <span className="tracking-wide relative z-10">Use Cases</span>
          </Link>
        )}
      </nav>

      {/* AI Status */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80">
        {stats && isAdvocate && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-mono uppercase tracking-widest">Cases Forged</span>
              <span className="text-primary font-mono text-xs font-bold"><AnimatedCounter value={stats.total_cases} /></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-mono uppercase tracking-widest">AI Patterns</span>
              <span className="text-primary font-mono text-xs font-bold"><AnimatedCounter value={stats.total_patterns} /></span>
            </div>
          </div>
        )}
        <div className="h-px w-full bg-gray-200 mb-4" />
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Activity className={cn("w-3.5 h-3.5", health?.dummy_mode ? "text-amber-600" : "text-green-600")} />
            <div className={cn("absolute inset-0 blur-sm rounded-full", health?.dummy_mode ? "bg-amber-400/30 animate-pulse" : "bg-green-400/30 animate-pulse")} />
          </div>
          <span className={cn("text-[10px] font-mono uppercase tracking-widest font-semibold", health?.dummy_mode ? "text-amber-600" : "text-green-600")}>
            {health?.dummy_mode
              ? "Fallback Mode"
              : health?.ai_mode === "multi"
              ? `Multi-AI (${(health.active_providers ?? []).length})`
              : "Live Mode"}
          </span>
        </div>
      </div>

      <UserPanel onNav={onNav} />
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [time, setTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const isAdvocate = !user || user.user_type === "advocate";

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  const timeString = time.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });

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

  const mobileNav = isAdvocate
    ? [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: "/",          label: "Forge",  icon: Scale },
        { href: "/draft",     label: "Draft",  icon: PenTool },
        { href: "/research",  label: "Search", icon: Search },
        { href: "/cases",     label: "Cases",  icon: FileText },
      ]
    : [
        { href: "/", label: "Forge", icon: Scale },
        { href: "/cases", label: "Cases", icon: FileText },
      ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white/90 z-20 flex items-center justify-between px-4 h-11 shadow-sm">
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 text-[10px] font-mono tracking-widest text-gray-500 uppercase">
          <span className="text-primary font-bold text-[11px]">LitigaForge AI</span>
          <span className="hidden sm:inline-flex items-center gap-3">
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>{isAdvocate ? "Advocate Workspace" : "Client Portal"}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-gray-400">
            <Clock className="w-3 h-3 text-primary/70" />
            <span>{timeString} IST</span>
          </div>
          {user && (
            <button
              onClick={() => { logout(); setLocation("/login"); }}
              className="hidden md:flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          data-testid="sidebar"
          className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-gray-200 flex-col relative z-10 overflow-y-auto"
        >
          <SidebarContent location={location} health={health} stats={stats} />
        </aside>

        {/* Mobile drawer backdrop */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-gray-900/25 backdrop-blur-sm z-30 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-gray-200 flex flex-col z-40 md:hidden overflow-y-auto"
            >
              <button
                className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent
                location={location}
                health={health}
                stats={stats}
                onNav={() => setDrawerOpen(false)}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main
          className="flex-1 overflow-auto relative z-0 pb-16 md:pb-0"
          data-testid="main-content"
        >
          <ParticleCanvas />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 z-20 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]" style={{ height: "64px" }}>
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 min-w-[52px] py-2 rounded-xl transition-all"
            >
              <div className={cn("flex items-center justify-center w-10 h-7 rounded-lg transition-all", active ? "bg-primary/10" : "")}>
                <Icon className={cn("w-5 h-5 transition-colors", active ? "text-primary" : "text-gray-400")} />
              </div>
              <span className={cn("text-[10px] font-mono tracking-widest transition-colors", active ? "text-primary" : "text-gray-400")}>
                {label.toUpperCase()}
              </span>
            </Link>
          );
        })}
        <Link
          href="/subscription"
          className="flex flex-col items-center justify-center gap-1 min-w-[52px] py-2 rounded-xl transition-all"
        >
          <div className={cn("flex items-center justify-center w-10 h-7 rounded-lg transition-all", location === "/subscription" ? "bg-primary/10" : "")}>
            <Crown className={cn("w-5 h-5 transition-colors", location === "/subscription" ? "text-primary" : "text-gray-400")} />
          </div>
          <span className={cn("text-[10px] font-mono tracking-widest transition-colors", location === "/subscription" ? "text-primary" : "text-gray-400")}>
            PLAN
          </span>
        </Link>
      </nav>
    </div>
  );
}
