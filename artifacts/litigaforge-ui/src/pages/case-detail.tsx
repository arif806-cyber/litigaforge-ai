import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  pan: "PAN", gstin: "GSTIN", vehicle_number: "Vehicle No.",
  party_name: "Party", case_number: "Case No.", state_code: "State",
  location: "Location", case_type: "Case Type", dl_number: "DL No.", aadhaar: "Aadhaar",
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return ts; }
}

export default function CaseDetail({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();

  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: ["case", params.id],
    queryFn: () => apiFetch(`/cases/${params.id}`),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="px-8 py-6 space-y-4" data-testid="case-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-8 py-6">
        <div className="border border-destructive/30 bg-destructive/10 rounded-md p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  const entities = Object.entries(caseData.extracted_entities ?? caseData.entities_found ?? {}).filter(([, v]) => v);
  const chainMap: { chain: string; status: string }[] = caseData.chain_map ?? [];
  const suggestions: string[] = caseData.meta_suggestions ?? [];
  const apiResults: Record<string, unknown> = caseData.api_results ?? {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/cases")}
            data-testid="button-back"
            className="text-muted-foreground hover:text-foreground -ml-2 h-7 px-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Cases
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <h1
            data-testid="text-case-id"
            className="text-lg font-mono font-semibold text-primary tracking-wide"
          >
            {caseData.case_id}
          </h1>
          {caseData.timestamp && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatTime(caseData.timestamp)}
            </span>
          )}
        </div>
        {caseData.prompt && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{caseData.prompt}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-4">
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
                  <span className="text-muted-foreground">{ENTITY_LABELS[key as string] ?? key}:</span>
                  <span className="font-mono font-medium text-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chain map */}
        {chainMap.length > 0 && (
          <div className="border border-border rounded-md bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Chains Executed ({chainMap.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {chainMap.map((item) => (
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
        )}

        {/* API results */}
        {Object.keys(apiResults).length > 0 && (
          <div className="border border-border rounded-md bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">API Results</p>
            </div>
            <Accordion type="multiple" className="divide-y divide-border">
              {Object.entries(apiResults).map(([chain, data]) => (
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
        {suggestions.length > 0 && (
          <div className="border border-border rounded-md bg-card p-4 space-y-2.5">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Recommendations</p>
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => (
                <li key={i} data-testid={`suggestion-${i}`} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary font-mono text-xs mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Final output */}
        {caseData.final_output && (
          <div className="border border-border rounded-md bg-card p-4 space-y-2.5">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Legal Strategy</p>
            <div
              data-testid="text-final-output"
              className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
            >
              {caseData.final_output}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
