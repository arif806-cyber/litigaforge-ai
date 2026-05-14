import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home, Car, Receipt, Shield, FileCheck, Eye, Landmark,
  ArrowRight, Zap, ChevronRight,
} from "lucide-react";

interface UseCase {
  id: string;
  icon: React.ElementType;
  tag: string;
  tagColor: string;
  title: string;
  scenario: string;
  entities: { label: string; color: string }[];
  chains: { name: string; color: string }[];
  prompt: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "property",
    icon: Home,
    tag: "CIVIL",
    tagColor: "text-violet-400 border-violet-500/30 bg-violet-500/10",
    title: "Property Dispute",
    scenario:
      "Client claims ownership of disputed property in Hyderabad. Opposite party has forged sale deed. PAN and GSTIN of both parties available.",
    entities: [
      { label: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { label: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
      { label: "Location", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" },
    ],
    chains: [
      { name: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { name: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    prompt:
      "My client Ramesh Kumar with PAN ABCDE1234F has a property dispute in Hyderabad against Suresh Reddy (PAN XYZAB5678G). The property at Plot No. 45, Banjara Hills is in contention. Opposite party has a GSTIN 36ABCDE1234F1Z5. Suspected forged sale deed dated 2019. Need to verify both PANs, check for any existing court cases, and build a civil suit strategy.",
  },
  {
    id: "accident",
    icon: Car,
    tag: "MACT",
    tagColor: "text-green-400 border-green-500/30 bg-green-500/10",
    title: "Road Accident / Motor Claim",
    scenario:
      "Client met with an accident. Need to verify vehicle RC, insurance validity, and driver licence status as of accident date for MACT claim.",
    entities: [
      { label: "Vehicle No.", color: "text-green-400 bg-green-500/10 border-green-500/30" },
      { label: "DL No.", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    chains: [
      { name: "VAHAN", color: "text-green-400 bg-green-500/10 border-green-500/30" },
      { name: "SARATHI", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" },
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    prompt:
      "Client Lakshmi Devi was involved in a road accident on NH-65 near Vijayawada on 15-March-2024. The offending vehicle bearing registration TS09EA1234 was driven by one Kiran Kumar holding DL No. TS0920230001234. Need to verify RC details, insurance status, fitness certificate, driver licence validity, and vehicle class authorisation for filing a Motor Accident Claims Tribunal (MACT) petition.",
  },
  {
    id: "gst",
    icon: Receipt,
    tag: "TAX / FRAUD",
    tagColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    title: "GST Fraud / Tax Evasion",
    scenario:
      "Client accused of GST fraud by the department. Need to verify GSTIN filing history, cross-check PAN, and build defence arguments under CGST Act.",
    entities: [
      { label: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { label: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { label: "Case No.", color: "text-rose-400 bg-red-500/10 border-red-500/30" },
    ],
    chains: [
      { name: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { name: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    prompt:
      "My client M/s Sri Lakshmi Enterprises has been issued a show-cause notice by GST department under Section 74 CGST Act for alleged fraudulent ITC claims. GSTIN: 36AABCL9603R1ZM, PAN: AABCL9603R. Case filed at City Civil Court Hyderabad — Case No. CC 2345/2024. Need full filing history analysis, ITC reconciliation discrepancies, and defence strategy.",
  },
  {
    id: "criminal",
    icon: Shield,
    tag: "CRIMINAL",
    tagColor: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    title: "Criminal Case Defence",
    scenario:
      "Client accused in a criminal case at City Civil Court Hyderabad. Need to pull full case history, orders, hearing dates, and identify procedural grounds for bail or discharge.",
    entities: [
      { label: "Case No.", color: "text-rose-400 bg-red-500/10 border-red-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
      { label: "Location", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" },
    ],
    chains: [
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
      { name: "DigiLocker", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
    ],
    prompt:
      "My client Venkat Rao is the accused in Case No. CC 1234/2024 at City Civil Court Hyderabad under IPC Sections 420 and 120B. FIR No. 456/2024 at Banjara Hills Police Station. Client has been in judicial custody for 45 days. Need full case history, orders passed, identify procedural delays for anticipatory bail / regular bail application, and any grounds for discharge petition.",
  },
  {
    id: "mee-seva",
    icon: FileCheck,
    tag: "WRIT / GOVT",
    tagColor: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    title: "Mee Seva / Certificate Dispute",
    scenario:
      "Client's caste / income certificate rejected by government. Need to verify against state database and DigiLocker to file Writ Petition in Telangana High Court.",
    entities: [
      { label: "Aadhaar", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
      { label: "Location", color: "text-teal-400 bg-teal-500/10 border-teal-500/30" },
    ],
    chains: [
      { name: "MEE_SEVA_TG", color: "text-red-400 bg-red-500/10 border-red-500/30" },
      { name: "DigiLocker", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
      { name: "MERIPEHCHAAN", color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
    ],
    prompt:
      "My client Padmavathi (Aadhaar: 1234-5678-9012) from Warangal belongs to BC-A category. Her caste certificate (Application No. MEE1234567) issued by Mee Seva Telangana has been rejected by the State Government for EAMCET fee reimbursement. The certificate exists in DigiLocker. Need to verify the certificate authenticity against Mee Seva database and build grounds for Writ Petition in Telangana High Court under Article 226.",
  },
  {
    id: "watch",
    icon: Eye,
    tag: "WATCH MODE",
    tagColor: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
    title: "Multi-Case Watch & Hearing Alerts",
    scenario:
      "Managing 30+ active cases across Hyderabad, Vijayawada, and Warangal courts. Set up automated monitoring so no hearing date is missed — WhatsApp alerts to client and advocate.",
    entities: [
      { label: "Case No.", color: "text-rose-400 bg-red-500/10 border-red-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    chains: [
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    prompt:
      "I need to set up Watch Mode for the following active cases: Case No. OS 234/2024 at Hyderabad City Civil Court (party: Narayana Rao vs State Bank), Case No. CC 890/2024 at Vijayawada District Court (party: Meena Kumari vs Union of India), and Case No. CS 45/2024 at Warangal Sessions Court (party: Ravi Shankar). Monitor all three for next hearing dates and order updates. Send WhatsApp alerts to advocate at +919876543210.",
  },
  {
    id: "loan",
    icon: Landmark,
    tag: "DRT / NPA",
    tagColor: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    title: "Loan Recovery / NPA Case",
    scenario:
      "Bank client has a defaulting borrower. Need to verify if business is still active, check for insolvency filings, and build DRT petition strategy under SARFAESI Act.",
    entities: [
      { label: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { label: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { label: "Party", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    chains: [
      { name: "GSTIN", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
      { name: "PAN", color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
      { name: "eCourts", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    ],
    prompt:
      "My client State Bank of Hyderabad has a Non-Performing Asset (NPA) against M/s Vijaya Constructions. Borrower details — PAN: AABCV1234F, GSTIN: 36AABCV1234F1Z5, outstanding loan: Rs. 2.35 Crore. Last payment: January 2023. Need to verify if the business is active, check for any insolvency or winding-up petitions already filed, identify assets, and draft DRT petition strategy under SARFAESI Act Sections 13(2) and 13(4).",
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function UseCases() {
  const [, setLocation] = useLocation();

  function handleTry(prompt: string) {
    sessionStorage.setItem("forge_prefill", prompt);
    setLocation("/");
  }

  return (
    <div className="px-4 py-7 md:px-10 md:py-8 pb-20 md:pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/40 blur-lg rounded-full" />
            <Zap className="w-7 h-7 text-primary relative z-10 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Use Cases</h1>
        </div>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl mb-8">
          Real scenarios for Telangana &amp; AP advocates. Click <span className="text-primary font-semibold">Try in Forge</span> to load the case facts and run a live analysis instantly.
        </p>
      </motion.div>

      {/* Cards grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {USE_CASES.map((uc) => {
          const Icon = uc.icon;
          return (
            <motion.div
              key={uc.id}
              variants={item}
              className="glass-panel rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:border-primary/20 hover:bg-white/[0.04] transition-all duration-300 group flex flex-col"
            >
              {/* Card header */}
              <div className="p-5 pb-4 border-b border-white/[0.05]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/15 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className={cn("text-[9px] font-mono font-bold tracking-[0.18em] px-2 py-0.5 rounded border", uc.tagColor)}>
                        {uc.tag}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary/60 transition-colors mt-0.5 flex-shrink-0" />
                </div>
                <h2 className="text-base font-semibold text-white tracking-wide mb-1">{uc.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.scenario}</p>
              </div>

              {/* Card body */}
              <div className="p-5 pt-4 space-y-3 flex-1">
                {/* Entities */}
                <div>
                  <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.18em] mb-2">Entities Extracted</p>
                  <div className="flex flex-wrap gap-1.5">
                    {uc.entities.map((e) => (
                      <span
                        key={e.label}
                        className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded border tracking-wide", e.color)}
                      >
                        {e.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Chains */}
                <div>
                  <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.18em] mb-2">API Chains Triggered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {uc.chains.map((c) => (
                      <span
                        key={c.name}
                        className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded border tracking-wide", c.color)}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => handleTry(uc.prompt)}
                  data-testid={`try-usecase-${uc.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase hover:bg-primary/20 hover:border-primary/40 active:scale-[0.98] transition-all duration-200"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Try in Forge
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
