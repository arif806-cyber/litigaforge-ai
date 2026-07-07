import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarSearch, Plus, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Clock, Calendar, Building2,
  RefreshCw, Sparkles, Lock, CheckCircle2, Activity,
  X, Search, Info, Gavel,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const CASE_TYPES = [
  "Civil", "Criminal", "Family", "Property", "Consumer",
  "Labour", "Tax", "Motor Accident", "Writ / PIL", "Other",
];

const EVENT_ICONS: Record<string, { color: string; Icon: React.ElementType }> = {
  hearing_scheduled: { Icon: Calendar,     color: "#F5B754" },
  hearing_adjourned: { Icon: Clock,        color: "#8B5CF6" },
  order_passed:      { Icon: Gavel,        color: "#34D399" },
  status_changed:    { Icon: Activity,     color: "#60A5FA" },
  case_disposed:     { Icon: CheckCircle2, color: "#34D399" },
  default:           { Icon: Info,         color: "#8A8FA3" },
};

function eventMeta(type: string) {
  return EVENT_ICONS[type] ?? EVENT_ICONS.default;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const cfg =
    s.includes("dispos") || s.includes("closed")
      ? { bg: "rgba(52,211,153,0.12)",   color: "#34D399", border: "rgba(52,211,153,0.25)"  }
      : s.includes("pending") || s.includes("admit")
      ? { bg: "rgba(245,183,84,0.12)",   color: "#F5B754", border: "rgba(245,183,84,0.25)"  }
      : s.includes("fresh") || s.includes("new")
      ? { bg: "rgba(139,92,246,0.12)",   color: "#8B5CF6", border: "rgba(139,92,246,0.25)"  }
      : { bg: "rgba(96,165,250,0.12)",   color: "#60A5FA", border: "rgba(96,165,250,0.25)"  };

  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {status}
    </span>
  );
}

/* ── Add-CNR form ──────────────────────────────────────────────────────────── */
function CnrInput({ onTracked }: { onTracked: () => void }) {
  const [cnr,      setCnr]      = useState("");
  const [caseType, setCaseType] = useState("");
  const [err,      setErr]      = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: { cnr: string; case_type?: string }) =>
      apiFetch("/court-intel/track", { method: "POST", body }),
    onSuccess: () => {
      setCnr(""); setCaseType(""); setErr("");
      queryClient.invalidateQueries({ queryKey: ["tracked-cases"] });
      onTracked();
    },
    onError: (e: any) => {
      setErr(e?.detail ?? e?.message ?? "Failed to add CNR. Check the number and try again.");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cnr.replace(/[\s\-/]/g, "").toUpperCase();
    if (cleaned.length !== 16) {
      setErr("CNR must be exactly 16 characters — e.g. TLHC010012342023");
      return;
    }
    setErr("");
    mutation.mutate({ cnr: cleaned, case_type: caseType || undefined });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl p-5 space-y-4"
      style={{ background: "#14151F", border: "1px solid rgba(245,183,84,0.15)" }}>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(245,183,84,0.12)" }}>
          <Plus className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Track a New Case</p>
          <p className="text-[11px] text-white/40">Enter the 16-character CNR from eCourts or your court notice</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* CNR input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            data-testid="cnr-input"
            type="text"
            value={cnr}
            onChange={(e) => { setCnr(e.target.value.toUpperCase()); setErr(""); }}
            placeholder="e.g. TLHC010012342023"
            maxLength={20}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/30 text-white text-sm font-mono
              placeholder:text-white/25 outline-none focus:ring-1 focus:ring-amber-400/30 transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.08)", letterSpacing: "0.05em" }}
          />
        </div>
        {/* Case type */}
        <select value={caseType} onChange={(e) => setCaseType(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-black/30 text-sm text-white/70 outline-none
            appearance-none min-w-[150px]"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <option value="">Type (optional)</option>
          {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" disabled={mutation.isPending || !cnr.trim()}
          data-testid="track-btn"
          className="font-semibold text-sm px-5 shrink-0"
          style={{ background: "#F5B754", color: "#0A0B10" }}>
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Tracking…</>
            : <><Plus className="w-4 h-4 mr-2" />Track</>}
        </Button>
      </div>

      <AnimatePresence>
        {err && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{err}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

/* ── Timeline / events panel ───────────────────────────────────────────────── */
function TimelinePanel({ caseId, tier }: { caseId: string; tier: string }) {
  const isPaid = tier === "professional" || tier === "advocate_pro";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["case-timeline", caseId],
    queryFn: () => apiFetch(`/court-intel/${caseId}/timeline`),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="py-6 flex justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-amber-400/60" />
    </div>
  );

  if (isError || !data) return (
    <div className="py-4 text-center text-xs text-white/40">
      <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-red-400/60" />
      Could not load timeline.
    </div>
  );

  /* No snapshot yet — API was offline during initial fetch */
  if (!data.latest_status && data.livetrack_tier !== undefined) return (
    <div className="rounded-xl p-4 text-center space-y-2"
      style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)" }}>
      <AlertTriangle className="w-4 h-4 text-blue-400/60 mx-auto" />
      <p className="text-xs text-white/40">
        No case data yet — eCourts India API was unreachable during the last fetch.
      </p>
      <p className="text-[11px] text-white/25">
        Use the <span className="text-blue-400/70">Retry</span> button on the card to try again,
        or check back after the nightly refresh at 08:00 IST.
      </p>
    </div>
  );

  /* Free tier — show latest snapshot + upgrade prompt */
  if (!isPaid && data.upgrade_hint) return (
    <div className="space-y-3">
      {data.latest_status && (
        <div className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(245,183,84,0.06)", border: "1px solid rgba(245,183,84,0.12)" }}>
          <p className="text-[11px] font-bold text-amber-400/60 uppercase tracking-wider">Latest Snapshot</p>
          <div className="flex items-center gap-3 flex-wrap">
            {data.latest_status.case_status && <StatusBadge status={data.latest_status.case_status} />}
            {data.latest_status.next_hearing_date && (
              <span className="text-xs text-white/60 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400/60" />
                Next: <span className="text-amber-400 font-semibold ml-0.5">{data.latest_status.next_hearing_date}</span>
              </span>
            )}
          </div>
        </div>
      )}
      <div className="rounded-xl p-4 text-center space-y-2.5"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
        <Lock className="w-5 h-5 text-violet-400 mx-auto" />
        <p className="text-xs text-white/50 max-w-xs mx-auto">{data.upgrade_hint}</p>
        <Link href="/subscription">
          <Button size="sm" className="text-xs"
            style={{ background: "rgba(139,92,246,0.2)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Sparkles className="w-3 h-3 mr-1.5" />Upgrade to LiveTrack
          </Button>
        </Link>
      </div>
    </div>
  );

  /* Paid tier — full timeline */
  const events: any[] = data.events ?? [];

  return (
    <div className="space-y-4">
      {data.latest_status && (
        <div className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(245,183,84,0.06)", border: "1px solid rgba(245,183,84,0.12)" }}>
          <p className="text-[11px] font-bold text-amber-400/60 uppercase tracking-wider">Current Status</p>
          <div className="flex items-center gap-3 flex-wrap">
            {data.latest_status.case_status && <StatusBadge status={data.latest_status.case_status} />}
            {data.latest_status.next_hearing_date && (
              <span className="text-xs text-white/60 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400/60" />
                Next hearing: <span className="text-amber-400 font-semibold ml-0.5">{data.latest_status.next_hearing_date}</span>
              </span>
            )}
            {data.latest_status.order_count > 0 && (
              <span className="text-xs text-white/30">{data.latest_status.order_count} orders</span>
            )}
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Event Log</p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {events.map((ev: any, i: number) => {
              const { Icon, color } = eventMeta(ev.event_type);
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}18` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white capitalize">
                      {ev.event_type.replace(/_/g, " ")}
                    </p>
                    {ev.summary && (
                      <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{ev.summary}</p>
                    )}
                    <p className="text-[10px] text-white/25 mt-1">
                      {new Date(ev.detected_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-white/30">
          <Activity className="w-4 h-4 mx-auto mb-1 text-white/20" />
          No events detected yet — system checks nightly at 08:00 IST.
        </div>
      )}
    </div>
  );
}

/* ── Single tracked-case card ─────────────────────────────────────────────── */
function TrackedCaseCard({ tc }: { tc: any }) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/court-intel/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracked-cases"] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/court-intel/${id}/refresh`, { method: "POST" }),
    onSuccess: () => {
      // Wait 35s for the background task (15s timeout × 2 attempts + buffer)
      // then re-fetch so last_refreshed is visible in the card
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["tracked-cases"] }), 35_000);
    },
  });

  const noData = !tc.last_refreshed && !tc.case_status;

  const lastRefreshed = tc.last_refreshed
    ? new Date(tc.last_refreshed).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
    : "Not fetched yet";

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "#14151F", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Demo data banner */}
      {tc.data_source?.toLowerCase().includes("demo") && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-amber-400/80"
            style={{ background: "rgba(245,183,84,0.08)", border: "1px solid rgba(245,183,84,0.15)" }}>
            <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
            <span>Live eCourts data unavailable — illustrative data shown. Visit{" "}
              <a href="https://ecourts.gov.in" target="_blank" rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-300">ecourts.gov.in</a>{" "}
              for real-time status.
            </span>
          </div>
        </div>
      )}

      {/* No-data offline banner */}
      {noData && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
            style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.15)" }}>
            <span className="text-[11px] text-blue-300/70 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 text-blue-400/70" />
              eCourts data not fetched yet — API may be offline.
            </span>
            <button
              data-testid={`retry-${tc.cnr}`}
              onClick={() => retryMutation.mutate(tc.id)}
              disabled={retryMutation.isPending}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors
                flex items-center gap-1 shrink-0 disabled:opacity-50">
              {retryMutation.isPending
                ? <><Loader2 className="w-3 h-3 animate-spin" />Fetching…</>
                : <><RefreshCw className="w-3 h-3" />Retry</>}
            </button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(96,165,250,0.1)" }}>
            <CalendarSearch className="w-5 h-5 text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white tracking-wider">{tc.cnr}</span>
              {tc.case_status && <StatusBadge status={tc.case_status} />}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {tc.case_type && (
                <span className="text-[11px] text-white/40 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{tc.case_type}
                </span>
              )}
              {tc.court_name && (
                <span className="text-[11px] text-white/35 truncate max-w-[160px]">{tc.court_name}</span>
              )}
              {tc.next_hearing_date && (
                <span className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{tc.next_hearing_date}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <RefreshCw className="w-2.5 h-2.5 text-white/20" />
              <span className="text-[10px] text-white/25">Updated {lastRefreshed}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button data-testid={`expand-${tc.cnr}`}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Hide timeline" : "View timeline"}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5">
              {expanded
                ? <ChevronUp   className="w-4 h-4 text-white/40" />
                : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>
            <button data-testid={`remove-${tc.cnr}`}
              onClick={() => removeMutation.mutate(tc.id)}
              disabled={removeMutation.isPending}
              title="Stop tracking"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all
                hover:bg-red-500/10 text-white/30 hover:text-red-400">
              {removeMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2  className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline panel — slides open */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            className="overflow-hidden">
            <div className="px-5 py-4">
              <TimelinePanel caseId={tc.id} tier={user?.subscription_tier ?? "free"} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function CnrTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["tracked-cases"],
    queryFn: () => apiFetch("/court-intel/my-cases"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const cases: any[] = data?.cases ?? [];

  function handleTracked() {
    setToast("Case added — fetching live data in background…");
    setTimeout(() => setToast(""), 4000);
  }

  if (!user) return (
    <>
      <SEOHelmet title="CNR Case Tracker" description="Track live court cases via eCourts India." canonical="/cnr-tracker" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <CalendarSearch className="w-12 h-12 text-white/20 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Sign in to track cases</h2>
          <Button onClick={() => (window.location.href = "/login")}
            style={{ background: "#F5B754", color: "#0A0B10" }}>Sign in</Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <SEOHelmet
        title="CNR Case Tracker — Live eCourts Intelligence"
        description="Track court cases in real-time via eCourts India. Get alerts on hearing dates, orders, and status changes."
        canonical="/cnr-tracker"
      />
      <PageShell
        title="CNR Case Tracker"
        subtitle="Live court intelligence — paste a CNR to watch hearings, orders and status changes."
        action={
          <button onClick={() => refetch()} disabled={isFetching} data-testid="refresh-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              text-white/50 hover:text-white/80"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        }>

        <div className="space-y-5 pb-20 md:pb-0">
          {/* Add-CNR form */}
          <CnrInput onTracked={handleTracked} />

          {/* Success toast */}
          <AnimatePresence>
            {toast && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34D399" }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />{toast}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upgrade nudge for free users who have cases */}
          {user.subscription_tier === "free" && cases.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)" }}>
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300">
                Free plan shows latest status only.{" "}
                <Link href="/subscription" className="underline underline-offset-2 hover:text-violet-200">
                  Upgrade to LiveTrack
                </Link>{" "}
                for full event history, hearing alerts &amp; AI predictions.
              </p>
            </div>
          )}

          {/* Cases list */}
          <div className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">
                Tracked Cases{cases.length > 0 && <span className="ml-2 text-white/20">({cases.length})</span>}
              </p>
            </div>

            {isLoading && (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400/40" />
              </div>
            )}

            {isError && (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
                style={{ background: "#14151F", border: "1px solid rgba(255,255,255,0.07)" }}>
                <AlertTriangle className="w-8 h-8 text-red-400/60" />
                <p className="text-sm text-white/50">Could not load tracked cases.</p>
                <Button size="sm" variant="ghost" onClick={() => refetch()}
                  className="text-white/40 hover:text-white/70 text-xs">Try again</Button>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {!isLoading && !isError && cases.map((tc: any) => (
                <TrackedCaseCard key={tc.id} tc={tc} />
              ))}
            </AnimatePresence>

            {/* Empty state */}
            {!isLoading && !isError && cases.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
                style={{ background: "#14151F", border: "1px dashed rgba(255,255,255,0.08)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(245,183,84,0.08)" }}>
                  <CalendarSearch className="w-8 h-8 text-amber-400/30" />
                </div>
                <div>
                  <p className="text-base font-bold text-white/60">No cases tracked yet</p>
                  <p className="text-sm text-white/30 mt-1 max-w-xs">
                    Enter a CNR above to start tracking live hearing dates, orders, and status changes from eCourts India.
                  </p>
                </div>
                <p className="text-xs text-white/20 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Find your CNR on your court notice or at{" "}
                  <a href="https://ecourts.gov.in" target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-white/40">
                    ecourts.gov.in
                  </a>
                </p>
              </motion.div>
            )}
          </div>

          {/* How it works (shown only when empty) */}
          {!isLoading && cases.length === 0 && (
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "#14151F", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">How It Works</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { Icon: Plus,      color: "#F5B754", title: "Add CNR",      desc: "Paste your 16-character Case Number from eCourts or court notice" },
                  { Icon: RefreshCw, color: "#34D399", title: "Auto Refresh", desc: "Polls eCourts nightly at 08:00 IST — or tap Refresh anytime" },
                  { Icon: Activity,  color: "#8B5CF6", title: "Get Alerts",   desc: "Hearing rescheduled, order passed? You're notified first" },
                ].map(({ Icon, color, title, desc }) => (
                  <div key={title} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}12` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <p className="text-xs font-bold text-white/60">{title}</p>
                    <p className="text-[11px] text-white/30 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
