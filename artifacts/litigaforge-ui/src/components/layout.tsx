import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Scale, FileText, Link2, Activity, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, useAnimation, useInView } from "framer-motion";
import { useRef } from "react";
import { ParticleCanvas } from "@/components/graphics/ParticleCanvas";

const navItems = [
  { href: "/", label: "Forge", icon: Scale },
  { href: "/cases", label: "Case History", icon: FileText },
  { href: "/chains", label: "API Chains", icon: Link2 },
];

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const duration = 1000;
    const increment = (value - start) / (duration / 16);
    
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

  return <span ref={ref}>{displayValue}</span>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
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
      {/* Top Bar */}
      <header className="h-8 flex-shrink-0 border-b border-white/[0.05] bg-black/40 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
          <span className="text-primary/90 font-semibold">LitigaForge AI</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Hyderabad High Court Division</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-muted-foreground">
          <Clock className="w-3 h-3 text-primary/70" />
          <span>{timeString} IST</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          data-testid="sidebar"
          className="w-64 flex-shrink-0 bg-sidebar border-r border-white/[0.05] flex flex-col relative z-10"
        >
          {/* Logo */}
          <div className="px-6 py-8 relative">
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/40 blur-md rounded-full animate-pulse-glow" />
                <Scale className="w-6 h-6 text-primary relative z-10 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              </div>
              <div>
                <div className="text-sidebar-foreground font-bold text-lg leading-none tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  LITIGAFORGE
                </div>
                <div className="text-primary/80 text-[9px] leading-tight font-mono uppercase tracking-[0.2em] mt-1">
                  System Active
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-300 cursor-pointer relative group overflow-hidden",
                    active
                      ? "text-primary font-medium bg-primary/10"
                      : "text-sidebar-foreground/60 hover:text-white hover:bg-white/[0.03]"
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
                  <Icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", active ? "text-primary" : "group-hover:text-white")} />
                  <span className="tracking-wide relative z-10">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Status footer */}
          <div className="p-5 border-t border-white/[0.05] space-y-4 bg-black/20">
            {stats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-sidebar-foreground/40 font-mono uppercase tracking-widest">Cases Forged</span>
                  <span className="text-primary font-mono text-xs font-bold drop-shadow-[0_0_5px_rgba(251,191,36,0.3)]">
                    <AnimatedCounter value={stats.total_cases} />
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-sidebar-foreground/40 font-mono uppercase tracking-widest">Patterns</span>
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
                {health?.dummy_mode ? "Dummy Mode" : "Live Mode"}
              </span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto relative z-0" data-testid="main-content">
          <ParticleCanvas />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
