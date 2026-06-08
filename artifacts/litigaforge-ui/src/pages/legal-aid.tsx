import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCountryFromPath } from "@/lib/country";
import { Heart, Phone, Globe, MapPin, ChevronRight, CheckCircle2, XCircle, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

type WizardStep = "income" | "category" | "result";

const INCOME_OPTIONS = [
  { id: "low", label: "Low income / receiving benefits or financial hardship", eligible: true },
  { id: "moderate", label: "Moderate income — money is tight", eligible: false, borderline: true },
  { id: "comfortable", label: "Financially comfortable", eligible: false },
];

const CATEGORY_OPTIONS = [
  { id: "woman", label: "Woman / survivor of domestic violence", eligible: true, icon: "🛡️" },
  { id: "child", label: "Child or young person (under 18)", eligible: true, icon: "🧒" },
  { id: "disabled", label: "Person with a disability", eligible: true, icon: "♿" },
  { id: "senior", label: "Senior citizen", eligible: true, icon: "👵" },
  { id: "worker", label: "Worker in a labour / employment dispute", eligible: true, icon: "👷" },
  { id: "custody", label: "Detained / facing criminal charges", eligible: true, icon: "🔒" },
  { id: "victim", label: "Victim of crime, trafficking or disaster", eligible: true, icon: "⚖️" },
  { id: "other", label: "None of the above", eligible: false, icon: "👤" },
];

interface RegionalContact {
  name: string;
  region: string;
  phone?: string;
  website?: string;
  address?: string;
}

interface ContactData {
  country: string;
  country_name: string;
  flag: string;
  currency_symbol: string;
  national: {
    name: string; helpline: string; website: string; eligibility: string[];
  };
  regional: RegionalContact[];
  other_resources: { name: string; phone: string }[];
}

export default function LegalAid() {
  const cc = (getCountryFromPath() || "in").toUpperCase();
  const [step, setStep] = useState<WizardStep>("income");
  const [income, setIncome] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const { data: contacts } = useQuery<ContactData>({
    queryKey: ["legal-aid-contacts", cc],
    queryFn: () => apiFetch(`/legal-aid/contacts?country=${cc}`),
    staleTime: 3600000,
  });

  const nationalName = contacts?.national?.name ?? "Legal Aid";
  const helpline = contacts?.national?.helpline ?? "";
  const countryName = contacts?.country_name ?? "your region";

  const govSchema = contacts
    ? {
        "@context": "https://schema.org",
        "@type": "GovernmentService",
        "name": `${nationalName} — Free Legal Aid`,
        "description": `Free or low-cost legal aid available in ${countryName}.`,
        "provider": { "@type": "GovernmentOrganization", "name": nationalName, "url": contacts.national.website },
        ...(helpline ? { "telephone": helpline } : {}),
        "serviceType": "Free Legal Aid",
        "areaServed": { "@type": "Country", "name": countryName },
      }
    : undefined;

  const incomeOpt = INCOME_OPTIONS.find(o => o.id === income);
  const catOpt = CATEGORY_OPTIONS.find(o => o.id === category);

  const determineEligibility = (catId: string) => {
    const cat = CATEGORY_OPTIONS.find(o => o.id === catId);
    setCategory(catId);
    const incomeEligible = incomeOpt?.eligible ?? false;
    const borderline = (incomeOpt as any)?.borderline ?? false;
    const catEligible = cat?.eligible ?? false;
    const eligible = incomeEligible || catEligible || (borderline && catEligible);

    let reason = "";
    if (eligible) {
      const reasons: string[] = [];
      if (incomeEligible) reasons.push("low income / financial hardship");
      if (catEligible) reasons.push((cat?.label ?? "").toLowerCase());
      reason = `You likely qualify for free or subsidised legal aid based on: ${reasons.join(" and ")}. Most programmes apply a means and merits test — contact the bodies below to confirm.`;
    } else {
      reason = `Based on your answers you may not qualify for fully free aid, but you can still get low-cost help, community legal clinics, and initial advice from the organisations below.`;
    }

    setResult({ eligible, reason });
    setStep("result");
  };

  const reset = () => {
    setStep("income"); setIncome(""); setCategory(""); setResult(null);
  };

  return (
    <PageShell title="Free Legal Aid" subtitle={`Check if you qualify for free legal aid in ${countryName} and find official helplines near you.`} icon={<Heart className="w-6 h-6 text-primary" />}>
      <SEOHelmet
        title={`Free Legal Aid in ${countryName} | LitigaForge`}
        description={`Find free and low-cost legal aid in ${countryName}. Eligibility checker plus official legal-aid bodies, helplines and websites.`}
        canonical="/legal-aid"
        keywords={`free legal aid ${countryName}, legal aid eligibility, ${nationalName}, pro bono lawyer, legal help`}
        structuredData={govSchema}
      />

      <div className="space-y-8">
        {/* Eligibility wizard */}
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden max-w-2xl mx-auto">
          <div className="px-6 py-4 bg-muted border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-green-500" />
               Eligibility Check {contacts?.flag ? `· ${contacts.flag}` : ""}
            </p>
            {step !== "result" && (
               <div className="flex gap-2">
                 {(["income", "category"] as WizardStep[]).map(s => (
                    <div key={s} className={cn("w-2 h-2 rounded-full transition-all", s === step ? "bg-primary w-6" : "bg-border")} />
                 ))}
               </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Income */}
            {step === "income" && (
              <motion.div key="income" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                <p className="text-xl font-bold text-foreground mb-6">How would you describe your financial situation?</p>
                <div className="space-y-4">
                  {INCOME_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setIncome(opt.id); setStep("category"); }}
                      className="w-full flex items-center justify-between px-6 py-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{opt.label}</span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Category */}
            {step === "category" && (
              <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                <button onClick={() => setStep("income")} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <p className="text-xl font-bold text-foreground mb-6">Which best describes your situation?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CATEGORY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => determineEligibility(opt.id)}
                      className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Result */}
            {step === "result" && result && (
              <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-8 space-y-8">
                <div className={cn(
                  "flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 p-8 rounded-2xl border-2",
                  result.eligible
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                )}>
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0", result.eligible ? "bg-green-100 dark:bg-green-900/50" : "bg-amber-100 dark:bg-amber-900/50")}>
                     {result.eligible
                      ? <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                      : <XCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <div>
                    <h3 className={cn("text-2xl font-bold mb-2", result.eligible ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300")}>
                      {result.eligible ? "You likely qualify for free legal aid" : "You may still get low-cost legal help"}
                    </h3>
                    <p className={cn("text-base font-medium leading-relaxed", result.eligible ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400")}>
                      {result.reason}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Next Steps & Contacts</h4>

                  {helpline && (
                    <div className="flex items-center justify-between p-6 rounded-2xl bg-destructive border border-destructive-border shadow-md text-destructive-foreground">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">{nationalName} Helpline</p>
                        <p className="font-bold text-2xl md:text-3xl font-mono tracking-wider">{helpline}</p>
                      </div>
                      <a href={`tel:${helpline.replace(/\s/g, "")}`} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-card text-destructive font-bold hover:bg-card/90 transition shadow-sm flex-shrink-0">
                        <Phone className="w-5 h-5" /> Call
                      </a>
                    </div>
                  )}

                  {contacts?.national?.website && (
                    <a
                      href={contacts.national.website}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">National Authority</p>
                        <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{nationalName}</p>
                      </div>
                      <ExternalLink className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </a>
                  )}

                  {(contacts?.regional ?? []).map((r, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{r.region}</p>
                        <h4 className="text-lg font-bold text-foreground">{r.name}</h4>
                      </div>
                      {r.phone && (
                        <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-base text-primary font-mono font-bold hover:underline">
                          <Phone className="w-4 h-4" />{r.phone}
                        </a>
                      )}
                      {r.address && (
                        <div className="flex items-start gap-3 text-sm text-foreground/80 font-medium bg-muted/50 p-3 rounded-xl border border-border">
                          <MapPin className="w-5 h-5 flex-shrink-0 text-primary" />
                          <span className="leading-relaxed">{r.address}</span>
                        </div>
                      )}
                      {r.website && (
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                          <Globe className="w-4 h-4" /> Visit website
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {(contacts?.other_resources ?? []).length > 0 && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Emergency Helplines</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(contacts?.other_resources ?? []).map(r => (
                        <a key={r.name} href={`tel:${r.phone.replace(/\s/g, "")}`}
                          className="flex items-center justify-between px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/50 transition shadow-sm">
                          <span className="text-sm font-semibold text-foreground">{r.name}</span>
                          <span className="font-mono font-bold text-primary">{r.phone}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={reset} variant="outline" size="lg" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Start Over
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Who qualifies list */}
        {step !== "result" && (
           <div className="bg-card rounded-2xl border border-border shadow-sm p-8 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-foreground mb-6">
              Who Qualifies for Free Legal Aid in {countryName}?
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              {(contacts?.national?.eligibility ?? []).map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium text-foreground/80">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="leading-snug">{e}</span>
                </li>
              ))}
            </ul>
            {contacts?.national?.website && (
              <div className="mt-8 pt-6 border-t border-border flex justify-center">
                <a
                  href={contacts.national.website}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline text-center"
                >
                  <Globe className="w-4 h-4" /> Visit {nationalName} for full guidelines
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
