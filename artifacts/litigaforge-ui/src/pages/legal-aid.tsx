import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Heart, Phone, Globe, MapPin, ChevronRight, CheckCircle2, XCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <Heart className="w-6 h-6 text-green-600" />
          Free Legal Aid
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Check if you qualify for free legal aid under NALSA and find your nearest Telangana DLSA office.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-2xl space-y-6 pb-20">

          {/* Eligibility wizard */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-green-50 border-b border-green-100">
              <p className="text-xs font-mono uppercase tracking-widest text-green-700 font-bold">
                Eligibility Check — NALSA / TSLSA
              </p>
            </div>

            <AnimatePresence mode="wait">

              {/* Step 1: Income */}
              {step === "income" && (
                <motion.div key="income" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-6 py-6">
                  <p className="text-sm font-semibold text-gray-800 mb-5">What is your approximate annual household income?</p>
                  <div className="space-y-3">
                    {INCOME_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setIncome(opt.id); setStep("category"); }}
                        className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                      >
                        <span className="text-sm text-gray-800 group-hover:text-primary transition-colors">{opt.label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Category */}
              {step === "category" && (
                <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-6 py-6">
                  <button onClick={() => setStep("income")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 mb-5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <p className="text-sm font-semibold text-gray-800 mb-5">Which category best describes your situation?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CATEGORY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setCategory(opt.id); setStep("district"); }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <span className="text-sm text-gray-800 group-hover:text-primary transition-colors leading-snug">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: District */}
              {step === "district" && (
                <motion.div key="district" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-6 py-6">
                  <button onClick={() => setStep("category")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 mb-5 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <p className="text-sm font-semibold text-gray-800 mb-5">Which district are you in?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DISTRICTS.map(d => (
                      <button
                        key={d}
                        onClick={() => determineEligibility(d)}
                        className="px-4 py-3 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm text-gray-800 hover:text-primary text-left"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Result */}
              {step === "result" && result && (
                <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="px-6 py-6 space-y-5">
                  <div className={cn(
                    "flex items-start gap-4 p-5 rounded-xl border",
                    result.eligible
                      ? "bg-green-50 border-green-200"
                      : "bg-amber-50 border-amber-200"
                  )}>
                    {result.eligible
                      ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className={cn("font-bold text-sm mb-1", result.eligible ? "text-green-800" : "text-amber-800")}>
                        {result.eligible ? "You likely qualify for free legal aid" : "You may not qualify for NALSA free aid"}
                      </p>
                      <p className={cn("text-sm", result.eligible ? "text-green-700" : "text-amber-700")}>
                        {result.reason}
                      </p>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-5 py-4 rounded-xl bg-red-50 border border-red-200">
                      <div>
                        <p className="text-xs font-mono uppercase tracking-widest text-red-500 mb-0.5">NALSA Helpline</p>
                        <p className="font-bold text-red-700 text-lg font-mono">15100</p>
                      </div>
                      <a href="tel:15100" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition">
                        <Phone className="w-4 h-4" /> Call
                      </a>
                    </div>

                    {dlsa && (
                      <div className="px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                        <p className="text-xs font-mono uppercase tracking-widest text-gray-400">{dlsa.dlsa}</p>
                        <a href={`tel:${dlsa.phone}`} className="flex items-center gap-2 text-sm text-primary font-mono hover:underline">
                          <Phone className="w-3.5 h-3.5" />{dlsa.phone}
                        </a>
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{dlsa.address}
                        </div>
                      </div>
                    )}

                    {contacts?.telangana && (
                      <a
                        href={contacts.telangana.website}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                      >
                        <div>
                          <p className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-0.5">TSLSA Website</p>
                          <p className="text-sm text-gray-800 font-medium group-hover:text-primary transition-colors">tslsa.telangana.gov.in</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                      </a>
                    )}
                  </div>

                  {/* Other helplines */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-3">Emergency Helplines</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(contacts?.other_resources ?? []).map(r => (
                        <a key={r.name} href={`tel:${r.phone}`}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-primary/30 transition text-sm">
                          <span className="text-gray-700 text-xs leading-snug">{r.name}</span>
                          <span className="font-mono font-bold text-primary">{r.phone}</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                    <ArrowLeft className="w-4 h-4" /> Start Over
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress dots */}
            {step !== "result" && (
              <div className="flex justify-center gap-2 pb-5">
                {(["income", "category", "district"] as WizardStep[]).map(s => (
                  <div key={s} className={cn("w-2 h-2 rounded-full transition-all",
                    s === step ? "bg-primary w-5" : "bg-gray-300"
                  )} />
                ))}
              </div>
            )}
          </div>

          {/* NALSA eligibility list */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-4">
              Who Qualifies for Free Legal Aid (NALSA)
            </p>
            <ul className="space-y-2.5">
              {(contacts?.national?.eligibility ?? []).map((e, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {e}
                </li>
              ))}
            </ul>
            <a
              href="https://nalsa.gov.in"
              target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-xs text-primary font-mono hover:underline"
            >
              <Globe className="w-3.5 h-3.5" /> Visit nalsa.gov.in for more information
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
