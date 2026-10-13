import { SEOHelmet } from "@/components/SEOHelmet";
import PricingSection from "@/components/PricingSection";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { useCountry } from "@/hooks/useCountry";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Link } from "wouter";

const FAQ = [
  {
    question: "Can I start without paying?",
    answer: "Yes. The Free plan is available without a subscription. Paid features and limits are shown before checkout.",
  },
  {
    question: "Can I choose monthly or annual billing?",
    answer: "Where both billing periods are available, you can switch between monthly and annual pricing in the plan selector.",
  },
  {
    question: "Are taxes included?",
    answer: "For India, applicable GST is shown before payment and reflected on your receipt or tax invoice.",
  },
  {
    question: "Can I cancel a paid plan?",
    answer: "You can cancel renewal from your account. Your paid access generally continues through the current billing period.",
  },
];

export default function PricingPage() {
  const { activeCode } = useCountry();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SEOHelmet
        title="Pricing | LitigaForge AI"
        description="Compare LitigaForge plans and features for legal research, case tools, and document workflows."
        canonical="/pricing"
      />
      <header className="mx-auto max-w-5xl px-5 pt-16 pb-8 text-center">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase text-primary">Plans</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose the tools you need</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Compare the current plans and included features. Applicable GST is shown before checkout.
        </p>
      </header>
      <PricingSection countryCode={activeCode} />
      <McpConnectorPlans />
      <section className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Pricing questions</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="py-5">
              <summary className="cursor-pointer font-medium">{question}</summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <LegalDisclaimerFooter />
    </main>
  );
}

function McpConnectorPlans() {
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  const [busyPlan, setBusyPlan] = useState("");
  const { data } = useQuery({
    queryKey: ["mcp-public-plans"],
    queryFn: () => apiFetch("/mcp/plans"),
    staleTime: 60_000,
  });
  const plans = data?.plans;
  if (!plans) return null;
  const purchase = async (planId: string) => {
    setBusyPlan(planId);
    setNotice("");
    try {
      const order = await apiFetch(`/mcp/checkout/${planId}`, { method: "POST" });
      if (typeof (window as any).Razorpay !== "function") {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => typeof (window as any).Razorpay === "function" ? resolve() : reject(new Error("Razorpay checkout did not initialize."));
          script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
          document.body.appendChild(script);
        });
      }
      const checkout = new (window as any).Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency,
        name: "LitigaForge MCP", description: labels[planId],
        order_id: order.order_id,
        handler: async (payment: any) => {
          try {
            await apiFetch("/mcp/checkout/verify", { method: "POST", body: { plan_id: planId, ...payment } });
            setNotice("Payment verified. MCP access is active for 30 days.");
          } catch (error) {
            setNotice(error instanceof Error ? error.message : "Payment verification failed.");
          }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#b89045" },
      });
      checkout.open();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setBusyPlan("");
    }
  };
  const labels: Record<string, string> = {
    free: "MCP Free", reviewer: "Anthropic Reviewer", advocate_addon: "Advocate MCP Add-on",
    firm: "Firm / In-house", data_api: "Data API",
  };
  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <h2 className="text-2xl font-semibold tracking-tight">MCP connector plans</h2>
      <p className="mt-2 text-sm text-muted-foreground">GST is added to paid plans. Limits and prices are administered by LitigaForge.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(plans).map(([id, plan]: [string, any]) => (
          <article key={id} className="rounded-xl border border-border p-5">
            <h3 className="font-semibold">{labels[id] || id}</h3>
            <p className="mt-2 text-xl font-bold">
              {plan.price_inr === 0 ? "Free" : `₹${Number(plan.price_inr).toLocaleString("en-IN")}/month`}
              {plan.gst_percent > 0 && <span className="text-xs font-normal text-muted-foreground"> + GST</span>}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.daily_calls != null ? `${plan.daily_calls.toLocaleString()} calls/day` :
                plan.monthly_calls != null ? `${plan.monthly_calls.toLocaleString()} pooled calls/month` : "Usage limits apply"}
              {plan.seats > 1 ? ` · up to ${plan.seats} seats` : ""}
            </p>
            {plan.overage_inr > 0 && <p className="mt-1 text-sm">Overage: ₹{plan.overage_inr}/call, billed monthly.</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {id === "reviewer" ? "Invite-only; seeded fictional demo matters; expires after 30 days." :
                id === "data_api" ? "Disabled pending resale permissions." :
                !plan.enabled ? "Currently unavailable." : id === "free" ?
                  "Acts, section mapping, limitation lookup, and limited judgment research." :
                  "All MCP tools, subject to plan limits."}
            </p>
            {(id === "advocate_addon" || id === "firm") && plan.enabled && (user
              ? <button type="button" onClick={() => void purchase(id)} disabled={busyPlan === id}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {busyPlan === id ? "Starting checkout…" : "Subscribe with Razorpay"}
                </button>
              : <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-primary">Sign in to subscribe</Link>)}
          </article>
        ))}
      </div>
      {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
    </section>
  );
}
