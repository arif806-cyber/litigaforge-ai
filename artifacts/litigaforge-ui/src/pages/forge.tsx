import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Scale, Loader2, ChevronRight, AlertTriangle, Zap, CheckCircle2,
  FileText, Gavel, BookOpen, ShieldAlert, ClipboardList, Calendar,
  BarChart3, Scale as ScaleIcon, Wand2, Swords, BookMarked, Sparkles,
  Download, ChevronDown, ChevronUp, RotateCcw, History,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ForgeResult {
  status: string;
  case_id: string;
  chains_executed: string[];
  chain_map: { chain: string; status: string }[];
  entities_found: Record<string, string>;
  api_results: Record<string, unknown>;
  meta_suggestions: string[];
  final_output: string;
}

interface RefinedSection {
  text: string;
  instruction: string;
  timestamp: string;
}

type RefineInstruction = "refine" | "aggressive" | "provisions" | "simplify";

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  pan:            { label: "PAN",       color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300" },
  gstin:          { label: "GSTIN",     color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" },
  vehicle_number: { label: "Vehicle",   color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300" },
  dl_number:      { label: "DL",        color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300" },
  ifsc_code:      { label: "IFSC",      color: "text-sky-700 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300" },
  pincode:        { label: "Pincode",   color: "text-pink-700 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300" },
  cin:            { label: "CIN",       color: "text-slate-700 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-300" },
  aadhaar:        { label: "Aadhaar",   color: "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300" },
  party_name:     { label: "Party",     color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
  party_role:     { label: "Role",      color: "text-lime-700 bg-lime-100 dark:bg-lime-900/30 dark:text-lime-300" },
  opponent_name:  { label: "Opponent",  color: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300" },
  opponent_role:  { label: "Opp. Role", color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300" },
  case_number:    { label: "Case No.",  color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cnr_number:     { label: "CNR",       color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300" },
  court_name:     { label: "Court",     color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300" },
  case_type:      { label: "Type",      color: "text-fuchsia-700 bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  legal_domain:   { label: "Domain",    color: "text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300" },
  relief_sought:  { label: "Relief",    color: "text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300" },
  procedural_stage:{ label: "Stage",  color: "text-gray-700 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300" },
  amount_in_dispute:{ label: "Amount", color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300" },
  state_code:     { label: "State",     color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300" },
  location:       { label: "Location",  color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300" },
  company_name:   { label: "Company",   color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" },
  stock_symbol:   { label: "Symbol",    color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300" },
  intent:         { label: "Intent",    color: "text-gray-700 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300" },
  primary_query:  { label: "Query",     color: "text-gray-700 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300" },
  currency:       { label: "Currency",  color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
};

const EXAMPLE_PROMPTS = [
  { text: "Property dispute case — enter party PAN numbers, GSTIN, property location, and any suspected forged documents.", hotkey: "1" },
  { text: "Road accident / MACT case — enter vehicle registration, driver licence number, accident location, and date.", hotkey: "2" },
  { text: "GST dispute case — enter GSTIN, PAN, case number, court details, and department notice sections.", hotkey: "3" },
];

const SECTION_META: Record<string, { title: string; icon: React.ReactNode; color: string; border: string }> = {
  "case summary":            { title: "Case Summary",            icon: <FileText className="w-4 h-4"/>,    color: "text-blue-700",  border: "border-l-4 border-blue-500" },
  "key legal issues":        { title: "Key Legal Issues",        icon: <ScaleIcon className="w-4 h-4"/>,   color: "text-rose-700",  border: "border-l-4 border-rose-500" },
  "applicable laws":         { title: "Applicable Laws & Provisions", icon: <BookOpen className="w-4 h-4"/>,   color: "text-amber-700", border: "border-l-4 border-amber-500" },
  "relevant case law":       { title: "Relevant Case Law",       icon: <Gavel className="w-4 h-4"/>,      color: "text-purple-700",border: "border-l-4 border-purple-500" },
  "government data":         { title: "Government Data Findings",icon: <BarChart3 className="w-4 h-4"/>,  color: "text-green-700", border: "border-l-4 border-green-500" },
  "recommended legal strategy": { title: "Recommended Legal Strategy", icon: <ShieldAlert className="w-4 h-4"/>, color: "text-indigo-700",border: "border-l-4 border-indigo-500" },
  "documents required":      { title: "Documents Required",      icon: <ClipboardList className="w-4 h-4"/>, color: "text-teal-700",  border: "border-l-4 border-teal-500" },
  "potential risks":         { title: "Potential Risks & Challenges", icon: <AlertTriangle className="w-4 h-4"/>, color: "text-orange-700",border: "border-l-4 border-orange-500" },
  "next steps":              { title: "Next Steps",              icon: <Calendar className="w-4 h-4"/>,   color: "text-cyan-700",  border: "border-l-4 border-cyan-500" },
  "confidence":              { title: "Confidence & Limitations",icon: <CheckCircle2 className="w-4 h-4"/>, color: "text-gray-700",  border: "border-l-4 border-gray-500" },
};

function parseSections(text: string): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];
  const lines = text.split("\n");
  let current: { heading: string; content: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\d+\.\s+(.+)$/i);
    const altMatch = trimmed.match(/^([A-Z][A-Z\s&/]+)\s*$/);

    if (sectionMatch) {
      if (current) sections.push({ heading: current.heading, content: current.content.join("\n").trim() });
      current = { heading: sectionMatch[1].trim(), content: [] };
    } else if (altMatch && altMatch[1].length > 3 && !trimmed.includes("|") && !trimmed.includes("-")) {
      if (current) sections.push({ heading: current.heading, content: current.content.join("\n").trim() });
      current = { heading: altMatch[1].trim(), content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.content.join("\n").trim() });

  // If no sections parsed, treat entire text as one
  if (sections.length === 0 && text.trim()) {
    sections.push({ heading: "Analysis", content: text.trim() });
  }
  return sections;
}

const REFINE_ACTIONS: { key: RefineInstruction; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { key: "refine", label: "Refine", icon: <Wand2 className="w-3.5 h-3.5"/>, color: "text-blue-600 hover:bg-blue-50 hover:text-blue-700", desc: "Improve clarity & structure" },
  { key: "aggressive", label: "Aggressive", icon: <Swords className="w-3.5 h-3.5"/>, color: "text-rose-600 hover:bg-rose-50 hover:text-rose-700", desc: "Stronger, assertive language" },
  { key: "provisions", label: "Provisions", icon: <BookMarked className="w-3.5 h-3.5"/>, color: "text-amber-600 hover:bg-amber-50 hover:text-amber-700", desc: "Add more statutes & sections" },
  { key: "simplify", label: "Simplify", icon: <Sparkles className="w-3.5 h-3.5"/>, color: "text-teal-600 hover:bg-teal-50 hover:text-teal-700", desc: "Plain English, shorter" },
];

function getSectionContent(section: { heading: string; content: string }, refined: RefinedSection[] | undefined) {
  if (!refined || refined.length === 0) return section.content;
  return refined[refined.length - 1].text;
}

function SectionCard({
  section,
  idx,
  refined,
  isExpanded,
  isRefining,
  onToggle,
  onRefine,
}: {
  section: { heading: string; content: string };
  idx: number;
  refined?: RefinedSection[];
  isExpanded: boolean;
  isRefining: boolean;
  onToggle: () => void;
  onRefine: (instruction: RefineInstruction) => void;
}) {
  const lower = section.heading.toLowerCase();
  const metaKey = Object.keys(SECTION_META).find(k => lower.includes(k));
  const meta = metaKey
    ? SECTION_META[metaKey]
    : { title: section.heading, icon: <FileText className="w-4 h-4" />, color: "text-foreground", border: "border-l-4 border-border" };

  const content = getSectionContent(section, refined);
  const isTable = content.includes("|") && content.includes("---");
  const isChecklist = content.includes("- [ ]") || content.includes("- [x]");
  const refCount = refined?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={cn("rounded-xl bg-card border border-border shadow-sm overflow-hidden transition-all", meta.border)}
    >
      {/* Header */}
      <div
        className={cn("px-5 py-3 bg-muted/50 border-b border-border flex items-center justify-between cursor-pointer select-none", meta.color)}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          {meta.icon}
          {meta.title}
          {refCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1">
              <History className="w-3 h-3" /> {refCount} refined
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRefining && (
            <span className="flex items-center gap-1 text-xs text-primary animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Refining...
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Content */}
            <div className="p-5 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-serif">
              {isTable ? renderTable(content) : isChecklist ? renderChecklist(content) : content}
            </div>

            {/* Refinement toolbar */}
            <div className="px-5 pb-4">
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Refine Section:</span>
                {REFINE_ACTIONS.map(action => (
                  <button
                    key={action.key}
                    onClick={() => onRefine(action.key)}
                    disabled={isRefining}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background transition-all",
                      action.color,
                      isRefining && "opacity-50 cursor-not-allowed"
                    )}
                    title={action.desc}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Refinement history */}
              {refined && refined.length > 0 && (
                <div className="mt-3 space-y-2">
                  {refined.map((r, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 mb-1">
                        <RotateCcw className="w-3 h-3" />
                        <span className="font-medium capitalize">{r.instruction}</span>
                        <span className="text-[10px] opacity-60">• {new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="line-clamp-3 text-foreground/70">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function renderTable(content: string) {
  const rows = content.split("\n").filter(l => l.trim() && !l.trim().startsWith("|") || l.includes("|"));
  const dataRows = rows.filter(r => r.includes("|") && !r.includes("---"));
  if (dataRows.length === 0) return <pre className="whitespace-pre-wrap">{content}</pre>;

  const cells = dataRows[0].split("|").filter(c => c.trim());
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <tbody>
          {dataRows.map((row, ri) => {
            const cols = row.split("|").filter(c => c.trim());
            return (
              <tr key={ri} className={cn("border-b border-border", ri === 0 && "bg-muted/50 font-medium")}>
                {cols.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-foreground/80">{cell.trim()}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderChecklist(content: string) {
  return (
    <div className="space-y-1">
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();
        const checked = trimmed.includes("- [x]");
        const unchecked = trimmed.includes("- [ ]");
        if (!checked && !unchecked) return <div key={i} className="text-foreground/80">{line}</div>;
        const text = trimmed.replace(/- \[[x ]\]/, "").trim();
        return (
          <div key={i} className="flex items-start gap-2">
            <span className={cn("mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0", checked ? "bg-green-500 border-green-500 text-white" : "border-border bg-background")}>
              {checked && "✓"}
            </span>
            <span className="text-foreground/80">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

function PipelineLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary relative z-10" />
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse-glow" />
      </div>
      <p className="text-lg font-medium text-foreground tracking-tight">Synthesizing Strategy...</p>
      <p className="text-sm text-muted-foreground">Extracting entities and running API chains</p>
    </div>
  );
}

export default function Forge() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [focused, setFocused] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Section refinement state
  const [refinedSections, setRefinedSections] = useState<Record<string, RefinedSection[]>>({});
  const [activeRefining, setActiveRefining] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const refineMutation = useMutation({
    mutationFn: async ({
      caseId,
      sectionName,
      instruction,
      currentText,
    }: {
      caseId: string;
      sectionName: string;
      instruction: RefineInstruction;
      currentText: string;
    }) => {
      const res = await apiFetch("/forge/refine", {
        method: "POST",
        body: JSON.stringify({
          case_id: caseId,
          section_name: sectionName,
          instruction,
          current_text: currentText,
          full_output: result?.final_output ?? "",
        }),
      });
      return res as { refined_text: string; instruction: string; timestamp: string };
    },
    onSuccess: (data, vars) => {
      setRefinedSections(prev => ({
        ...prev,
        [vars.sectionName]: [
          ...(prev[vars.sectionName] || []),
          { text: data.refined_text, instruction: data.instruction, timestamp: data.timestamp || new Date().toISOString() },
        ],
      }));
      setActiveRefining(null);
    },
    onError: () => setActiveRefining(null),
  });

  useEffect(() => {
    const prefill = sessionStorage.getItem("forge_prefill");
    if (prefill) {
      setPrompt(prefill);
      sessionStorage.removeItem("forge_prefill");
    }
  }, []);

  const forge = useMutation({
    mutationFn: (p: string) =>
      apiFetch("/forge", {
        method: "POST",
        body: JSON.stringify({ prompt: p }),
      }),
    onSuccess: (data: ForgeResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["memory-stats"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setResult(null);
    forge.mutate(prompt.trim());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key);
        if (num > 0 && num <= EXAMPLE_PROMPTS.length) {
          e.preventDefault();
          setPrompt(EXAMPLE_PROMPTS[num - 1].text);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 md:py-12">
      <SEOHelmet
        title="LitigaForge AI | Legal Strategy Platform"
        description="Transform your case facts into legal entities, 16 government API chains, and a full AI-generated legal strategy — powered by Claude, Gemini, and GPT. Free for Telangana & AP."
        canonical="/"
        keywords="legal strategy AI India, case filing Telangana, eCourts case status, legal entity extraction, AI lawyer tool India"
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div className="max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4"
          >
            The Forge
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Input case facts. We'll extract entities, execute government API chains, and synthesize a Supreme Court-grade legal strategy.
          </motion.p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={cn(
              "rounded-2xl p-1 transition-all duration-300 bg-card border shadow-sm",
              focused ? "border-primary ring-4 ring-primary/10" : "border-border"
            )}>
              <Textarea
                data-testid="input-prompt"
                value={prompt}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the case facts here. Include PAN, GSTIN, vehicle numbers, or names..."
                className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-base bg-transparent p-4 placeholder:text-muted-foreground/60"
                disabled={forge.isPending}
              />
            </div>

            <AnimatePresence>
              {!prompt && !result && !forge.isPending && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
                  <div className="grid gap-3">
                    {EXAMPLE_PROMPTS.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        data-testid={`example-prompt-${i}`}
                        onClick={() => setPrompt(ex.text)}
                        className="group flex items-start gap-4 text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          ⌘{ex.hotkey}
                        </span>
                        <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed">{ex.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4">
              <Button
                data-testid="button-forge"
                type="submit"
                size="lg"
                disabled={!prompt.trim() || forge.isPending}
                className="h-14 px-8 text-base shadow-lg hover:shadow-xl transition-all"
              >
                <Zap className="w-5 h-5 mr-2" />
                INITIATE FORGE
              </Button>

              {result && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 text-base"
                  onClick={() => {
                    setResult(null);
                    setPrompt("");
                    setRefinedSections({});
                    setExpandedSections(new Set());
                    setActiveRefining(null);
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          {forge.isError && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
              <div>
                <h4 className="text-destructive font-semibold text-lg">Forge Sequence Failed</h4>
                <p className="text-sm text-destructive/80 mt-1">{String(forge.error)}</p>
              </div>
            </motion.div>
          )}

          {forge.isPending && <PipelineLoading />}
          
          {result && !forge.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Case Analysis Complete</h3>
                    <p className="text-sm font-mono text-muted-foreground">{result.case_id}</p>
                  </div>
                </div>
                <Button onClick={() => setLocation(`/cases/${result.case_id}`)} variant="outline" className="gap-2">
                  View Full File <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Chain Status */}
              {result.chain_map.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.chain_map.map((c) => (
                    <span key={c.chain} className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      c.status === "success" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      c.status === "skipped" && "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
                      c.status === "error" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                      c.status === "mock" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                      !["success","skipped","error","mock"].includes(c.status) && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    )}>
                      {c.chain}: {c.status}
                    </span>
                  ))}
                </div>
              )}

              {/* Extracted Entities */}
              {Object.keys(result.entities_found).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Extracted Entities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.entities_found).map(([key, value]) => {
                      if (!value || value === "null" || value === "N/A") return null;
                      const config = ENTITY_CONFIG[key] || { label: key, color: "bg-muted text-muted-foreground" };
                      return (
                        <div key={key} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5", config.color)}>
                          <span className="opacity-70 uppercase">{config.label}:</span>
                          <span className="font-mono">{String(value).slice(0, 40)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strategy Output — Interactive Sectioned Display */}
              {result.final_output && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Gavel className="w-4 h-4" /> Case Analysis Report
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => {
                        const blob = new Blob([result.final_output], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `case-analysis-${result.case_id}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const sections = parseSections(result.final_output);
                      return sections.map((section, idx) => (
                        <SectionCard
                          key={idx}
                          section={section}
                          idx={idx}
                          refined={refinedSections[section.heading]}
                          isExpanded={expandedSections.has(section.heading)}
                          isRefining={activeRefining === section.heading}
                          onToggle={() => {
                            setExpandedSections(prev => {
                              const next = new Set(prev);
                              if (next.has(section.heading)) next.delete(section.heading);
                              else next.add(section.heading);
                              return next;
                            });
                          }}
                          onRefine={(instruction) => {
                            setActiveRefining(section.heading);
                            refineMutation.mutate({
                              caseId: result.case_id,
                              sectionName: section.heading,
                              instruction,
                              currentText: getSectionContent(section, refinedSections[section.heading]),
                            });
                          }}
                        />
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Unthought Chains */}
              {result.meta_suggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Unthought Chains
                  </h4>
                  <div className="grid gap-2">
                    {result.meta_suggestions.map((s, i) => (
                      <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-foreground/80">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
             <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
               <Scale className="w-5 h-5 text-primary" />
               Capabilities
             </h3>
             <ul className="space-y-4 text-sm text-muted-foreground">
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Extracts entities (PAN, GSTIN, Vehicle Nos)</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Cross-references 16 Govt APIs</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Synthesizes arguments and precedents</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Generates final actionable strategy</li>
             </ul>
          </div>
        </div>
      </div>

      {/* ── SEO Content ─────────────────────────────────────────────────────── */}
      <div className="mt-24 border-t border-border/40 pt-16 space-y-20 text-sm text-muted-foreground">

        {/* 1 · About */}
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-2xl font-bold text-foreground mb-4">
            AI-Powered Legal Help for Telangana &amp; Andhra Pradesh
          </h2>
          <p className="max-w-3xl leading-relaxed">
            LitigaForge is an <strong>advocate matching and legal AI platform</strong> built
            specifically for clients and lawyers in Telangana and Andhra Pradesh. Our
            AI-powered engine connects you with <strong>verified Hyderabad lawyers</strong> and
            advocates across the region, analyses your case facts against{" "}
            <strong>16 government API chains</strong> — including live{" "}
            <strong>eCourts integration</strong> for CNR lookup and hearing dates — and
            synthesises a full legal strategy using Claude, Gemini, and GPT. Whether you need
            a criminal lawyer, a property dispute advocate, or family law counsel, LitigaForge
            is the fastest way to access <strong>legal AI in India</strong> without paying
            consultation fees upfront.
          </p>
        </section>

        {/* 2 · How It Works */}
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-xl font-bold text-foreground mb-8">
            How It Works
          </h2>
          <ol className="grid md:grid-cols-3 gap-8 list-none">
            {[
              {
                step: "1",
                title: "Describe Your Case",
                body: "Type your case facts in plain language — names, dates, sections, CNR numbers. The Forge extracts every legal entity automatically.",
              },
              {
                step: "2",
                title: "AI Matches You with Verified Advocates",
                body: "Our matching engine scores lawyers 0–100 on practice area, district, experience, and availability. You see AI explanations for every score.",
              },
              {
                step: "3",
                title: "Get Legal Strategy in Minutes",
                body: "Multi-AI synthesis (Claude → Gemini → GPT) generates arguments, precedents, and an actionable step-by-step strategy — all grounded in Indian law.",
              },
            ].map(({ step, title, body }) => (
              <li key={step} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {step}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                  <p className="leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 3 · Legal Tools */}
        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-xl font-bold text-foreground mb-6">
            Free Legal Tools
          </h2>
          <ul className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 list-none">
            {[
              {
                href: "/ask",
                title: "Ask a Legal Question",
                desc: "Get instant AI answers on IPC, CrPC, consumer rights, property law — free, no login required.",
              },
              {
                href: "/review",
                title: "Analyze a Legal Document",
                desc: "Paste any contract, FIR, or rental agreement and get a risk score, missing clauses, and recommendations.",
              },
              {
                href: "/judgments",
                title: "Search Court Judgments",
                desc: "Find relevant case law and High Court precedents from Telangana and Andhra Pradesh.",
              },
              {
                href: "/lawyers",
                title: "Browse Verified Lawyers",
                desc: "Search the advocate directory by district, practice area, and language across Telangana and AP.",
              },
            ].map(({ href, title, desc }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                >
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors block mb-1">
                    {title}
                  </span>
                  <span className="text-xs leading-relaxed">{desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 · Coverage Area */}
        <section aria-labelledby="coverage-heading">
          <h2 id="coverage-heading" className="text-xl font-bold text-foreground mb-4">
            Coverage Area
          </h2>
          <p className="max-w-3xl leading-relaxed mb-4">
            LitigaForge serves clients and advocates across all districts of{" "}
            <strong>Telangana</strong> and <strong>Andhra Pradesh</strong>, with a focus on the
            major urban and judicial centres:
          </p>
          <ul className="flex flex-wrap gap-2 list-none">
            {[
              "Hyderabad", "Secunderabad", "Warangal", "Karimnagar", "Nizamabad",
              "Khammam", "Vijayawada", "Visakhapatnam", "Guntur", "Tirupati",
              "Kurnool", "Nellore", "Telangana High Court", "Andhra Pradesh High Court",
            ].map((city) => (
              <li
                key={city}
                className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-foreground/70 border border-border"
              >
                {city}
              </li>
            ))}
          </ul>
        </section>

        {/* 5 · FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold text-foreground mb-8">
            Frequently Asked Questions
          </h2>
          <dl className="max-w-3xl space-y-8">
            {[
              {
                q: "How do I find a lawyer in Hyderabad?",
                a: "Post your case requirements on LitigaForge and our AI matches you with the top 10 verified advocates in Hyderabad and across Telangana — with match scores and detailed AI explanations for each match. You can also browse the full advocate directory filtered by district, practice area, and language.",
              },
              {
                q: "Is LitigaForge free to use?",
                a: "Yes. Legal Q&A, document analysis, judgment search, the advocate directory, and the free legal aid finder are all completely free. Professional (₹999/month) and Advocate Pro (₹2,499/month) plans unlock unlimited AI credits, priority matching, and advanced Forge features.",
              },
              {
                q: "What types of cases does LitigaForge handle?",
                a: "LitigaForge supports criminal cases (IPC/CrPC), civil disputes, property and real estate matters, family law (divorce, custody, maintenance), consumer court cases, labour and employment disputes, cheque bounce (NI Act 138), cyber crime, and constitutional matters — across all district and High Courts in Telangana and Andhra Pradesh.",
              },
              {
                q: "How does AI legal document analysis work?",
                a: "Paste your contract, FIR, rental agreement, power of attorney, or any legal document into the Document Analyzer. Our AI reads every clause, assigns a risk score out of 10, identifies missing standard clauses, flags jurisdiction issues under Indian law, and gives you prioritised recommendations — all in under 30 seconds.",
              },
              {
                q: "What is free legal aid in Telangana?",
                a: "Under the Legal Services Authorities Act 1987, free legal representation is available to women, SC/ST individuals, persons with disabilities, victims of trafficking, persons in custody, and those with annual income below ₹3 lakhs. In Telangana, the TSLSA and 10 District Legal Services Authorities (DLSAs) provide free legal aid. Call NALSA helpline 15100. Use our Free Legal Aid Finder for all DLSA contacts.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <dt><h3 className="font-semibold text-foreground">{q}</h3></dt>
                <dd className="mt-2 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

      </div>
    </div>
  );
}