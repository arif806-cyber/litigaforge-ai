import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { SegmentedControl } from "@/components/mobile-primitives";

interface Plan {
  id: string;
  name: string;
  price_inr: number;
  monthly_price_inr: number;
  annual_price_inr: number;
  gst_percent: number;
  gst_label: string;
  annual_savings_label?: string;
  trial_days?: number;
  chamber_advocates?: number;
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
  free: "border-border bg-card",
  professional: "border-primary/50 bg-primary/5 shadow-md shadow-primary/5",
  advocate_pro: "border-amber-500/50 bg-card shadow-lg shadow-amber-500/10",
};

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);
  const [downgrading, setDowngrading] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(false);

  const country = getCountryFromPath();

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscription/plans"),
    staleTime: 300000,
  });


  const loadRazorpayScript = () => new Promise<void>((resolve, reject) => {
    if (typeof (window as any).Razorpay === "function") {
      resolve();
      return;
    }

    // A stale/failed script tag does not mean checkout.js initialized.
    document.getElementById("razorpay-script")?.remove();
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("Razorpay checkout took too long to load. Please check your connection and retry."));
    }, 15000);
    script.onload = () => {
      window.clearTimeout(timeout);
      if (typeof (window as any).Razorpay === "function") {
        resolve();
      } else {
        script.remove();
        reject(new Error("Razorpay checkout did not initialize. Please retry."));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Failed to load Razorpay checkout. Please check your connection and retry."));
    };
    document.body.appendChild(script);
  });

  const createOrder = useMutation({
    mutationFn: ({ tier, billingPeriod }: { tier: string; billingPeriod: "monthly" | "annual" }) =>
      apiFetch("/subscription/create-order", {
        method: "POST",
        body: JSON.stringify({ tier, billing_period: billingPeriod }),
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

  const startTrial = useMutation({
    mutationFn: () =>
      apiFetch("/subscription/start-trial", {
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

  const { data: invoices } = useQuery<{ invoices: { id: number; tier: string; plan_name?: string; started_at: string; status: string; payment_ref: string }[] }>({
    queryKey: ["invoices"],
    enabled: !!user,
    queryFn: () => apiFetch("/subscription/invoices"),
  });

  const downloadInvoice = (id: number) => {
    window.open(`/litigaforge/subscription/download-invoice/${id}`, "_blank");
  };

  const handleRazorpayUpgrade = async (tier: string) => {
    if (!user) {
      window.location.href = buildCountryUrl(country ?? "in", "login");
      return;
    }
    setUpgrading(tier);
    setSuccess(null);
    setError(null);
    setRazorpayError(null);

    try {
      const billingPeriod = annualBilling ? "annual" : "monthly";
      const plan = plans?.find((item) => item.id === tier);
      await loadRazorpayScript();
      const orderData = await createOrder.mutateAsync({ tier, billingPeriod });
      if (
        !orderData?.order_id
        || !orderData?.amount
        || !orderData?.currency
        || !orderData?.key_id
      ) {
        throw new Error("Payment order could not be initialized. Please retry.");
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LitigaForge AI",
        description: `${plan?.name ?? tier} — ₹${(
          billingPeriod === "annual"
            ? plan?.annual_price_inr
            : plan?.monthly_price_inr
        )?.toLocaleString("en-IN")}/${billingPeriod === "annual" ? "year" : "month"} + 18% GST`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verify = await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tier,
              billing_period: billingPeriod,
            });
            if (verify.success) {
              await refreshUser();
              queryClient.invalidateQueries({ queryKey: ["health"] });
              setSuccess(TIER_LABELS[tier] ?? tier);
              setUpgrading(null);
            } else {
              const message = "Payment verification failed. Please contact support.";
              setRazorpayError(message);
              toast({ title: "Payment verification failed", description: message, variant: "destructive" });
              setUpgrading(null);
            }
          } catch (e: any) {
            const message = e.message || "Payment verification failed.";
            setRazorpayError(message);
            toast({ title: "Payment verification failed", description: message, variant: "destructive" });
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
      rzp.on("payment.failed", (response: any) => {
        const message =
          response?.error?.description
          || response?.error?.reason
          || "The payment could not be completed. Please retry.";
        setRazorpayError(message);
        setUpgrading(null);
        toast({ title: "Payment failed", description: message, variant: "destructive" });
      });
      rzp.open();
    } catch (e: any) {
      const message = e.message || "Failed to start payment. Please try again.";
      setError(message);
      toast({ title: "Could not open checkout", description: message, variant: "destructive" });
      setUpgrading(null);
    }
  };

  const handleUpgrade = (tier: string) => {
    if (tier !== "professional" && tier !== "advocate_pro") return;
    void handleRazorpayUpgrade(tier);
  };

  const handleTrial = async () => {
    if (!user) {
      window.location.href = buildCountryUrl(country ?? "in", "login");
      return;
    }
    setUpgrading("professional-trial");
    setSuccess(null);
    setError(null);
    try {
      await startTrial.mutateAsync();
      await refreshUser();
      setSuccess(`${TIER_LABELS.professional} free trial`);
    } catch (e: any) {
      setError(e.message || "Unable to start the free trial.");
    } finally {
      setUpgrading(null);
    }
  };

  const renderPrice = (plan: Plan) => {
    const price = annualBilling ? plan.annual_price_inr : plan.monthly_price_inr;
    if (price === 0) {
      return <span className="text-4xl font-bold text-foreground">Free</span>;
    }
    return (
      <>
        <span className="text-4xl font-bold text-foreground tracking-tight">₹{price.toLocaleString("en-IN")}</span>
        <span className="text-base text-muted-foreground font-medium mb-1.5">{annualBilling ? "/yr" : "/mo"}</span>
      </>
    );
  };

  const currentTier = user?.subscription_tier ?? "free";
  const limit = currentTier === "advocate_pro" ? -1 : (currentTier === "professional" ? 50 : 5);
  const used = user?.cases_this_month ?? 0;

  return (<>
      <SEOHelmet
        title="LitigaForge AI Plans — Free, Advocate Pro & Chamber"
        description="Compare Free, Advocate Pro (₹999/month), and Chamber (₹2,499/month) plans for legal tools and advocate practice management."
        canonical="/subscription"
        keywords="litigaforge pricing, legal ai plans, advocate tools, legal ai free, advocate legal practice India"
      />
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
              <span className="font-medium text-sm">
                Not satisfied? You can downgrade to Free anytime. Benefits continue until the end of the billing period.
              </span>
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
                    <p className="text-sm font-medium">{inv.plan_name ?? TIER_LABELS[inv.tier] ?? `${(inv.tier ?? "").replace("_", " ")} Plan`}</p>
                    <p className="text-xs text-muted-foreground">{(inv.started_at ?? "").split("T")[0]} &middot; {inv.status ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.payment_ref ? (
                      <span className="text-xs text-muted-foreground font-mono">{inv.payment_ref.slice(0, 12)}…</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
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

        <SegmentedControl
          className="mx-auto w-fit md:hidden"
          label="Billing period"
          value={annualBilling ? "annual" : "monthly"}
          onValueChange={(value) => setAnnualBilling(value === "annual")}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: <>Annual <span className="ml-1 text-[10px]">2 months free</span></> },
          ]}
        />
        <div className="mx-auto hidden w-fit items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm md:flex">
          <Button
            type="button"
            variant={!annualBilling ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => setAnnualBilling(false)}
          >
            Monthly
          </Button>
          <Button
            type="button"
            variant={annualBilling ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => setAnnualBilling(true)}
          >
            Annual
            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
              2 months free
            </span>
          </Button>
        </div>

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
              const isCurrent = !!user && plan.id === currentTier;
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
                    {plan.price_inr > 0 && (
                      <p className="mb-3 text-xs font-semibold text-muted-foreground">
                        {plan.gst_label}
                        {annualBilling && plan.annual_savings_label ? ` · ${plan.annual_savings_label}` : ""}
                      </p>
                    )}
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
                    onClick={() => plan.price_inr === 0 && !user ? window.location.assign(buildCountryUrl(country ?? "in", "register")) : !isCurrent && handleUpgrade(plan.id)}
                    disabled={isCurrent || isUpgrading || createOrder.isPending}
                    variant={isCurrent ? "outline" : (plan.id === "advocate_pro" ? "default" : "default")}
                    size="lg"
                    className={cn(
                      "w-full h-14 text-base",
                      plan.id === "advocate_pro" && !isCurrent && "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    {isUpgrading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing…</>
                    ) : isCurrent ? (
                      "Your Current Plan"
                    ) : plan.price_inr === 0 ? (
                      user ? "Your Current Plan" : "Start free"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>

                  {plan.id === "professional" && !isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="mt-3 h-12 w-full"
                      onClick={() => void handleTrial()}
                      disabled={upgrading === "professional-trial" || startTrial.isPending}
                    >
                      {upgrading === "professional-trial" ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting trial…</>
                      ) : (
                        "Start 30-day free trial"
                      )}
                    </Button>
                  )}

                  {plan.price_inr > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
                      {plan.id === "professional" && "Trial requires no payment. "}
                      Paid plans are secured by Razorpay.
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
