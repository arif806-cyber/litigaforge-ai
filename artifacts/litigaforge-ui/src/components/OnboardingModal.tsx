import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hammer, FileText, Search, Sparkles, Briefcase, X, ChevronRight, ChevronLeft, ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";

interface OnboardingModalProps {
  role: "client" | "lawyer";
  onComplete: () => void;
  redirectTo?: string;
}

const CLIENT_STEPS = [
  {
    title: "Welcome to LitigaForge",
    subtitle: "Your AI-powered legal companion",
    description: "LitigaForge connects you with verified lawyers and gives you powerful AI tools to understand, prepare, and manage your legal matters.",
    icon: Sparkles,
    color: "bg-amber-100 text-amber-700",
    iconBg: "bg-amber-50",
  },
  {
    title: "AI Legal Chat",
    subtitle: "AI Legal Strategy Engine",
    description: "Describe your situation in plain language. Our AI synthesises a step-by-step legal roadmap — statutes, arguments, and court procedures — tailored to your jurisdiction.",
    icon: Hammer,
    color: "bg-blue-100 text-blue-700",
    iconBg: "bg-blue-50",
  },
  {
    title: "Post a Case & Match",
    subtitle: "Find the right lawyer",
    description: "Post your legal requirement anonymously if you prefer. Our AI scores and matches you with verified advocates. Review proposals, chat, and hire with confidence.",
    icon: Briefcase,
    color: "bg-emerald-100 text-emerald-700",
    iconBg: "bg-emerald-50",
  },
];

const LAWYER_STEPS = [
  {
    title: "Welcome to LitigaForge",
    subtitle: "Your AI-powered legal practice",
    description: "LitigaForge gives you smart tools to manage cases, analyze documents, track court hearings, and find new clients — all powered by AI.",
    icon: Sparkles,
    color: "bg-amber-100 text-amber-700",
    iconBg: "bg-amber-50",
  },
  {
    title: "Document Analyzer",
    subtitle: "AI-powered contract review",
    description: "Upload contracts, petitions, or FIRs. Our AI flags risks, highlights missing clauses, and gives actionable recommendations in seconds.",
    icon: FileText,
    color: "bg-violet-100 text-violet-700",
    iconBg: "bg-violet-50",
  },
  {
    title: "CNR Tracking & Case Management",
    subtitle: "Stay on top of every case",
    description: "Track cases via CNR number, manage documents, set hearing reminders, and keep clients updated — all from one dashboard.",
    icon: Search,
    color: "bg-blue-100 text-blue-700",
    iconBg: "bg-blue-50",
  },
];

export default function OnboardingModal({ role, onComplete, redirectTo }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();

  const steps = role === "client" ? CLIENT_STEPS : LAWYER_STEPS;
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const dest = redirectTo ?? (role === "lawyer" ? "/lawyer-dashboard" : "/client-dashboard");

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("lf_onboarded", "1");
      onComplete();
      setLocation(dest);
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("lf_onboarded", "1");
    onComplete();
    setLocation(dest);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border"
      >
        {/* Header image / gradient */}
        <div className="relative h-40 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <motion.div
            key={step}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`w-16 h-16 rounded-2xl ${current.iconBg} flex items-center justify-center shadow-lg relative z-10`}
          >
            <Icon className={`w-8 h-8 ${current.color.split(" ")[1]}`} />
          </motion.div>
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Step dots */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 text-center"
            >
              <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold ${current.color}`}>
                {current.subtitle}
              </span>
              <h3 className="text-xl font-bold text-foreground">{current.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Role badge */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
              role === "lawyer"
                ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {role === "lawyer" ? "Advocate Portal" : "Client Portal"}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 h-11 rounded-xl border border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 h-11 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
            >
              {isLast ? (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <button
            onClick={handleSkip}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip onboarding
          </button>
        </div>
      </motion.div>
    </div>
  );
}
