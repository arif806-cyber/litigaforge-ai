import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";

interface Chain {
  name: string;
  description: string;
}

const CHAIN_COLORS: Record<string, string> = {
  GSTIN: "border-blue-500/30 text-blue-400",
  PAN: "border-violet-500/30 text-violet-400",
  DigiLocker: "border-cyan-500/30 text-cyan-400",
  eCourts: "border-amber-500/30 text-amber-400",
  VAHAN: "border-green-500/30 text-green-400",
  SARATHI: "border-teal-500/30 text-teal-400",
  BPCL_LPG: "border-orange-500/30 text-orange-400",
  MERIPEHCHAAN: "border-pink-500/30 text-pink-400",
  MEE_SEVA_TG: "border-red-500/30 text-red-400",
  TRANSPORT_TS: "border-indigo-500/30 text-indigo-400",
};

export default function Chains() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["chains"],
    queryFn: () => apiFetch("/chains"),
    staleTime: 300000,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch("/healthz"),
    staleTime: 15000,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-8 py-5 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">API Chains</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Available data pipelines. Chains are selected automatically based on entities found in your prompt.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">
        {/* Mode notice */}
        {health && (
          <div
            data-testid="mode-notice"
            className={`flex items-start gap-2 px-4 py-3 rounded-md border text-sm ${
              health.dummy_mode
                ? "border-amber-500/30 bg-amber-500/5 text-amber-400/80"
                : "border-green-500/30 bg-green-500/5 text-green-400/80"
            }`}
          >
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {health.dummy_mode
                ? "Running in dummy mode — all chains return realistic mock data. Set API keys in .env to enable live data."
                : "Live mode — chains connect to real government APIs."}
            </span>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 gap-3" data-testid="chains-loading">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        )}

        {isError && (
          <div className="border border-destructive/30 bg-destructive/10 rounded-md p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{String(error)}</p>
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                {data.total_chains} chains available
              </p>
            </div>

            <div className="border border-border rounded-md bg-card overflow-hidden divide-y divide-border">
              {(data.chains as Chain[]).map((chain) => (
                <div
                  key={chain.name}
                  data-testid={`chain-card-${chain.name}`}
                  className="flex items-start gap-4 px-5 py-4"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono uppercase tracking-wider flex-shrink-0 mt-0.5 ${CHAIN_COLORS[chain.name] ?? "border-muted-foreground/30 text-muted-foreground"}`}
                  >
                    {chain.name}
                  </Badge>
                  <p className="text-sm text-foreground/70 leading-relaxed">{chain.description}</p>
                </div>
              ))}
            </div>

            {data.note && (
              <p className="text-xs text-muted-foreground/60 font-mono">{data.note}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
