import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth, TIER_LABELS } from "@/lib/auth-context";
import { getCountryFromPath, buildCountryUrl } from "@/lib/country";
import { CheckCircle2, Zap, Crown, Star, Loader2, AlertTriangle, Download, ArrowDownCircle, FileText } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/PageShell";

interface Plan {
  id: string;
  name: string;
  price_inr: number;
  cases_per_month: number;
  ai_label: string;
  features: string[];
}

interface StripePlan {
  tier: string;
  priceId: string;
  currency: string;
  unitAmount: number;
}

const TIER_ICONS: Record<string, React.ElementType> = {
  free: Star,
  professional: Zap,
  advocate_pro: Crown,
};

const TIER_ACCENT: Record<string, string> = {
  free: "border-border bg-card",
  professional: "border-primary/50 bg-primary/5 shadow-md shadow-primary/5",
  advocate_pro: "border-amber-500/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg shadow-amber-500/10",
};

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);
  const [downgrading, setDowngrading] = useState(false);

  const country = getCountryFromPath();
  const isIndia = !country || country === "in";

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscription/plans"),
    staleTime: 300000,
  });

  // International (non-India) pricing via Stripe.
  const { data: stripeData } = useQuery<{ currency: string; plans: StripePlan[] }>({
    queryKey: ["stripe-plans", country],
    enabled: !isIndia,
    staleTime: 300000,
    queryFn: async () => {
      const res = await fetch(`/api/stripe/plans?country=${country}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  // After returning from a Stripe Checkout, confirm the subscription + tier.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("stripe");
    if (flag === "success") {
      (async () => {
        try {
          const res = await fetch(`/api/stripe/reconcile`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json().catch(() => ({}));
          if (data?.tier) {
            await refreshUser();
            queryClient.invalidateQueries({ queryKey: ["health"] });
            setSuccess(TIER_LABELS[data.tier] ?? data.tier);
          } else {
            setError("We couldn't confirm your subscription yet. Please refresh in a moment.");
          }
        } catch {
          setError("We couldn't confirm your subscription. Please contact support.");
        } finally {
          window.history.replaceState({}, "", window.location.pathname);
        }
      })();
    } else if (flag === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRazorpayScript = () => new Promise<void>((resolve, reject) => {
    if (document.getElementById("razorpay-script")) { resolve(); return; }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });

  const createOrder = useMutation({
    mutationFn: (tier: string) =>
      apiFetch("/subscription/create-order", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
  });

  const verifyPayment = useMutation({
    mutationFn: (payload: object) =>
      apiFetch("/subscription/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });

  const downgrade = useMutation({
    mutationFn: () =>
      apiFetch("/subscription/downgrade", {
        method: "POST",
      }),
  });

  const handleDowngrade = async () => {
    if (!confirm("Downgrade to Free? You will keep current benefits until the end of this billing period.")) return;
    setDowngrading(true);
    setSuccess(null);
    setError(null);
    try {
      await downgrade.mutateAsync();
      await refreshUser();
      setSuccess("Free");
    } catch (e: any) {
      setError(e.message || "Downgrade failed.");
    } finally {
      setDowngrading(false);
    }
  };

  const { data: invoices } = useQuery<{ invoices: { id: number; tier: string; started_at: string; status: string; payment_ref: string }[] }>({
    queryKey: ["invoices"],
    enabled: !!user,
    queryFn: () => apiFetch("/subscription/invoices"),
  });

  const downloadInvoice = (id: number) => {
    window.open(`/litigaforge/subscription/download-invoice/${id}`, "_blank");
  };

  const handleRazorpayUpgrade = async (tier: string) => {
    setUpgrading(tier);
    setSuccess(null);
    setError(null);
    setRazorpayError(null);

    try {
      await loadRazorpayScript();
      const orderData = await createOrder.mutateAsync(tier);

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LitigaForge AI",
        description:
          tier === "professional"
            ? "Professional Plan \u2014 \u20b9999/month"
            : "Advocate Pro \u2014 \u20b92,499/month",
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verify = await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tier,
            });
            if (verify.success) {
              await refreshUser();
              queryClient.invalidateQueries({ queryKey: ["health"] });
              setSuccess(TIER_LABELS[tier] ?? tier);
              setUpgrading(null);
            } else {
              setRazorpayError("Payment verification failed. Please contact support.");
              setUpgrading(null);
            }
          } catch (e: any) {
            setRazorpayError(e.message || "Payment verification failed.");
            setUpgrading(null);
          }
        },
        prefill: { name: user?.name ?? "", email: user?.email ?? "" },
        theme: { color: "#D97706" },
        modal: {
          ondismiss: () => {
            setUpgrading(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      setError(e.message || "Failed to start payment. Please try again.");
      setUpgrading(null);
    }
  };

  const handleStripeUpgrade = async (tier: string) => {
    setUpgrading(tier);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/stripe/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, country }),
      });
      if (res.status === 401) {
        window.location.href = buildCountryUrl(country ?? "in", "login");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to start checkout.");
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Checkout session could not be created.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to start checkout. Please try again.");
      setUpgrading(null);
    }
  };

  const handleUpgrade = (tier: string) => {
    if (tier !== "professional" && tier !== "advocate_pro") return;
    if (isIndia) {
      void handleRazorpayUpgrade(tier);
    } else {
      void handleStripeUpgrade(tier);
    }
  };

  const stripePlanFor = (tier: string): StripePlan | undefined =>
    stripeData?.plans.find((p) => p.tier === tier);

  const renderPrice = (plan: Plan) => {
    if (plan.price_inr === 0) {
      return <span className="text-4xl font-bold text-foreground">Free</span>;
    }
    if (isIndia) {
      return (
        <>
          <span className="text-4xl font-bold text-foreground tracking-tight">₹{plan.price_inr.toLocaleString("en-IN")}</span>
          <span className="text-base text-muted-foreground font-medium mb-1.5">/mo</span>
        </>
      );
    }
    const sp = stripePlanFor(plan.id);
    if (!sp) {
      return <span className="text-2xl font-bold text-muted-foreground">—</span>;
    }
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: sp.currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(sp.unitAmount / 100);
    return (
      <>
        <span className="text-4xl font-bold text-foreground tracking-tight">{formatted}</span>
        <span className="text-base text-muted-foreground font-medium mb-1.5">/mo</span>
      </>
    );
  };

  const currentTier = user?.subscription_tier ?? "free";
  const limit = currentTier === "advocate_pro" ? -1 : (currentTier === "professional" ? 50 : 5);
  const used = user?.cases_this_month ?? 0;

  return (<>
      <SEOHelmet title="Subscription Plans" description="Upgrade to Professional or Advocate Pro plans." canonical="/subscription" />
    <PageShell title="Subscription Plans" subtitle="Choose the plan that fits your practice. Upgrade or downgrade anytime." icon={<Crown className="w-6 h-6 text-primary" />}>
      <div className="space-y-10">
        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                 <Crown className="w-8 h-8" />
               </div>
               <div>
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Plan</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-foreground">
                      {TIER_LABELS[currentTier]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      ACTIVE
                    </span>
                  </div>
               </div>
            </div>
            
            <div className="md:text-right border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly Usage</p>
              <p className="text-3xl font-bold text-foreground font-mono flex items-baseline md:justify-end gap-1">
                {used}
                <span className="text-base text-muted-foreground font-sans font-medium mb-0.5">
                  / {limit === -1 ? "\u221e" : limit} cases
                </span>
              </p>
              {limit !== -1 && (
                <div className="mt-3 h-2 w-full md:w-48 bg-muted rounded-full overflow-hidden ml-auto">
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
            className="max-w-3xl mx-auto flex items-center justify-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-6 py-5 text-green-800 dark:text-green-300"
          >
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <span className="font-semibold text-lg">Successfully upgraded to <strong>{success}</strong>!</span>
          </motion.div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 bg-destructive/10 border border-destructive/20 rounded-2xl px-6 py-5 text-destructive">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <span className="font-semibold text-lg">{error}</span>
          </div>
        )}

        {currentTier !== "free" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto flex items-center justify-between gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-4 text-amber-800 dark:text-amber-300"
          >
            <div className="flex items-center gap-3">
              <ArrowDownCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">Not satisfied? You can downgrade to Free anytime. Benefits continue until the end of the billing period.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDowngrade}
              disabled={downgrading}
              className="flex-shrink-0 border-amber-300 hover:bg-amber-100 text-amber-900"
            >
              {downgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Downgrade"}
            </Button>
          </motion.div>
        )}

        {invoices && invoices.invoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto bg-card border border-border rounded-2xl p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Billing History
            </h3>
            <div className="space-y-2">
              {invoices.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium capitalize">{inv.tier.replace("_", " ")} Plan</p>
                    <p className="text-xs text-muted-foreground">{inv.started_at.split("T")[0]} &middot; {inv.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{inv.payment_ref.slice(0, 12)}...</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadInvoice(inv.id)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {razorpayError && (
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <span className="font-semibold text-lg">{razorpayError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1,2,3].map(i => (
              <div key={i} className="h-[500px] bg-card border border-border rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {(plans ?? []).map((plan, idx) => {
              const Icon = TIER_ICONS[plan.id] ?? Star;
              const isCurrent = plan.id === currentTier;
              const isPopular = plan.id === "professional";
              const isUpgrading = upgrading === plan.id;
              const iconColor = plan.id === "advocate_pro" ? "text-amber-500" : "text-primary";
              const iconBg = plan.id === "advocate_pro" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10";

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    "rounded-3xl border-2 p-8 flex flex-col relative transition-all duration-300",
                    TIER_ACCENT[plan.id],
                    isCurrent && "ring-4 ring-primary/20 border-primary"
                  )}
                >
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase shadow-md">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase shadow-md">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="mb-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={cn("p-3 rounded-2xl flex-shrink-0", iconBg)}>
                        <Icon className={cn("w-6 h-6", iconColor)} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">{plan.ai_label}</p>
                      </div>
                    </div>
                    
                    <div className="mb-2 flex items-end gap-1.5">
                      {renderPrice(plan)}
                    </div>
                    <p className="text-sm font-medium text-foreground/70 bg-background/50 inline-block px-3 py-1 rounded-lg border border-border/50">
                      {plan.cases_per_month === -1 ? "Unlimited cases" : `${plan.cases_per_month} cases included`}
                    </p>
                  </div>

                  <ul className="space-y-4 flex-1 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-3 text-sm font-medium text-foreground/80">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="leading-snug pt-0.5">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => !isCurrent && handleUpgrade(plan.id)}
                    disabled={isCurrent || isUpgrading || createOrder.isPending}
                    variant={isCurrent ? "outline" : (plan.id === "advocate_pro" ? "default" : "default")}
                    size="lg"
                    className={cn(
                      "w-full h-14 text-base",
                      plan.id === "advocate_pro" && !isCurrent && "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    {isUpgrading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing\u2026</>
                    ) : isCurrent ? (
                      "Your Current Plan"
                    ) : plan.price_inr === 0 ? (
                      "Downgrade to Free"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>

                  {plan.price_inr > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
                      {isIndia
                        ? "Powered by Razorpay. Your payment is secure and encrypted."
                        : "Powered by Stripe. Your payment is secure and encrypted."}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </PageShell>
  </>);
}
