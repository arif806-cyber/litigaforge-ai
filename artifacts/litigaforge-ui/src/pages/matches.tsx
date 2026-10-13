import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useLanguage } from "../hooks/useLanguage";
import { motion } from "framer-motion";
import {
  UserCheck, X,
  Loader2, ArrowLeft, Sparkles, Search,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/PaymentModal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LawyerMatchCard } from "@/components/LawyerMatchCard";
import { useLawyerPresence } from "@/hooks/useLawyerPresence";


export default function Matches() {
  const { user } = useAuth();
  const isAdvocate = user?.role === "advocate" || user?.role === "lawyer";
  const [_, setLocation] = useLocation();
  const { t } = useLanguage();
  const [tab, setTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [search, setSearch] = useState("");
  const [isFinding, setIsFinding] = useState(false);
  const [payingMatch, setPayingMatch] = useState<any>(null);
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const caseId = searchParams.get("case");

  const { data: clientMatches, isLoading, refetch } = useQuery({
    queryKey: ["matches", isAdvocate ? "advocate" : "client"],
    queryFn: () => apiFetch(isAdvocate ? "/matches/lawyer" : "/matches/client"),
    enabled: !!user,
  });

  const matches = clientMatches?.matches ?? [];
  const presenceCaseId: number | null = matches[0]?.case_requirement_id ?? null;
  const reviewingIds = useLawyerPresence(presenceCaseId);

  const declineMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/matches/${id}/decline`, { method: "POST" }),
    onSuccess: () => refetch(),
  });

  const findLawyers = async () => {
    if (!caseId) return;
    setIsFinding(true);
    try {
      await apiFetch("/match/find-lawyers", {
        method: "POST",
        body: JSON.stringify({ case_requirement_id: parseInt(caseId) }),
      });
      refetch();
    } catch (e) {
      void e;
    } finally {
      setIsFinding(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">{t.sign_in_required}</h2>
          <Button onClick={() => setLocation("/login")}>{t.sign_in}</Button>
        </div>
      </div>
    );
  }

  const filtered = matches
    .filter((m: any) => m.status === tab)
    .filter((m: any) => !search || [m.lawyer_name, m.district, m.case_title].some(
      (f: any) => f?.toLowerCase().includes(search.toLowerCase())
    ));

  return (
    <PageShell title={isAdvocate ? "Client Requests" : t.match_proposals} subtitle={isAdvocate ? "Review client requests matched to your advocate profile." : "AI-scored lawyer proposals for your cases."}>
      <SEOHelmet title={`${isAdvocate ? "Client Requests" : "Match Proposals"} — LitigaForge AI`} description={isAdvocate ? "Review incoming client requests." : "Review AI-matched lawyer proposals."} />

      <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation(isAdvocate ? "/lawyers" : "/my-cases")} className="text-muted-foreground hover:text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {caseId && (
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={findLawyers} disabled={isFinding}>
            {isFinding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Find Lawyers for Case #{caseId}
          </Button>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-bold text-foreground text-sm">{t.match_proposals}</h2>
            <span className="text-[11px] text-muted-foreground">({matches.length})</span>
          </div>
          <div className="flex items-center gap-1 bg-background rounded-lg p-0.5">
            {(["pending", "accepted", "declined"] as const).map((tabKey) => (
              <button key={tabKey} onClick={() => setTab(tabKey)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${tab === tabKey ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground"}`}>
                {tabKey}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder={t.search_cases}
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          {isLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>}

          {!isLoading && matches.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
              <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No match proposals yet.</p>
              <p className="text-xs text-muted-foreground mt-1">{isAdvocate ? "New requests will appear here when clients are matched to your profile." : "You can browse verified advocates while you wait."}</p>
              <Button size="sm" className="mt-3" onClick={() => setLocation(isAdvocate ? "/lawyers" : "/my-cases")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> {isAdvocate ? "Browse Advocates" : "Go to My Cases"}
              </Button>
              {!isAdvocate && <Button size="sm" variant="outline" className="mt-3 ml-2" onClick={() => setLocation("/lawyers")}>Browse Advocates</Button>}
            </div>
          )}

          {!isLoading && matches.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No {tab} matches{search ? " matching your search" : ""}.
            </p>
          )}

          {filtered.map((m: any) => isAdvocate ? (
            <article key={m.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-semibold">{m.case_title || "Client request"}</h3>
              <p className="text-sm text-muted-foreground">{[m.case_type, m.location, m.budget_range].filter(Boolean).join(" · ")}</p>
              {m.description && <p className="text-sm whitespace-pre-wrap">{m.description}</p>}
              {m.client_message && <p className="text-sm text-muted-foreground">{m.client_message}</p>}
              <p className="text-xs text-muted-foreground capitalize">Status: {m.status}</p>
            </article>
          ) : (
            <LawyerMatchCard key={m.id} match={m}
              isReviewing={reviewingIds.has(m.lawyer_id)}
              onAccept={(match) => setPayingMatch(match)}
              onDecline={(id) => declineMutation.mutate(id)}
              testIdPrefix="matches-card"
            />
          ))}
        </div>
      </div>

      {payingMatch && (
        <PaymentModal
          matchId={payingMatch.id}
          lawyerName={payingMatch.lawyer_name}
          caseTitle={payingMatch.case_title}
          onClose={() => setPayingMatch(null)}
          onSuccess={() => {
            setPayingMatch(null);
            setTab("accepted");
            queryClient.invalidateQueries({ queryKey: ["matches-client"] });
            refetch();
          }}
        />
      )}
    </PageShell>
  );
}
