import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home, Car, Receipt, Shield, FileCheck, Eye, Landmark,
  ArrowRight, Zap, ChevronRight, Lightbulb
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";

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
    tagColor: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    title: "Property Dispute",
    scenario:
      "Client claims ownership of disputed property in Hyderabad. Opposite party has forged sale deed. PAN and GSTIN of both parties available.",
    entities: [
      { label: "PAN",      color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { label: "GSTIN",    color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { label: "Party",    color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
      { label: "Location", color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800" },
    ],
    chains: [
      { name: "PAN",     color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { name: "GSTIN",   color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { name: "eCourts", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    ],
    prompt:
      "Describe your property dispute with party PAN numbers, property location, and any suspected documentation issues. The Forge will verify identities, check court records, and build a civil suit strategy.",
  },
  {
    id: "accident",
    icon: Car,
    tag: "MACT",
    tagColor: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
    title: "Road Accident / Motor Claim",
    scenario:
      "Client met with an accident. Need to verify vehicle RC, insurance validity, and driver licence status as of accident date for MACT claim.",
    entities: [
      { label: "Vehicle No.", color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800" },
      { label: "DL No.",      color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
      { label: "Party",       color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    ],
    chains: [
      { name: "VAHAN",   color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800" },
      { name: "SARATHI", color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800" },
      { name: "eCourts", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    ],
    prompt:
      "Describe your road accident case with vehicle registration number, driver licence details, and accident location. The Forge will verify RC, DL, and insurance status for your MACT petition.",
  },
  {
    id: "gst",
    icon: Receipt,
    tag: "TAX / FRAUD",
    tagColor: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    title: "GST Fraud / Tax Evasion",
    scenario:
      "Client accused of GST fraud by the department. Need to verify GSTIN filing history, cross-check PAN, and build defence arguments under CGST Act.",
    entities: [
      { label: "GSTIN",    color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { label: "PAN",      color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { label: "Case No.", color: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
    ],
    chains: [
      { name: "GSTIN",   color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { name: "PAN",     color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { name: "eCourts", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    ],
    prompt:
      "Describe your GST dispute with GSTIN, PAN, case number, and court details. The Forge will analyse filing history, identify discrepancies, and build your defence strategy.",
  },
  {
    id: "criminal",
    icon: Shield,
    tag: "CRIMINAL",
    tagColor: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    title: "Criminal Case Defence",
    scenario:
      "Client accused in a criminal case at City Civil Court Hyderabad. Need to pull full case history, orders, hearing dates, and identify procedural grounds for bail or discharge.",
    entities: [
      { label: "Case No.", color: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
      { label: "Party",    color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
      { label: "Location", color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800" },
    ],
    chains: [
      { name: "eCourts",   color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
      { name: "DigiLocker", color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800" },
    ],
    prompt:
      "Describe your criminal case with case number, court, FIR details, IPC sections, and custody status. The Forge will pull full case history and identify bail or discharge grounds.",
  },
  {
    id: "mee-seva",
    icon: FileCheck,
    tag: "WRIT / GOVT",
    tagColor: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    title: "Mee Seva / Certificate Dispute",
    scenario:
      "Client's caste / income certificate rejected by government. Need to verify against state database and DigiLocker to file Writ Petition in Telangana High Court.",
    entities: [
      { label: "Aadhaar",  color: "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800" },
      { label: "Party",    color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
      { label: "Location", color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800" },
    ],
    chains: [
      { name: "MEE_SEVA_TG",  color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800" },
      { name: "DigiLocker",   color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800" },
      { name: "MERIPEHCHAAN", color: "text-pink-700 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800" },
    ],
    prompt:
      "Describe your certificate dispute with Aadhaar number, certificate type, application number, and rejection reason. The Forge will verify authenticity and build grounds for your Writ Petition.",
  },
  {
    id: "loan",
    icon: Landmark,
    tag: "DRT / NPA",
    tagColor: "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    title: "Loan Recovery / NPA Case",
    scenario:
      "Bank client has a defaulting borrower. Need to verify if business is still active, check for insolvency filings, and build DRT petition strategy under SARFAESI Act.",
    entities: [
      { label: "PAN",   color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { label: "GSTIN", color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { label: "Party", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    ],
    chains: [
      { name: "GSTIN",   color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
      { name: "PAN",     color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
      { name: "eCourts", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
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

  return (<>
      <SEOHelmet title="Use Cases" description="Interactive scenario cards for real-world legal situations." canonical="/use-cases" />
    <PageShell title="Scenario Library" subtitle="Real-world scenarios for Telangana & AP advocates. Select a template to run live analysis instantly." icon={<Lightbulb className="w-6 h-6 text-primary" />}>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {USE_CASES.map((uc) => {
          const Icon = uc.icon;
          return (
            <motion.div
              key={uc.id}
              variants={item}
              className="bg-card rounded-2xl border border-border hover:border-primary/50 hover:shadow-md transition-all duration-300 group flex flex-col"
            >
              <div className="p-6 pb-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={cn("text-[10px] font-bold tracking-widest px-2.5 py-1 rounded border", uc.tagColor)}>
                        {uc.tag}
                      </span>
                    </div>
                  </div>
                </div>
                <h2 className="text-lg font-bold text-foreground tracking-tight mb-2">{uc.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.scenario}</p>
              </div>

              <div className="p-6 space-y-5 flex-1 bg-muted/20">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Expected Entities</p>
                  <div className="flex flex-wrap gap-2">
                    {uc.entities.map((e) => (
                      <span
                        key={e.label}
                        className={cn("text-xs font-medium px-2.5 py-1 rounded-md border", e.color)}
                      >
                        {e.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">API Chains</p>
                  <div className="flex flex-wrap gap-2">
                    {uc.chains.map((c) => (
                      <span
                        key={c.name}
                        className={cn("text-xs font-medium px-2.5 py-1 rounded-md border", c.color)}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border/50 bg-card rounded-b-2xl">
                <button
                  onClick={() => handleTry(uc.prompt)}
                  data-testid={`try-usecase-${uc.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold tracking-wide hover:bg-primary/90 transition-all shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  Try in The Forge
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </PageShell>
  </>);
}