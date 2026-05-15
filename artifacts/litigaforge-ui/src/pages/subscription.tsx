import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth, TIER_LABELS } from "@/lib/auth-context";
import { CheckCircle2, Zap, Crown, Star, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  price_inr: number;
  cases_per_month: number;
  ai_label: string;
  features: string[];
}

const TIER_ICONS: Record<string, React.ElementType> = {
  free: Star,
  professional: Zap,
  advocate_pro: Crown,
};

const TIER_ACCENT: Record<string, string> = {
  free: "border-gray-200",
  professional: "border-amber-300 shadow-[0_0_24px_rgba(180,120,20,0.12)]",
  advocate_pro: "border-primary shadow-[0_0_32px_rgba(180,120,20,0.18)]",
};

const TIER_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  professional: "bg-amber-100 text-amber-700",
  advocate_pro: "bg-primary/10 text-primary font-bold",
};

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscription/plans"),
    staleTime: 300000,
  });

  const upgrade = useMutation({
    mutationFn: (tier: string) =>
      apiFetch("/subscription/upgrade", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
    onSuccess: async (_, tier) => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["health"] });
      setSuccess(TIER_LABELS[tier] ?? tier);
      setUpgrading(null);
    },
    onError: () => setUpgrading(null),
  });

  const handleUpgrade = (tier: string) => {
    setUpgrading(tier);
    setSuccess(null);
    upgrade.mutate(tier);
  };

  const currentTier = user?.subscription_tier ?? "free";
  const limit = currentTier === "advocate_pro" ? -1 : (currentTier === "professional" ? 50 : 5);
  const used = user?.cases_this_month ?? 0;

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <Crown className="w-6 h-6 text-primary" />
          Subscription
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Choose the plan that fits your practice. Upgrade or downgrade anytime.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-5xl space-y-8 pb-20">

          {/* Current usage */}
          {user && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Current Plan</p>
                <div className="flex items-center gap-3">
                  <span className={cn("text-lg font-bold", currentTier === "advocate_pro" ? "text-primary" : "text-gray-900")}>
                    {TIER_LABELS[currentTier]}
                  </span>
                  <span className={cn("text-xs font-mono px-2 py-0.5 rounded-full", TIER_BADGE[currentTier])}>
                    ACTIVE
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Cases This Month</p>
                <p className="text-2xl font-bold text-gray-900 font-mono">
                  {used}
                  <span className="text-sm text-muted-foreground font-normal">
                    {" "}/ {limit === -1 ? "∞" : limit}
                  </span>
                </p>
                {limit !== -1 && (
                  <div className="mt-2 h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden ml-auto">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-green-700"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Upgraded to <strong>{success}</strong> successfully!</span>
            </motion.div>
          )}

          {upgrade.isError && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Upgrade failed. Please try again.</span>
            </div>
          )}

          {/* Plans */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-80 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {(plans ?? []).map((plan, idx) => {
                const Icon = TIER_ICONS[plan.id] ?? Star;
                const isCurrent = plan.id === currentTier;
                const isPopular = plan.id === "professional";
                const isUpgrading = upgrading === plan.id;

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "bg-white rounded-2xl border-2 p-6 flex flex-col relative transition-all duration-300",
                      TIER_ACCENT[plan.id],
                      isCurrent && "ring-2 ring-primary/30"
                    )}
                  >
                    {isPopular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-white text-[10px] font-bold font-mono px-3 py-1 rounded-full tracking-widest">
                          POPULAR
                        </span>
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-500 text-white text-[10px] font-bold font-mono px-3 py-1 rounded-full tracking-widest">
                          CURRENT PLAN
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-5">
                      <div className={cn("p-2.5 rounded-xl", plan.id === "advocate_pro" ? "bg-primary/10" : "bg-gray-100")}>
                        <Icon className={cn("w-5 h-5", plan.id === "advocate_pro" ? "text-primary" : "text-gray-600")} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{plan.name}</h3>
                        <p className="text-[11px] text-muted-foreground font-mono">{plan.ai_label}</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      {plan.price_inr === 0 ? (
                        <span className="text-3xl font-bold text-gray-900">Free</span>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold text-gray-900">₹{plan.price_inr.toLocaleString("en-IN")}</span>
                          <span className="text-sm text-muted-foreground mb-1">/month</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.cases_per_month === -1 ? "Unlimited cases" : `${plan.cases_per_month} cases / month`}
                      </p>
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => !isCurrent && handleUpgrade(plan.id)}
                      disabled={isCurrent || isUpgrading || upgrade.isPending}
                      className={cn(
                        "w-full h-10 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2",
                        isCurrent
                          ? "bg-gray-100 text-gray-400 cursor-default"
                          : plan.id === "advocate_pro"
                          ? "bg-primary text-white hover:bg-primary/90 shadow-sm"
                          : "bg-gray-900 text-white hover:bg-gray-800 shadow-sm"
                      )}
                    >
                      {isUpgrading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : plan.price_inr === 0 ? (
                        "Downgrade to Free"
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          <p className="text-xs text-center text-muted-foreground font-mono">
            Upgrades take effect immediately. Payment integration coming soon — plans activate instantly for demo purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
