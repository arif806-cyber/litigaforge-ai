import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Send, FileText, MapPin, Coins, EyeOff,
  Briefcase, Scale, Home, Users, Heart, Truck, Landmark, Shield,
  ChevronRight, Check
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCountry } from "@/hooks/useCountry";
import { POST_CASE_COPY } from "@/lib/country-copy";
import { ClarifyDialog } from "@/components/ClarifyDialog";

const CASE_TYPES = [
  { id: "Property Dispute", label: "Property & Real Estate", icon: Home },
  { id: "Family Matter", label: "Family & Matrimonial", icon: Heart },
  { id: "Criminal", label: "Criminal Defence", icon: Shield },
  { id: "Civil", label: "Civil Litigation", icon: Scale },
  { id: "Corporate", label: "Corporate & Business", icon: Briefcase },
  { id: "Labour", label: "Labour & Employment", icon: Users },
  { id: "Consumer", label: "Consumer Rights", icon: Landmark },
  { id: "Motor", label: "Motor Accident", icon: Truck },
  { id: "Tax", label: "Tax & GST", icon: Coins },
];

const BUDGET_RANGES = [
  { label: "Under Rs. 5,000",        budget_min: 0,      budget_max: 5000   },
  { label: "Rs. 5,000 – 15,000",     budget_min: 5000,   budget_max: 15000  },
  { label: "Rs. 15,000 – 50,000",    budget_min: 15000,  budget_max: 50000  },
  { label: "Rs. 50,000 – 1,00,000",  budget_min: 50000,  budget_max: 100000 },
  { label: "Above Rs. 1,00,000",     budget_min: 100000, budget_max: 0      },
  { label: "Flexible / Discuss",     budget_min: 0,      budget_max: 0      },
];

export default function PostCase() {
  const { user } = useAuth();
  const { activeCode } = useCountry();
  const copy = POST_CASE_COPY[activeCode.toUpperCase()] ?? POST_CASE_COPY.IN;
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState("");
  const [description, setDescription] = useState("");
  const [locationVal, setLocationVal] = useState("");
  const [budgetIdx, setBudgetIdx] = useState<number | "">("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [clarifyOpen, setClarifyOpen] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Please enter a case title.";
    else if (title.trim().length < 5) errs.title = "Title must be at least 5 characters.";
    if (!caseType) errs.caseType = "Please select a case type.";
    if (description.length > 2000) errs.description = "Description must not exceed 2,000 characters.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setClarifyOpen(true);
  };

  const runSubmit = async (extraDetails: string) => {
    setClarifyOpen(false);
    setSubmitting(true);
    setError("");
    try {
      const budgetItem = budgetIdx !== "" ? BUDGET_RANGES[budgetIdx] : null;
      const finalDescription = extraDetails
        ? `${description}\n\n${extraDetails}`.trim()
        : description;
      await apiFetch("/cases/requirements", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          case_type: caseType,
          description: finalDescription,
          location: locationVal,
          budget_range: budgetItem?.label ?? "",
          budget_min: budgetItem?.budget_min ?? 0,
          budget_max: budgetItem?.budget_max ?? 0,
          is_anonymous: isAnonymous,
        }),
      });
      setLocation("/my-cases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (<>
      <SEOHelmet title="Post a Case" description="Post your legal case requirements." canonical="/post-case" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => setLocation("/login")}>Sign In</Button>
        </div>
      </div>
    </>);
  }

  return (
    <PageShell title={copy.pageTitle} subtitle={copy.pageSubtitle}>
      <SEOHelmet title="Post a Case" description="Post your legal case requirements." canonical="/post-case" />

      <div className="bg-card rounded-2xl shadow-sm p-6 space-y-6" style={{ border: "1px solid #F1F5F9" }}>
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Case Title <span className="text-red-500">*</span></label>
          <input value={title} onChange={(e) => { setTitle(e.target.value); if (fieldErrors.title) setFieldErrors(p => ({ ...p, title: "" })); }}
            placeholder="e.g., Property dispute with neighbour in Banjara Hills"
            className={cn("w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2",
              fieldErrors.title ? "border-red-300 focus:ring-red-200" : "border-border focus:ring-blue-200")} />
          {fieldErrors.title && <p className="text-xs text-red-500">{fieldErrors.title}</p>}
        </div>

        {/* Case Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Case Type <span className="text-red-500">*</span></label>
          <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-2", fieldErrors.caseType ? "border border-red-300 rounded-lg p-1 bg-red-50/30" : "")}>
            {CASE_TYPES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setCaseType(id); if (fieldErrors.caseType) setFieldErrors(p => ({ ...p, caseType: "" })); }}
                className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                  caseType === id ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-border hover:border-gray-300 text-gray-600")}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{label}</span>
                {caseType === id && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
          {fieldErrors.caseType && <p className="text-xs text-red-500">{fieldErrors.caseType}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea value={description} onChange={(e) => { setDescription(e.target.value); if (fieldErrors.description) setFieldErrors(p => ({ ...p, description: "" })); }}
            placeholder="Describe the situation in detail. Include relevant dates, parties involved, and what outcome you seek."
            rows={5} className={cn("w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none",
              fieldErrors.description ? "border-red-300 focus:ring-red-200" : "border-border focus:ring-blue-200")} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Be specific. Lawyers need details to assess your case.</p>
            <p className={cn("text-xs tabular-nums", description.length > 2000 ? "text-red-500 font-semibold" : "text-gray-400")}>{description.length} / 2,000</p>
          </div>
          {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
        </div>

        {/* Location + Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</label>
            <input value={locationVal} onChange={(e) => setLocationVal(e.target.value)}
              placeholder="e.g., Hyderabad, Telangana"
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Budget Range</label>
            <select value={budgetIdx} onChange={(e) => setBudgetIdx(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-card">
              <option value="">Select budget...</option>
              {BUDGET_RANGES.map((b, i) => <option key={b.label} value={i}>{b.label}</option>)}
            </select>
          </div>
        </div>

        {/* Anonymous */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border" style={{ background: "#F8FAFC", borderColor: "#F1F5F9" }}>
          <button onClick={() => setIsAnonymous(!isAnonymous)}
            className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors",
              isAnonymous ? "bg-primary border-primary" : "border-border bg-card")}>
            {isAnonymous && <Check className="w-3 h-3 text-white" />}
          </button>
          <div>
            <p className="text-sm font-medium">Post Anonymously</p>
            <p className="text-xs text-gray-400">Your name will be hidden until you accept a lawyer's proposal.</p>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "Posting..." : "Post Requirement"}
        </Button>
      </div>

      <ClarifyDialog
        open={clarifyOpen}
        surface="case"
        baseText={description || title}
        country={activeCode}
        onProceed={runSubmit}
        onClose={() => setClarifyOpen(false)}
        proceedLabel="Post Requirement"
        title="Help lawyers understand your case"
      />
    </PageShell>
  );
}
