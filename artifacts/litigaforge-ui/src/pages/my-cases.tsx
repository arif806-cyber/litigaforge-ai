import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useLanguage } from "../hooks/useLanguage";
import {
  FileText, MapPin, Clock, EyeOff, ArrowRight, Plus,
  Search, Loader2, AlertTriangle, PenSquare, X, Check,
  Share2, Trash2, Sparkles
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useCountry } from "@/hooks/useCountry";
import { formatDate } from "@/lib/locale";
import { LawyerMatchCard } from "@/components/LawyerMatchCard";
import { useLawyerPresence } from "@/hooks/useLawyerPresence";
import { useClientPresence } from "@/hooks/useClientPresence";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  open:    { bg: "rgba(52,211,153,0.12)",  text: "#34D399", border: "rgba(52,211,153,0.25)"  },
  pending: { bg: "rgba(245,183,84,0.12)",  text: "#F5B754", border: "rgba(245,183,84,0.25)"  },
  closed:  { bg: "rgba(138,143,163,0.12)", text: "#8A8FA3", border: "rgba(138,143,163,0.25)" },
};

const CASE_TYPES = [
  "Property Dispute", "Family Matter", "Criminal", "Civil", "Consumer",
  "Labour", "Tax", "IP / Trademark", "Other"
];

export default function MyCases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { activeCode } = useCountry();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"open" | "pending" | "closed">("open");
  const [search, setSearch] = useState("");
  const [editingCase, setEditingCase] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", case_type: "", description: "", location: "", budget_range: "", is_anonymous: false });
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => apiFetch("/cases/requirements/mine"),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; body: any }) => apiFetch(`/cases/requirements/${vars.id}`, { method: "PATCH", body: vars.body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-cases"] }); setEditingCase(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/cases/requirements/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-cases"] }),
  });

  const { data: matchesData } = useQuery({
    queryKey: ["client-matches"],
    queryFn: () => apiFetch("/matches/client"),
    enabled: !!user,
    staleTime: 30000,
  });
  const clientMatches: any[] = matchesData?.matches ?? [];

  const acceptMatchMutation = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/accept`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-matches"] }),
  });

  const declineMatchMutation = useMutation({
    mutationFn: (matchId: number) => apiFetch(`/matches/${matchId}/decline`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-matches"] }),
  });

  const reviewingLawyers = useLawyerPresence(expandedCase);
  const heartbeatCaseId = expandedCase ?? ((data as any)?.cases?.[0]?.id ?? null);
  useClientPresence(heartbeatCaseId);

  if (!user) {
    return (<>
      <SEOHelmet title="My Cases" description="Track your posted cases and match proposals." canonical="/my-cases" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h2 className="text-xl font-semibold">{t.sign_in_required}</h2>
          <Button onClick={() => window.location.href = "/login"}>{t.sign_in}</Button>
        </div>
      </div>
    </>);
  }

  const allCases = data?.cases ?? [];
  const filtered = allCases
    .filter((c: any) => c.status === tab)
    .filter((c: any) => !search || [c.title, c.case_type, c.location, c.description].some((f) => f?.toLowerCase().includes(search.toLowerCase())));

  return (
    <PageShell title={t.my_cases} subtitle="Cases you have posted and proposals received from lawyers."
      action={<Link href="/post-case"><Button><Plus className="w-4 h-4 mr-2" /> {t.post_case}
          </Button></Link>}>
      <div className="bg-card rounded-2xl shadow-sm" style={{ border: "1px solid hsl(var(--border))" }}>
        {/* Tabs + Search */}
        <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}><FileText className="w-4 h-4 text-violet-400" /></div>
            <h2 className="font-bold text-foreground text-sm">{t.my_cases}</h2>
            <span className="text-[11px] text-muted-foreground/60">({allCases.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-background rounded-lg p-0.5">
              {(["open","pending","closed"] as const).map((tabKey) => (
                <button key={tabKey} onClick={() => setTab(tabKey)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md capitalize transition-all ${tab === tabKey ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"}`}>
                  {tabKey}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground/60" />
            <input type="text" placeholder={t.search_cases} value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-muted-foreground/60 hover:text-muted-foreground"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* Case list */}
        <div className="p-4 space-y-2.5">
          {isLoading && <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground/60" /></div>}
          {isError && (
            <div className="flex flex-col items-center py-12 space-y-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-600 font-semibold">Failed to load cases</p>
              <p className="text-xs text-muted-foreground/60">{(error as Error)?.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          )}
          {!isLoading && allCases.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))" }}>
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t.no_cases_yet}</p>
              <Link href="/post-case"><Button size="sm" className="mt-3"><Plus className="w-4 h-4 mr-1" /> {t.post_case}</Button></Link>
            </div>
          )}
          {!isLoading && allCases.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center py-6">No {tab} cases{search ? " matching your search" : ""}.</p>
          )}
          {filtered.map((c: any) => {
            const st = STATUS_COLORS[c.status] || STATUS_COLORS.open;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/my-cases/${c.id}`)}
                className="rounded-xl p-4 hover:shadow-md transition-all cursor-pointer" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
                      <FileText className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{c.title}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.25)" }}>{c.case_type}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>{c.status.toUpperCase()}</span>
                        {c.is_anonymous && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"><EyeOff className="w-2.5 h-2.5 inline mr-0.5" />Anon</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/60">
                        {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(c.created_at, activeCode)}</span>
                        {c.budget_range && <span className="flex items-center gap-1 text-amber-600 font-medium">{c.budget_range}</span>}
                      </div>
                      {c.description && <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                    </div>
                  </div>
                  {/* Inline actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingCase(c); setEditForm({ title: c.title||"", case_type: c.case_type||"", description: c.description||"", location: c.location||"", budget_range: c.budget_range||"", is_anonymous: c.is_anonymous||false }); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors" title="Edit">
                      <PenSquare className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const text = `Case: ${c.title}\nType: ${c.case_type}\nLocation: ${c.location||"N/A"}\nBudget: ${c.budget_range||"N/A"}\nStatus: ${c.status}\n\n— LitigaForge AI`;
                      if (navigator.share) navigator.share({ title: c.title, text });
                      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Share">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this case requirement?")) deleteMutation.mutate(c.id); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/matches?case=${c.id}`} onClick={(e) => e.stopPropagation()}>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors" title="Find lawyers">
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  </div>
                </div>
                {(() => {
                  const caseMatches = clientMatches.filter((m: any) => m.case_requirement_id === c.id);
                  if (caseMatches.length === 0) return null;
                  const isExpanded = expandedCase === c.id;
                  return (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                      <button
                        onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        {isExpanded ? "Hide" : "View"} matched lawyers ({caseMatches.length})
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          {caseMatches.map((m: any) => (
                            <LawyerMatchCard
                              key={m.id}
                              match={m}
                              isReviewing={reviewingLawyers.has(m.lawyer_id)}
                              onAccept={(match) => acceptMatchMutation.mutate(match.id)}
                              onDecline={(id) => declineMatchMutation.mutate(id)}
                              testIdPrefix="my-cases-match"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setEditingCase(null)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-card rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
              style={{ border: "1px solid hsl(var(--border))" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Edit Case Requirement</h3>
                <button onClick={() => setEditingCase(null)} className="text-muted-foreground/60 hover:text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="text-sm font-medium">Title</label>
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "hsl(var(--border))" }} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div><label className="text-sm font-medium">Case Type</label>
                  <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "hsl(var(--border))" }} value={editForm.case_type} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))}>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="text-sm font-medium">Description</label>
                  <textarea rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm resize-none" style={{ borderColor: "hsl(var(--border))" }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Location</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "hsl(var(--border))" }} value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div><label className="text-sm font-medium">Budget</label>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "hsl(var(--border))" }} value={editForm.budget_range} onChange={e => setEditForm(f => ({ ...f, budget_range: e.target.value }))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm.is_anonymous} onChange={e => setEditForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                  <EyeOff className="w-3.5 h-3.5" /> Post anonymously
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingCase(null)}>Cancel</Button>
                <Button className="flex-1" disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: editingCase.id, body: editForm })}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Save Changes
                </Button>
              </div>
              {updateMutation.isError && <p className="text-xs text-red-500 text-center">{(updateMutation.error as Error)?.message}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
