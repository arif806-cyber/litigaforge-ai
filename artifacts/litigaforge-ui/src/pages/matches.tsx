import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  UserCheck, MapPin, Star, Briefcase, Clock, Check, X,
  Loader2, MessageSquare, ArrowLeft, Sparkles, Zap, AlertTriangle,
  ExternalLink
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function ExternalMatchCard({ match }: { match: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-amber-200/60 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{match.name}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <ExternalLink className="w-3 h-3" /> eCourts India
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {match.district || "Telangana"}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {match.practice_areas?.join(", ") || "General"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${match.match_score || 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-amber-700">{match.match_score || 0}% match</span>
          </div>

          {match.ai_explanation && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">{match.ai_explanation}</p>
              </div>
            </div>
          )}

          <div className="bg-muted/40 border border-muted rounded-lg p-3 text-sm text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p>This advocate was found via public court records. <strong>Verify independently</strong> before engagement. Contact details and current bar membership must be confirmed.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MatchCard({ match, onAccept, onDecline, isClient }: {
  match: any; onAccept: (id: number) => void; onDecline: (id: number) => void; isClient: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (<>
      <SEOHelmet title="AI Matching" description="View AI-scored lawyer matches with explanations for your cases." canonical="/matches" />
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-card-border rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{isClient ? match.lawyer_name : match.case_title}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {isClient && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {match.district}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> {match.rating || "N/A"}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {match.experience_years || 0} yrs
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${match.match_score || 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-primary">{match.match_score || 0}% match</span>
          </div>

          {match.ai_explanation && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">{match.ai_explanation}</p>
              </div>
            </div>
          )}

          {match.status === "pending" && isClient && (
            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" onClick={() => onAccept(match.id)} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDecline(match.id)} className="text-destructive border-destructive hover:bg-destructive/10">
                <X className="w-4 h-4 mr-1" /> Decline
              </Button>
              <Link href={`/chat?match=${match.id}`}>
                <Button size="sm" variant="ghost">
                  <MessageSquare className="w-4 h-4 mr-1" /> Chat
                </Button>
              </Link>
            </div>
          )}

          {match.status === "accepted" && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              <Check className="w-4 h-4" /> Connection established
              <Link href={`/chat?match=${match.id}`}>
                <Button size="sm" variant="ghost" className="ml-auto h-7">
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Open Chat
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  </>);
}

export default function Matches() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [_, setLocation] = useLocation();
  const [isFinding, setIsFinding] = useState(false);
  const [externalMatches, setExternalMatches] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const caseId = searchParams.get("case");

  const { data: clientMatches, isLoading: clientLoading, isError: clientError, error: clientErrorData, refetch: refetchClient } = useQuery({
    queryKey: ["matches-client"],
    queryFn: () => apiFetch("/matches/client"),
    enabled: !!user,
  });

  const { data: lawyerMatches, isLoading: lawyerLoading, isError: lawyerError, error: lawyerErrorData } = useQuery({
    queryKey: ["matches-lawyer"],
    queryFn: () => apiFetch("/matches/lawyer"),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/matches/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      refetchClient();
    },
  });

  const findLawyers = async () => {
    if (!caseId) return;
    setIsFinding(true);
    try {
      const result = await apiFetch("/match/find-lawyers", {
        method: "POST",
        body: JSON.stringify({ case_requirement_id: parseInt(caseId) }),
      });
      if (result?.external_matches?.length) {
        // External matches are not stored in DB, so keep them in component state
        setExternalMatches(result.external_matches || []);
      }
      refetchClient();
    } catch (e) {
      console.error(e);
    } finally {
      setIsFinding(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => setLocation("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const isLawyer = !!lawyerMatches?.matches?.length || lawyerMatches?.message;
  const matches = isLawyer ? (lawyerMatches?.matches ?? []) : (clientMatches?.matches ?? []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-4xl mx-auto space-y-6"
    >
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/my-cases")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {isLawyer ? "Matched Client Cases" : "Your Lawyer Matches"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLawyer
              ? "Clients seeking legal help in your practice areas."
              : "AI-matched lawyers for your legal requirements."}
          </p>
        </div>
      </div>

      {caseId && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <Zap className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Looking for the best lawyers for your case?</p>
            <p className="text-xs text-muted-foreground">Our AI will match you with verified advocates based on expertise and location.</p>
          </div>
          <Button onClick={findLawyers} disabled={isFinding} size="sm">
            {isFinding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find Lawyers"}
          </Button>
        </div>
      )}

      {clientLoading || lawyerLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : clientError || lawyerError ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-destructive">Failed to load matches</h3>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {(clientErrorData as Error)?.message ?? (lawyerErrorData as Error)?.message ?? "Please try again."}
          </p>
          <Button variant="outline" onClick={() => refetchClient()}>Retry</Button>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No Matches Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isLawyer
              ? "Complete your lawyer profile and keep it updated to receive matches."
              : "Post a case requirement and use AI matching to find the best lawyers."}
          </p>
          {!isLawyer && (
            <Link href="/post-case">
              <Button>Post a Case</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m: any) => (
            <MatchCard
              key={m.id}
              match={m}
              isClient={!isLawyer}
              onAccept={(id) => updateMutation.mutate({ id, status: "accepted" })}
              onDecline={(id) => updateMutation.mutate({ id, status: "declined" })}
            />
          ))}

          {externalMatches.length > 0 && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Also found on eCourts India
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {externalMatches.map((m: any) => (
                <ExternalMatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
