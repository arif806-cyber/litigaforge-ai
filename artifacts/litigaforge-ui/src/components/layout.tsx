import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Scale, FileText, Link2, Activity, Clock, Menu, X, Lightbulb,
  Crown, LogOut, User, ChevronRight, MessageSquare, FileSearch,
  BookOpen, Users, Heart, Sun, Moon,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleCanvas } from "@/components/graphics/ParticleCanvas";
import { useAuth, TIER_LABELS, TIER_LIMITS } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";

const mainNav = [
  { href: "/",          label: "Forge",     icon: Scale },
  { href: "/cases",     label: "Cases",     icon: FileText },
  { href: "/chains",    label: "Chains",    icon: Link2 },
  { href: "/use-cases", label: "Use Cases", icon: Lightbulb },
];

const serviceNav = [
  { href: "/ask",        label: "Legal Q&A",    icon: MessageSquare },
  { href: "/review",     label: "Doc Analyzer", icon: FileSearch },
  { href: "/judgments",  label: "Judgments",    icon: BookOpen },
  { href: "/lawyers",    label: "Find Lawyers", icon: Users },
  { href: "/legal-aid",  label: "Free Aid",     icon: Heart },
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
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer relative group",
        active
          ? "bg-primary text-primary-foreground font-medium shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary-foreground" : "group-hover:text-sidebar-foreground")} />
      <span className="tracking-wide relative z-10 text-sm font-medium">{label}</span>
    </Link>
  );
}

function UserPanel({ onNav }: { onNav?: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    if (onNav) onNav();
    setLocation("/login");
  };

  return (
    <div className="border-t border-sidebar-border px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all text-xs font-medium"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}

function SidebarContent({
  location, health, stats, onNav,
}: {
  location: string;
  health: { dummy_mode: boolean; ai_mode?: string; active_providers?: string[] } | undefined;
  stats: { total_cases: number; total_patterns: number } | undefined;
  onNav?: () => void;
}) {
  return (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border flex-shrink-0 flex items-center gap-3">
        <Scale className="w-6 h-6 text-primary-foreground" />
        <span className="text-sidebar-foreground font-bold text-lg tracking-tight">LitigaForge AI</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Platform</div>
        {mainNav.map(item => (
          <NavItem key={item.href} {...item} location={location} onClick={onNav} />
        ))}

        <div className="px-3 pt-6 pb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Services</div>
        {serviceNav.map(item => (
          <NavItem key={item.href} {...item} location={location} onClick={onNav} />
        ))}
      </div>

      <UserPanel onNav={onNav} />
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => { setDrawerOpen(false); }, [location]);

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
      <header className="flex-shrink-0 border-b border-border bg-card z-20 flex items-center justify-between px-4 h-14 shadow-sm md:hidden">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg tracking-tight">LitigaForge AI</span>
        </div>
        <div className="flex items-center gap-2">
           <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex-col relative z-10 shadow-lg">
          <SidebarContent location={location} health={health} stats={stats} />
        </aside>

        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col z-50 md:hidden shadow-2xl"
            >
              <button
                className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent
                location={location} health={health} stats={stats}
                onNav={() => setDrawerOpen(false)}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-auto relative z-0 flex flex-col pb-16 md:pb-0 bg-muted/30">
          <header className="hidden md:flex flex-shrink-0 h-16 border-b border-border bg-card/80 backdrop-blur-md px-8 items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              {health?.dummy_mode ? (
                <span className="flex items-center gap-2 text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-md">
                   <AlertTriangle className="w-4 h-4" /> Fallback Mode
                </span>
              ) : (
                <span className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md">
                  <Activity className="w-4 h-4" /> Live AI Engine
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {user && (
                <Link href="/subscription" className="flex items-center gap-2 text-sm font-medium text-foreground bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/80 transition-colors">
                  <Crown className="w-4 h-4 text-amber-500" />
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-1 z-30 shadow-lg">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}
              className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full"
            >
              <Icon className={cn("w-5 h-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
        <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full">
           <Menu className={cn("w-5 h-5 transition-colors", serviceNav.some(s => location.startsWith(s.href)) ? "text-primary" : "text-muted-foreground")} />
           <span className={cn("text-[10px] font-medium", serviceNav.some(s => location.startsWith(s.href)) ? "text-primary" : "text-muted-foreground")}>
             Menu
           </span>
        </button>
      </nav>
    </div>
  );
}