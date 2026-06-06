import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Heart, Phone, Globe, MapPin, ChevronRight, CheckCircle2, XCircle, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EligibilityResult {
  eligible: boolean;
  reason: string;
  category: string;
}

type WizardStep = "income" | "category" | "district" | "result";

const INCOME_OPTIONS = [
  { id: "below1", label: "Below ₹1,00,000 / year", eligible: true },
  { id: "1to3", label: "₹1,00,000 – ₹3,00,000 / year", eligible: true },
  { id: "above3", label: "Above ₹3,00,000 / year", eligible: false },
];

const CATEGORY_OPTIONS = [
  { id: "sc_st", label: "SC / ST community member", eligible: true, icon: "⚖️" },
  { id: "woman", label: "Woman / Girl child", eligible: true, icon: "👩" },
  { id: "child", label: "Child (under 18)", eligible: true, icon: "🧒" },
  { id: "disabled", label: "Person with disability", eligible: true, icon: "♿" },
  { id: "worker", label: "Industrial / daily wage worker", eligible: true, icon: "👷" },
  { id: "custody", label: "Person in police custody / jail", eligible: true, icon: "🔒" },
  { id: "trafficking", label: "Victim of trafficking / disaster", eligible: true, icon: "🛡️" },
  { id: "other", label: "None of the above", eligible: false, icon: "👤" },
];

const DISTRICTS = [
  "Hyderabad", "Rangareddy", "Warangal", "Karimnagar", "Khammam",
  "Nizamabad", "Nalgonda", "Medak", "Adilabad", "Mahbubnagar",
];

interface ContactData {
  national: {
    name: string; helpline: string; website: string; eligibility: string[];
  };
  telangana: {
    name: string; website: string; address: string; phone: string;
  };
  districts: {
    district: string; dlsa: string; phone: string; address: string;
  }[];
  other_resources: { name: string; phone: string }[];
}

export default function LegalAid() {
  const [step, setStep] = useState<WizardStep>("income");
  const [income, setIncome] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [district, setDistrict] = useState<string>("Hyderabad");
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const { data: contacts } = useQuery<ContactData>({
    queryKey: ["legal-aid-contacts"],
    queryFn: () => apiFetch("/legal-aid/contacts"),
    staleTime: 3600000,
  });

  const govSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GovernmentService",
        "name": "NALSA Free Legal Aid Helpline",
        "description": "Free legal aid provided by the National Legal Services Authority to SC/ST, women, children, persons in police custody, and citizens with annual income below ₹3,00,000.",
        "provider": {
          "@type": "GovernmentOrganization",
          "name": "National Legal Services Authority (NALSA)",
          "url": "https://nalsa.gov.in",
        },
        "telephone": "15100",
        "serviceType": "Free Legal Aid",
        "areaServed": { "@type": "Country", "name": "India" },
        "availableChannel": {
          "@type": "ServiceChannel",
          "servicePhone": {
            "@type": "ContactPoint",
            "telephone": "15100",
            "contactType": "customer service",
            "availableLanguage": ["English", "Hindi", "Telugu"],
          },
        },
      },
      ...(contacts?.districts ?? []).map(d => ({
        "@type": "GovernmentService",
        "name": d.dlsa,
        "description": `District Legal Services Authority providing free legal aid in ${d.district}, Telangana`,
        "provider": {
          "@type": "GovernmentOrganization",
          "name": d.dlsa,
        },
        "telephone": d.phone,
        "serviceType": "Free Legal Aid",
        "areaServed": { "@type": "City", "name": d.district, "containedInPlace": { "@type": "State", "name": "Telangana" } },
        "address": {
          "@type": "PostalAddress",
          "streetAddress": d.address,
          "addressRegion": "Telangana",
          "addressCountry": "IN",
        },
      })),
    ],
  };

  const incomeOpt = INCOME_OPTIONS.find(o => o.id === income);
  const catOpt = CATEGORY_OPTIONS.find(o => o.id === category);

  const determineEligibility = (d: string) => {
    setDistrict(d);
    const incomeEligible = incomeOpt?.eligible ?? false;
    const catEligible = catOpt?.eligible ?? false;
    const eligible = incomeEligible || catEligible;

    let reason = "";
    if (eligible) {
      const reasons = [];
      if (incomeEligible) reasons.push(`income below ₹3,00,000`);
      if (catEligible) reasons.push(catOpt?.label ?? "");
      reason = `You qualify for free legal aid based on: ${reasons.join(" and ")}.`;
    } else {
      reason = "Based on your responses, you may not qualify for NALSA free legal aid. However, you can still access low-cost legal help through the Bar Council and other services.";
    }

    setResult({ eligible, reason, category: catOpt?.id ?? "" });
    setStep("result");
  };

  const reset = () => {
    setStep("income"); setIncome(""); setCategory(""); setResult(null);
  };

  const dlsa = contacts?.districts.find(d => d.district === district);

  return (
    <PageShell title="Free Legal Aid" subtitle="Check if you qualify for free legal aid under NALSA and find your nearest Telangana DLSA office." icon={<Heart className="w-6 h-6 text-primary" />}>
      <SEOHelmet
        title="Free Legal Aid Contacts Telangana | LitigaForge"
        description="Find free legal aid in Telangana and Andhra Pradesh. NALSA eligibility checker, TSLSA helplines, all 8 DLSA district contacts. Toll-free: 15100."
        canonical="/legal-aid"
        keywords="free legal aid Telangana, NALSA helpline, TSLSA contact, DLSA Hyderabad, legal aid eligibility India, free lawyer government scheme"
        structuredData={govSchema}
      />

      <div className="space-y-8">
        {/* Eligibility wizard */}
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden max-w-2xl mx-auto">
          <div className="px-6 py-4 bg-muted border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-green-500" />
               Eligibility Check — NALSA / TSLSA
            </p>
            {step !== "result" && (
               <div className="flex gap-2">
                 {(["income", "category", "district"] as WizardStep[]).map(s => (
                    <div key={s} className={cn("w-2 h-2 rounded-full transition-all", s === step ? "bg-primary w-6" : "bg-border")} />
                 ))}
               </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Income */}
            {step === "income" && (
              <motion.div key="income" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                <p className="text-xl font-bold text-foreground mb-6">What is your approximate annual household income?</p>
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
                  <ArrowLeft className="w-4 h-4" /> Back to Income
                </button>
                <p className="text-xl font-bold text-foreground mb-6">Which category best describes your situation?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CATEGORY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setCategory(opt.id); setStep("district"); }}
                      className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: District */}
            {step === "district" && (
              <motion.div key="district" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-8">
                <button onClick={() => setStep("category")} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Categories
                </button>
                <p className="text-xl font-bold text-foreground mb-6">Which district are you in?</p>
                <div className="grid grid-cols-2 gap-3">
                  {DISTRICTS.map(d => (
                    <button
                      key={d}
                      onClick={() => determineEligibility(d)}
                      className="px-5 py-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-semibold text-foreground hover:text-primary text-center"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Result */}
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
                      {result.eligible ? "You likely qualify for free legal aid" : "You may not qualify for NALSA free aid"}
                    </h3>
                    <p className={cn("text-base font-medium leading-relaxed", result.eligible ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400")}>
                      {result.reason}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Next Steps & Contacts</h4>
                  
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-destructive border border-destructive-border shadow-md text-destructive-foreground">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">NALSA National Helpline</p>
                      <p className="font-bold text-3xl font-mono tracking-wider">15100</p>
                    </div>
                    <a href="tel:15100" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-card text-destructive font-bold hover:bg-card/90 transition shadow-sm">
                      <Phone className="w-5 h-5" /> Call Now
                    </a>
                  </div>

                  {dlsa && (
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your District Authority</p>
                        <h4 className="text-lg font-bold text-foreground">{dlsa.dlsa}</h4>
                      </div>
                      <a href={`tel:${dlsa.phone}`} className="inline-flex items-center gap-2 text-lg text-primary font-mono font-bold hover:underline">
                        <Phone className="w-5 h-5" />{dlsa.phone}
                      </a>
                      <div className="flex items-start gap-3 text-sm text-foreground/80 font-medium bg-muted/50 p-4 rounded-xl border border-border">
                        <MapPin className="w-5 h-5 flex-shrink-0 text-primary" />
                        <span className="leading-relaxed">{dlsa.address}</span>
                      </div>
                    </div>
                  )}

                  {contacts?.telangana && (
                    <a
                      href={contacts.telangana.website}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">State Authority</p>
                        <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">Telangana State Legal Services Authority (TSLSA)</p>
                      </div>
                      <ExternalLink className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  )}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Emergency Helplines</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(contacts?.other_resources ?? []).map(r => (
                      <a key={r.name} href={`tel:${r.phone}`}
                        className="flex items-center justify-between px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/50 transition shadow-sm">
                        <span className="text-sm font-semibold text-foreground">{r.name}</span>
                        <span className="font-mono font-bold text-primary">{r.phone}</span>
                      </a>
                    ))}
                  </div>
                </div>

                <Button onClick={reset} variant="outline" size="lg" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Start Over
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Google Maps — TSLSA Headquarters */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
            <div className="px-5 pt-4 pb-3 bg-card">
              <div className="flex items-center gap-2 mb-0.5">
                <MapPin className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground">TSLSA Headquarters on Google Maps</p>
              </div>
              <p className="text-xs text-muted-foreground">Telangana State Legal Services Authority · High Court Buildings, Hyderabad</p>
            </div>
            <iframe
              title="TSLSA Headquarters Location"
              src="https://maps.google.com/maps?q=Telangana+State+Legal+Services+Authority+High+Court+Nayapul+Hyderabad&output=embed"
              width="100%"
              height="240"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              aria-label="TSLSA office location on Google Maps"
            />
            <div className="px-5 py-3 bg-card border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">📍 High Court Buildings, Hyderabad 500 001</span>
              <a
                href="https://maps.google.com/maps?q=Telangana+State+Legal+Services+Authority+High+Court+Hyderabad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Get Directions
              </a>
            </div>
          </div>
        </div>

        {/* NALSA eligibility list */}
        {step !== "result" && (
           <div className="bg-card rounded-2xl border border-border shadow-sm p-8 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-foreground mb-6">
              Who Qualifies for Free Legal Aid (NALSA)?
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              {(contacts?.national?.eligibility ?? []).map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium text-foreground/80">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="leading-snug">{e}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-6 border-t border-border flex justify-center">
              <a
                href="https://nalsa.gov.in"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                <Globe className="w-4 h-4" /> Visit nalsa.gov.in for full guidelines
              </a>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}