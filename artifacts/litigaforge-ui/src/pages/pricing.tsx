import { SEOHelmet } from "@/components/SEOHelmet";
import PricingSection from "@/components/PricingSection";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { useCountry } from "@/hooks/useCountry";

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
