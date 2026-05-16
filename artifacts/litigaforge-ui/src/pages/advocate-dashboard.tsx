import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Scale, FileText, BookOpen, PenTool, Link2, TrendingUp, Clock, ChevronRight, Zap, Search, LayoutTemplate, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth, TIER_LABELS, TIER_LIMITS } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    title: "The Forge",
    desc: "AI legal strategy from case facts",
    icon: Zap,
    href: "/",
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    title: "AI Drafting",
    desc: "Generate legal documents instantly",
    icon: PenTool,
    href: "/draft",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  {
    title: "Legal Research",
    desc: "Cited answers from Indian case law",
    icon: Search,
    href: "/research",
    gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    title: "Template Library",
    desc: "50+ ready legal document templates",
    icon: LayoutTemplate,
    href: "/templates",
    gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
];

const FEATURED_TEMPLATES = [
  { id: "cheque_bounce_notice", title: "Cheque Bounce Notice", law: "NI Act S.138", category: "Criminal" },
  { id: "consumer_complaint", title: "Consumer Complaint", law: "COPRA 2019", category: "Consumer" },
  { id: "bail_application", title: "Bail Application", law: "CrPC S.437", category: "Criminal" },
  { id: "rent_eviction", title: "Rent Eviction Notice", law: "TN Buildings Act", category: "Civil" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Criminal: "bg-red-50 text-red-700 border-red-200",
  Civil: "bg-blue-50 text-blue-700 border-blue-200",
  Consumer: "bg-green-50 text-green-700 border-green-200",
  Corporate: "bg-purple-50 text-purple-700 border-purple-200",
  Family: "bg-pink-50 text-pink-700 border-pink-200",
  Tax: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AdvocateDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch("/cases?limit=5"),
    staleTime: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["memory-stats"],
    queryFn: () => apiFetch("/memory/stats"),
    staleTime: 30000,
  });

  const tier = user?.subscription_tier ?? "free";
  const limit = TIER_LIMITS[tier] ?? 5;
  const used = user?.cases_this_month ?? 0;
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } } };

  return (
    <div className="h-full overflow-auto px-4 pb-10 md:px-10 pt-6 md:pt-8">
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-8">

        {/* Hero banner */}
        <motion.div variants={item} className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-7 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(180,120,20,0.25),transparent_60%)] pointer-events-none" />
          <div className="absolute bottom-0 right-6 opacity-10 pointer-events-none">
            <Scale className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 mb-2">Advocate Dashboard</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome, {user?.name?.split(" ")[0] ?? "Advocate"}
            </h1>
            <p className="text-gray-400 text-sm mt-1">Hyderabad High Court Division · {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>

            {/* Tier + usage */}
            <div className="mt-5 flex flex-wrap gap-4 items-center">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono uppercase tracking-widest">
                {TIER_LABELS[tier]} Plan
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono">{used} / {limit === -1 ? "∞" : limit} cases this month</span>
                {limit !== -1 && (
                  <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", pct >= 80 ? "bg-red-400" : "bg-amber-400")} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick stats */}
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Cases Forged", value: stats?.total_cases ?? 0, icon: Scale, color: "text-amber-600 bg-amber-50" },
            { label: "This Month", value: used, icon: Clock, color: "text-blue-600 bg-blue-50" },
            { label: "AI Patterns", value: stats?.total_patterns ?? 0, icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
            { label: "Templates", value: 28, icon: LayoutTemplate, color: "text-emerald-600 bg-emerald-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={item}>
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-gray-300" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.href}
                  onClick={() => setLocation(action.href)}
                  className={cn(
                    "group text-left p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5",
                    action.bg, action.border
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-sm", action.gradient)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-sm text-gray-900">{action.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{action.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-[11px] font-mono text-gray-400 group-hover:text-gray-700 transition-colors">
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Bottom row: Recent cases + Featured templates */}
        <motion.div variants={item} className="grid md:grid-cols-2 gap-6">

          {/* Recent Cases */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Recent Cases
              </h3>
              <button onClick={() => setLocation("/cases")} className="text-xs text-primary hover:underline flex items-center gap-1">
                All cases <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {cases?.cases?.length ? (
              <ul className="divide-y divide-gray-50">
                {cases.cases.slice(0, 5).map((c: any) => (
                  <li key={c.case_id}>
                    <button onClick={() => setLocation(`/cases/${c.case_id}`)} className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{c.case_id}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{new Date(c.timestamp).toLocaleDateString("en-IN")}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 truncate group-hover:text-gray-900">{c.prompt_preview}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-10 text-center">
                <Scale className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No cases forged yet</p>
                <button onClick={() => setLocation("/")} className="mt-3 text-xs text-primary hover:underline">Run your first forge →</button>
              </div>
            )}
          </div>

          {/* Featured Templates */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" /> Featured Templates
              </h3>
              <button onClick={() => setLocation("/templates")} className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <ul className="divide-y divide-gray-50">
              {FEATURED_TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setLocation(`/draft?template=${t.id}`)} className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">{t.title}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", CATEGORY_COLORS[t.category] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                        {t.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{t.law}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-gray-50">
              <button onClick={() => setLocation("/templates")} className="w-full text-xs text-center text-gray-400 hover:text-primary transition-colors flex items-center justify-center gap-1">
                <LayoutTemplate className="w-3.5 h-3.5" /> Browse all 28 templates
              </button>
            </div>
          </div>
        </motion.div>

        {/* Competitor comparison banner */}
        <motion.div variants={item} className="bg-gradient-to-r from-primary/5 to-violet-50 border border-primary/20 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-primary uppercase tracking-widest mb-1">Platform Advantage</p>
              <p className="text-sm font-semibold text-gray-900">16 live government API chains — GSTIN, VAHAN, eCourts, NSE, IFSC and more</p>
              <p className="text-xs text-gray-500 mt-0.5">Real-time verified data powering every legal strategy — beyond what VIDUR AI or LegitQuest can offer</p>
            </div>
            <button onClick={() => setLocation("/chains")} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition">
              <Link2 className="w-3.5 h-3.5" /> View Chains
            </button>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
