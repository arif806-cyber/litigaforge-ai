import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  UserCheck, MapPin, Star, Briefcase, Clock, Check, X,
  Loader2, MessageSquare, ArrowLeft, Sparkles, Search,
  Phone, Send, ChevronRight
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function MatchCard({ match, onAccept, onDecline, isClient }: {
  match: any; onAccept: (id: number) => void; onDecline: (id: number) => void; isClient: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 hover:shadow-sm transition-all" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#1a2744" }}>
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{isClient ? match.lawyer_name : match.case_title}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: match.match_score >= 80 ? "#059669" : match.match_score >= 60 ? "#D97706" : "#EF4444" }}>
                {match.match_score}% Match
              </span>
              {match.rating > 0 && (
                <span className="text-[11px] flex items-center gap-0.5 text-amber-600"><Star className="w-3 h-3 fill-amber-400" />{match.rating}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
              {isClient && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.district}</span>}
              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{match.experience_years || 0} yrs</span>
              <span className="flex items-center gap-1">₹{match.hourly_rate}/hr</span>
            </div>
            {match.ai_explanation && (
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{match.ai_explanation}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {match.status === "pending" && isClient && (
                <>
                  <button onClick={() => onAccept(match.id)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-colors" style={{ background: "#059669" }}>
                    <Check className="w-3 h-3 inline mr-1" /> Accept
                  </button>
                  <button onClick={() => onDecline(match.id)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    <X className="w-3 h-3 inline mr-1" /> Decline
                  </button>
                </>
              )}
              {match.status === "accepted" && (
                <Link href={`/chat?match=${match.id}`}>
                  <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 transition-colors" style={{ background: "#2563EB" }}>
                    <MessageSquare className="w-3 h-3" /> Chat
                  </button>
                </Link>
              )}
              {match.lawyer_phone && (
                <a href={`tel:${match.lawyer_phone}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
              {match.lawyer_email && (
                <a href={`mailto:${match.lawyer_email}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Send className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Matches() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [tab, setTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [search, setSearch] = useState("");
  const [isFinding, setIsFinding] = useState(false);
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const caseId = searchParams.get("case");

  const { data: clientMatches, isLoading, refetch } = useQuery({
    queryKey: ["matches-client"],
    queryFn: () => apiFetch("/matches/client"),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/matches/${id}/${status}`, { method: "POST" }),
    onSuccess: () => refetch(),
  });

  const findLawyers = async () => {
    if (!caseId) return;
    setIsFinding(true);
    try {
      await apiFetch("/match/find-lawyers", { method: "POST", body: JSON.stringify({ case_requirement_id: parseInt(caseId) }) });
      refetch();
    } catch (e) { console.error(e); }
    finally { setIsFinding(false); }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => setLocation("/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const matches = clientMatches?.matches ?? [];
  const filtered = matches
    .filter((m: any) => m.status === tab)
    .filter((m: any) => !search || [m.lawyer_name, m.district, m.case_title].some((f) => f?.toLowerCase().includes(search.toLowerCase())));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <SEOHelmet title="AI Matching" description="View AI-scored lawyer matches with explanations." canonical="/matches" />

      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/my-cases")} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your Lawyer Matches</h1>
          <p className="text-gray-400 mt-1 text-sm">AI-scored lawyer proposals for your cases.</p>
        </div>
      </div>

      {caseId && (
        <div className="flex items-center gap-3">
          <Button onClick={findLawyers} disabled={isFinding} className="bg-[#1a2744] hover:bg-[#243656] text-white">
            {isFinding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Find Lawyers for Case #{caseId}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm" style={{ border: "1px solid #F1F5F9" }}>
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F5F3FF" }}><Sparkles className="w-4 h-4 text-violet-600" /></div>
            <h2 className="font-bold text-gray-900 text-sm">Match Proposals</h2>
            <span className="text-[11px] text-gray-400">({matches.length})</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            {(["pending","accepted","declined"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by lawyer name, district, or case..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {isLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>}
          {!isLoading && matches.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No match proposals yet.</p>
              <Button size="sm" className="mt-3" onClick={() => setLocation("/my-cases")}><ArrowLeft className="w-4 h-4 mr-1" /> Go to My Cases</Button>
            </div>
          )}
          {!isLoading && matches.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No {tab} matches{search ? " matching your search" : ""}.</p>
          )}
          {filtered.map((m: any) => (
            <MatchCard key={m.id} match={m} isClient={true}
              onAccept={(id) => updateMutation.mutate({ id, status: "accept" })}
              onDecline={(id) => updateMutation.mutate({ id, status: "decline" })}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
