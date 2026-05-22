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
    tagColor: "text-violet-700 border-violet-200 bg-violet-50",
    title: "Property Dispute",
    scenario:
      "Client claims ownership of disputed property in Hyderabad. Opposite party has forged sale deed. PAN and GSTIN of both parties available.",
    entities: [
      { label: "PAN",      color: "text-violet-700 bg-violet-50 border-violet-200" },
      { label: "GSTIN",    color: "text-blue-700 bg-blue-50 border-blue-200" },
      { label: "Party",    color: "text-amber-700 bg-amber-50 border-amber-200" },
      { label: "Location", color: "text-teal-700 bg-teal-50 border-teal-200" },
    ],
    chains: [
      { name: "PAN",     color: "text-violet-700 bg-violet-50 border-violet-200" },
      { name: "GSTIN",   color: "text-blue-700 bg-blue-50 border-blue-200" },
      { name: "eCourts", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    prompt:
      "Describe your property dispute with party PAN numbers, property location, and any suspected documentation issues. The Forge will verify identities, check court records, and build a civil suit strategy.",
  },
  {
    id: "accident",
    icon: Car,
    tag: "MACT",
    tagColor: "text-green-700 border-green-200 bg-green-50",
    title: "Road Accident / Motor Claim",
    scenario:
      "Client met with an accident. Need to verify vehicle RC, insurance validity, and driver licence status as of accident date for MACT claim.",
    entities: [
      { label: "Vehicle No.", color: "text-green-700 bg-green-50 border-green-200" },
      { label: "DL No.",      color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
      { label: "Party",       color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    chains: [
      { name: "VAHAN",   color: "text-green-700 bg-green-50 border-green-200" },
      { name: "SARATHI", color: "text-teal-700 bg-teal-50 border-teal-200" },
      { name: "eCourts", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    prompt:
      "Describe your road accident case with vehicle registration number, driver licence details, and accident location. The Forge will verify RC, DL, and insurance status for your MACT petition.",
  },
  {
    id: "gst",
    icon: Receipt,
    tag: "TAX / FRAUD",
    tagColor: "text-blue-700 border-blue-200 bg-blue-50",
    title: "GST Fraud / Tax Evasion",
    scenario:
      "Client accused of GST fraud by the department. Need to verify GSTIN filing history, cross-check PAN, and build defence arguments under CGST Act.",
    entities: [
      { label: "GSTIN",    color: "text-blue-700 bg-blue-50 border-blue-200" },
      { label: "PAN",      color: "text-violet-700 bg-violet-50 border-violet-200" },
      { label: "Case No.", color: "text-rose-700 bg-rose-50 border-rose-200" },
    ],
    chains: [
      { name: "GSTIN",   color: "text-blue-700 bg-blue-50 border-blue-200" },
      { name: "PAN",     color: "text-violet-700 bg-violet-50 border-violet-200" },
      { name: "eCourts", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    prompt:
      "Describe your GST dispute with GSTIN, PAN, case number, and court details. The Forge will analyse filing history, identify discrepancies, and build your defence strategy.",
  },
  {
    id: "criminal",
    icon: Shield,
    tag: "CRIMINAL",
    tagColor: "text-rose-700 border-rose-200 bg-rose-50",
    title: "Criminal Case Defence",
    scenario:
      "Client accused in a criminal case at City Civil Court Hyderabad. Need to pull full case history, orders, hearing dates, and identify procedural grounds for bail or discharge.",
    entities: [
      { label: "Case No.", color: "text-rose-700 bg-rose-50 border-rose-200" },
      { label: "Party",    color: "text-amber-700 bg-amber-50 border-amber-200" },
      { label: "Location", color: "text-teal-700 bg-teal-50 border-teal-200" },
    ],
    chains: [
      { name: "eCourts",   color: "text-amber-700 bg-amber-50 border-amber-200" },
      { name: "DigiLocker", color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
    ],
    prompt:
      "Describe your criminal case with case number, court, FIR details, IPC sections, and custody status. The Forge will pull full case history and identify bail or discharge grounds.",
  },
  {
    id: "mee-seva",
    icon: FileCheck,
    tag: "WRIT / GOVT",
    tagColor: "text-cyan-700 border-cyan-200 bg-cyan-50",
    title: "Mee Seva / Certificate Dispute",
    scenario:
      "Client's caste / income certificate rejected by government. Need to verify against state database and DigiLocker to file Writ Petition in Telangana High Court.",
    entities: [
      { label: "Aadhaar",  color: "text-orange-700 bg-orange-50 border-orange-200" },
      { label: "Party",    color: "text-amber-700 bg-amber-50 border-amber-200" },
      { label: "Location", color: "text-teal-700 bg-teal-50 border-teal-200" },
    ],
    chains: [
      { name: "MEE_SEVA_TG",  color: "text-red-700 bg-red-50 border-red-200" },
      { name: "DigiLocker",   color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
      { name: "MERIPEHCHAAN", color: "text-pink-700 bg-pink-50 border-pink-200" },
    ],
    prompt:
      "Describe your certificate dispute with Aadhaar number, certificate type, application number, and rejection reason. The Forge will verify authenticity and build grounds for your Writ Petition.",
  },
  {
    id: "watch",
    icon: Eye,
    tag: "WATCH MODE",
    tagColor: "text-fuchsia-700 border-fuchsia-200 bg-fuchsia-50",
    title: "Multi-Case Watch & Hearing Alerts",
    scenario:
      "Managing 30+ active cases across Hyderabad, Vijayawada, and Warangal courts. Set up automated monitoring so no hearing date is missed — WhatsApp alerts to client and advocate.",
    entities: [
      { label: "Case No.", color: "text-rose-700 bg-rose-50 border-rose-200" },
      { label: "Party",    color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    chains: [
      { name: "eCourts", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    prompt:
      "List your active cases with case numbers, courts, and parties. Set up Watch Mode to monitor hearing dates and order updates with WhatsApp alerts.",
  },
  {
    id: "loan",
    icon: Landmark,
    tag: "DRT / NPA",
    tagColor: "text-orange-700 border-orange-200 bg-orange-50",
    title: "Loan Recovery / NPA Case",
    scenario:
      "Bank client has a defaulting borrower. Need to verify if business is still active, check for insolvency filings, and build DRT petition strategy under SARFAESI Act.",
    entities: [
      { label: "PAN",   color: "text-violet-700 bg-violet-50 border-violet-200" },
      { label: "GSTIN", color: "text-blue-700 bg-blue-50 border-blue-200" },
      { label: "Party", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    chains: [
      { name: "GSTIN",   color: "text-blue-700 bg-blue-50 border-blue-200" },
      { name: "PAN",     color: "text-violet-700 bg-violet-50 border-violet-200" },
      { name: "eCourts", color: "text-amber-700 bg-amber-50 border-amber-200" },
    ],
    prompt:
      "Describe your loan recovery case with borrower PAN, GSTIN, outstanding amount, and last payment date. The Forge will verify business status and build your DRT petition strategy.",
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
            <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
            <Zap className="w-7 h-7 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Use Cases</h1>
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
              className="glass-panel rounded-2xl border border-gray-200 hover:border-primary/30 hover:shadow-md transition-all duration-300 group flex flex-col"
            >
              {/* Card header */}
              <div className="p-5 pb-4 border-b border-gray-100">
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
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary/60 transition-colors mt-0.5 flex-shrink-0" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 tracking-wide mb-1">{uc.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.scenario}</p>
              </div>

              {/* Card body */}
              <div className="p-5 pt-4 space-y-3 flex-1">
                <div>
                  <p className="text-[9px] font-mono text-gray-400 uppercase tracking-[0.18em] mb-2">Entities Extracted</p>
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

                <div>
                  <p className="text-[9px] font-mono text-gray-400 uppercase tracking-[0.18em] mb-2">API Chains Triggered</p>
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
