import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Scale, FileText, Link2, Activity, Clock, Menu, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleCanvas } from "@/components/graphics/ParticleCanvas";

const navItems = [
  { href: "/", label: "Forge", icon: Scale },
  { href: "/cases", label: "Cases", icon: FileText },
  { href: "/chains", label: "Chains", icon: Link2 },
  { href: "/use-cases", label: "Use Cases", icon: Lightbulb },
];

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
  return (
    <>
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/40 blur-md rounded-full animate-pulse-glow" />
            <Scale className="w-6 h-6 text-primary relative z-10 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none tracking-wide">LITIGAFORGE</div>
            <div className="text-primary/80 text-[9px] font-mono uppercase tracking-[0.2em] mt-1">System Active</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer relative group",
                active
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-white/50 hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {active && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r shadow-[0_0_12px_hsl(var(--primary))]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "group-hover:text-white")} />
              <span className="tracking-wide relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="p-5 border-t border-white/[0.05] space-y-4 bg-black/20">
        {stats && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/30 font-mono uppercase tracking-widest">Cases Forged</span>
              <span className="text-primary font-mono text-xs font-bold">
                <AnimatedCounter value={stats.total_cases} />
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/30 font-mono uppercase tracking-widest">Patterns</span>
              <span className="text-primary font-mono text-xs font-bold">
                <AnimatedCounter value={stats.total_patterns} />
              </span>
            </div>
          </div>
        )}
        <div className="h-px w-full bg-white/[0.05]" />
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Activity className={cn("w-3.5 h-3.5", health?.dummy_mode ? "text-amber-400" : "text-green-400")} />
            <div className={cn("absolute inset-0 blur-sm rounded-full", health?.dummy_mode ? "bg-amber-400/30 animate-pulse" : "bg-green-400/30 animate-pulse")} />
          </div>
          <span className={cn("text-[10px] font-mono uppercase tracking-widest font-semibold", health?.dummy_mode ? "text-amber-400" : "text-green-400")}>
            {health?.dummy_mode
              ? "Fallback Mode"
              : health?.ai_mode === "multi"
              ? `Multi-AI (${(health.active_providers ?? []).length})`
              : health?.ai_mode === "claude"
              ? "Claude Sonnet"
              : health?.ai_mode === "gemini"
              ? "Gemini AI"
              : health?.ai_mode === "openai"
              ? "GPT-5"
              : "Live Mode"}
          </span>
        </div>
      </div>
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [time, setTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close drawer on route change
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 border-b border-white/[0.05] bg-black/40 z-20 flex items-center justify-between px-4 h-11">
        {/* Mobile: hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center / desktop-left: branding */}
        <div className="flex items-center gap-3 text-[10px] font-mono tracking-widest text-white/40 uppercase">
          <span className="text-primary/90 font-bold text-[11px]">LitigaForge AI</span>
          <span className="hidden sm:inline-flex items-center gap-3">
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Hyderabad High Court Division</span>
          </span>
        </div>

        {/* Right: clock */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-white/40">
          <Clock className="w-3 h-3 text-primary/60" />
          <span className="hidden sm:inline">{timeString} IST</span>
          <span className="sm:hidden">{time.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar ── */}
        <aside
          data-testid="sidebar"
          className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-white/[0.05] flex-col relative z-10"
        >
          <SidebarContent location={location} health={health} stats={stats} />
        </aside>

        {/* ── Mobile drawer backdrop ── */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Mobile drawer ── */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-white/[0.05] flex flex-col z-40 md:hidden"
            >
              {/* Close button */}
              <button
                className="absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
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

        {/* ── Main content ── */}
        <main
          className="flex-1 overflow-auto relative z-0 pb-16 md:pb-0"
          data-testid="main-content"
        >
          <ParticleCanvas />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar/95 backdrop-blur-md border-t border-white/[0.07] flex items-center justify-around px-2 z-20">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 rounded-xl transition-all"
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-7 rounded-lg transition-all",
                active ? "bg-primary/15" : ""
              )}>
                <Icon className={cn("w-5 h-5 transition-colors", active ? "text-primary" : "text-white/40")} />
              </div>
              <span className={cn("text-[10px] font-mono tracking-widest transition-colors", active ? "text-primary" : "text-white/30")}>
                {label.toUpperCase()}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
