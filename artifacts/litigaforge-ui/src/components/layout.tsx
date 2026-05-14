import { Link, useLocation } from "wouter";
import { Scale, FileText, Link2, BookOpen, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const navItems = [
  { href: "/", label: "Forge", icon: Scale },
  { href: "/cases", label: "Case History", icon: FileText },
  { href: "/chains", label: "API Chains", icon: Link2 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col"
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-sidebar-primary flex-shrink-0" />
            <div>
              <div className="text-sidebar-foreground font-semibold text-sm leading-tight tracking-wide">
                LitigaForge
              </div>
              <div className="text-sidebar-foreground/40 text-[10px] leading-tight font-mono uppercase tracking-wider">
                AI Legal Engine
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2.5">
          {stats && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sidebar-foreground/40 font-mono uppercase tracking-wider">Cases</span>
                <span className="text-sidebar-foreground/70 font-mono">{stats.total_cases}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sidebar-foreground/40 font-mono uppercase tracking-wider">Patterns</span>
                <span className="text-sidebar-foreground/70 font-mono">{stats.total_patterns}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-sidebar-foreground/30" />
            {health?.dummy_mode ? (
              <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">
                Dummy Mode
              </span>
            ) : (
              <span className="text-[10px] font-mono text-green-400/70 uppercase tracking-wider">
                Live Mode
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" data-testid="main-content">
        {children}
      </main>
    </div>
  );
}
