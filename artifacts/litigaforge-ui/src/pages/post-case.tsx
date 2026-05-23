import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Send, FileText, MapPin, Coins, EyeOff, ChevronDown,
  Briefcase, Scale, Home, Users, Heart, Truck, Landmark, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const CASE_TYPES = [
  { id: "property", label: "Property & Real Estate", icon: Home },
  { id: "family", label: "Family & Matrimonial", icon: Heart },
  { id: "criminal", label: "Criminal Defence", icon: Shield },
  { id: "civil", label: "Civil Litigation", icon: Scale },
  { id: "corporate", label: "Corporate & Business", icon: Briefcase },
  { id: "labour", label: "Labour & Employment", icon: Users },
  { id: "consumer", label: "Consumer Rights", icon: Landmark },
  { id: "motor", label: "Motor Accident", icon: Truck },
  { id: "tax", label: "Tax & GST", icon: Coins },
];

const BUDGET_RANGES = [
  "Under Rs. 5,000",
  "Rs. 5,000 - 15,000",
  "Rs. 15,000 - 50,000",
  "Rs. 50,000 - 1,00,000",
  "Above Rs. 1,00,000",
  "Flexible / Discuss",
];

export default function PostCase() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState("");
  const [description, setDescription] = useState("");
  const [locationVal, setLocationVal] = useState("");
  const [budget, setBudget] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !caseType) {
      setError("Please enter a title and select a case type.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/cases/requirements", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          case_type: caseType,
          description,
          location: locationVal,
          budget_range: budget,
          is_anonymous: isAnonymous,
        }),
      });
      if (!res.ok) throw new Error("Failed to post case");
      setLocation("/my-cases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <p className="text-muted-foreground">Please sign in to post your legal requirements.</p>
          <Button onClick={() => setLocation("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Post a Legal Requirement</h1>
        <p className="text-muted-foreground mt-1">
          Describe your legal need. Verified lawyers will review and reach out.
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 space-y-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Case Title <span className="text-destructive">*</span></label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Property dispute with neighbour in Banjara Hills"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="case-title-input"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Case Type <span className="text-destructive">*</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CASE_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCaseType(id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all",
                  caseType === id
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-muted-foreground/30"
                )}
                data-testid={`case-type-${id}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the situation in detail. Include relevant dates, parties involved, and what outcome you seek."
            rows={5}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            data-testid="case-description-input"
          />
          <p className="text-xs text-muted-foreground">Be specific. Lawyers need details to assess your case.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <input
              value={locationVal}
              onChange={(e) => setLocationVal(e.target.value)}
              placeholder="e.g., Hyderabad, Telangana"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" /> Budget Range
            </label>
            <div className="relative">
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select budget...</option>
                {BUDGET_RANGES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30">
          <button
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-colors",
              isAnonymous
                ? "bg-primary border-primary"
                : "border-input bg-background"
            )}
          >
            {isAnonymous && <EyeOff className="w-3 h-3 text-primary-foreground" />}
          </button>
          <div>
            <p className="text-sm font-medium">Post Anonymously</p>
            <p className="text-xs text-muted-foreground">Your name will be hidden until you accept a lawyer's proposal.</p>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
          data-testid="post-case-submit"
        >
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "Posting..." : "Post Requirement"}
        </Button>
      </div>
    </motion.div>
  );
}
