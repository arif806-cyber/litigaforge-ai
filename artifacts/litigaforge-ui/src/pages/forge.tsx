import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChainMapItem { chain: string; status: string; }
interface ForgeResult {
  status: string;
  case_id: string;
  chains_executed: string[];
  chain_map: ChainMapItem[];
  entities_found: Record<string, string>;
  api_results: Record<string, unknown>;
  meta_suggestions: string[];
  final_output: string;
}

const ENTITY_LABELS: Record<string, string> = {
  pan: "PAN",
  gstin: "GSTIN",
  vehicle_number: "Vehicle No.",
  party_name: "Party",
  case_number: "Case No.",
  state_code: "State",
  location: "Location",
  case_type: "Case Type",
  dl_number: "DL No.",
  aadhaar: "Aadhaar",
};

const EXAMPLE_PROMPTS = [
  "My client Ramesh Kumar with PAN ABCDE1234F and GSTIN 36ABCDE1234F1Z5 has a property dispute in Hyderabad. Vehicle TS09EA1234 involved.",
  "Client Lakshmi Devi, DL No. TS0920230001234, met with an accident in Vijayawada. Need RC and DL verification.",
  "GST fraud case — GSTIN 29AABCU9603R1ZM and PAN AABCU9603R, case filed at City Civil Court Hyderabad.",
];

export default function Forge() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Case Forge</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Describe your case in plain language — entities are extracted and API chains run automatically.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            data-testid="input-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the case — include any identifiers such as PAN, GSTIN, vehicle number, party names, court details, or location…"
            className="min-h-[120px] font-mono text-sm resize-none bg-card border-border focus:ring-primary"
            disabled={forge.isPending}
          />

          {/* Example prompts */}
          {!prompt && !result && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">Examples</p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`example-prompt-${i}`}
                    onClick={() => setPrompt(ex)}
                    className="block w-full text-left text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded px-3 py-2 bg-card hover:bg-accent transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              data-testid="button-forge"
              type="submit"
              disabled={!prompt.trim() || forge.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {forge.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Forging strategy…
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5 mr-2" />
                  Forge Strategy
                </>
              )}
            </Button>
            {result && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setResult(null); setPrompt(""); }}
              >
                New case
              </Button>
            )}
          </div>
        </form>

        {/* Loading chains */}
        {forge.isPending && (
          <div className="border border-border rounded-md bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Analysing prompt and running API chains…
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["GSTIN","PAN","eCourts","VAHAN","SARATHI","MEE_SEVA_TG","TRANSPORT_TS","MERIPEHCHAAN"].map((c) => (
                <span key={c} className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground animate-pulse">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {forge.isError && (
          <div className="border border-destructive/30 bg-destructive/10 rounded-md p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{String(forge.error)}</p>
          </div>
        )}

        {/* Results */}
        {result && <ForgeResults result={result} onViewCase={() => setLocation(`/cases/${result.case_id}`)} />}
      </div>
    </div>
  );
}

function ForgeResults({ result, onViewCase }: { result: ForgeResult; onViewCase: () => void }) {
  const entities = Object.entries(result.entities_found).filter(([, v]) => v);

  return (
    <div className="space-y-4">
      {/* Case header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Case</span>
          <span
            data-testid="text-case-id"
            className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded"
          >
            {result.case_id}
          </span>
        </div>
        <button
          data-testid="link-view-case"
          onClick={onViewCase}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View full case <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Entities */}
      {entities.length > 0 && (
        <div className="border border-border rounded-md bg-card p-4 space-y-2.5">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Extracted Entities</p>
          <div className="flex flex-wrap gap-2">
            {entities.map(([key, value]) => (
              <div
                key={key}
                data-testid={`entity-${key}`}
                className="flex items-center gap-1.5 text-xs border border-border rounded px-2 py-1 bg-muted"
              >
                <span className="text-muted-foreground">{ENTITY_LABELS[key] ?? key}:</span>
                <span className="font-mono font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chain map */}
      <div className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Chains Executed ({result.chains_executed.length})
          </p>
        </div>
        <div className="divide-y divide-border">
          {result.chain_map.map((item) => (
            <div
              key={item.chain}
              data-testid={`chain-row-${item.chain}`}
              className="flex items-center justify-between px-4 py-2"
            >
              <span className="text-sm font-mono text-foreground">{item.chain}</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono uppercase tracking-wider",
                  item.status === "live"
                    ? "border-green-500/40 text-green-400 bg-green-500/10"
                    : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                )}
              >
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* API results */}
      {Object.keys(result.api_results).length > 0 && (
        <div className="border border-border rounded-md bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">API Results</p>
          </div>
          <Accordion type="multiple" className="divide-y divide-border">
            {Object.entries(result.api_results).map(([chain, data]) => (
              <AccordionItem key={chain} value={chain} className="border-0">
                <AccordionTrigger
                  data-testid={`accordion-${chain}`}
                  className="px-4 py-2.5 text-sm font-mono hover:no-underline hover:bg-muted/30"
                >
                  {chain}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <pre className="text-[11px] font-mono text-muted-foreground bg-muted/40 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Suggestions */}
      {result.meta_suggestions.length > 0 && (
        <div className="border border-border rounded-md bg-card p-4 space-y-2.5">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Recommendations</p>
          <ul className="space-y-1.5">
            {result.meta_suggestions.map((s, i) => (
              <li key={i} data-testid={`suggestion-${i}`} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-primary font-mono text-xs mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final output */}
      {result.final_output && (
        <div className="border border-border rounded-md bg-card p-4 space-y-2.5">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Legal Strategy</p>
          <div
            data-testid="text-final-output"
            className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
          >
            {result.final_output}
          </div>
        </div>
      )}
    </div>
  );
}
