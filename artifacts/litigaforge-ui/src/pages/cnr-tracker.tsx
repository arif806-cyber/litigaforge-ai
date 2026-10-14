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
import { currentCnrErrorMessage, normalizeCnrRefreshState } from "@/lib/cnr-refresh-state";
import { cn } from "@/lib/utils";
import { MobileSearchbar } from "@/components/mobile-primitives";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Link } from "wouter";

const CASE_TYPES = [
  "Civil", "Criminal", "Family", "Property", "Consumer",
  "Labour", "Tax", "Motor Accident", "Writ / PIL", "Other",
];

const EVENT_ICONS: Record<string, { color: string; Icon: React.ElementType }> = {
  hearing_scheduled: { Icon: Calendar,     color: "#F5B754" },
  hearing_adjourned: { Icon: Clock,        color: "#8B5CF6" },
  order_passed:      { Icon: Gavel,        color: "#34D399" },
  status_changed:    { Icon: Activity,     color: "var(--secondary-oklch)" },
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
      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25"
      : s.includes("pending") || s.includes("admit")
      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25"
      : s.includes("fresh") || s.includes("new")
      ? "bg-violet-500/10 text-violet-800 dark:text-violet-300 border-violet-500/25"
      : "bg-secondary/10 text-secondary border-secondary/25";

  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", cfg)}>
      {status}
    </span>
  );
}

function caseDateDisplay(status?: string, next?: string | null, last?: string | null, disposed?: string | null) {
  const closed = ["disposed", "closed", "completed"].some((s) => String(status ?? "").toLowerCase().includes(s));
  const nextText = next ? String(next).slice(0, 10) : null;
  const nextDate = nextText ? new Date(`${nextText}T00:00:00`) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextIsPast = !!nextDate && !Number.isNaN(nextDate.getTime()) && nextDate < today;

  if (closed) {
    if (disposed) return { label: "Disposed on", value: disposed };
    if (last || nextIsPast) return { label: "Last listed", value: last || nextText };
    return null;
  }
  if (nextIsPast) return { label: "Last listed", value: last || nextText };
  if (nextText) return { label: "Next hearing", value: nextText };
  return last ? { label: "Last listed", value: last } : null;
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
      setErr(currentCnrErrorMessage(e, "Failed to add CNR. Check the number and try again."));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cnr.replace(/[\s\-/]/g, "").toUpperCase();
    if (!/^[A-Z]{4}\d{12}$/.test(cleaned)) {
      setErr("CNR must be 4 letters followed by 12 digits — e.g. TLHC010012342023");
      return;
    }
    setErr("");
    mutation.mutate({ cnr: cleaned, case_type: caseType || undefined });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Track a New Case</p>
          <p className="text-[11px] text-muted-foreground">Enter the 16-character CNR from eCourts or your court notice</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* CNR input */}
        <div className="flex-1 relative">
          <MobileSearchbar
            className="md:hidden"
            value={cnr}
            onValueChange={(value) => { setCnr(value.toUpperCase()); setErr(""); }}
            placeholder="e.g. TLHC010012342023"
            inputId="cnr-input-mobile"
            testId="cnr-input-mobile"
          />
          <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            data-testid="cnr-input"
            type="text"
            value={cnr}
            onChange={(e) => { setCnr(e.target.value.toUpperCase()); setErr(""); }}
            placeholder="e.g. TLHC010012342023"
            maxLength={20}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-mono
              placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            style={{ letterSpacing: "0.05em" }}
          />
          </div>
        </div>
        {/* Case type */}
        <select value={caseType} onChange={(e) => setCaseType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm outline-none
            appearance-none min-w-[150px]">
          <option value="">Type (optional)</option>
          {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" disabled={mutation.isPending || !cnr.trim()}
          data-testid="track-btn"
          className="font-semibold text-sm px-5 shrink-0">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Tracking…</>
            : <><Plus className="w-4 h-4 mr-2" />Track</>}
        </Button>
      </div>

      <AnimatePresence>
        {err && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
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
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  if (isError || !data) return (
    <div className="py-4 text-center text-xs text-muted-foreground">
      <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-red-700 dark:text-red-300" />
      Could not load timeline.
    </div>
  );

  const refreshState = normalizeCnrRefreshState(data.refresh_status, data.refresh_error);
  const latestDate = data.latest_status
    ? caseDateDisplay(
        data.latest_status.case_status,
        data.latest_status.next_hearing_date,
        data.latest_status.last_listed_date,
        data.latest_status.disposal_date,
      )
    : null;

  /* No snapshot yet — report the current Partner API refresh state. */
  if (!data.latest_status && data.livetrack_tier !== undefined) return (
    <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
      <AlertTriangle className="w-4 h-4 text-secondary/60 mx-auto" />
      <p className="text-xs text-muted-foreground">
        {refreshState.status === "pending"
          ? "The eCourts India Partner API refresh is in progress."
          : refreshState.status === "failed"
            ? `The latest eCourts India Partner API refresh failed. ${refreshState.error || "Use Retry on the case card to try again."}`
            : "No successful eCourts India Partner API response is available for this case yet."}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Use the <span className="text-secondary">Retry</span> button on the case card to request a fresh Partner API check.
      </p>
    </div>
  );

  /* Free tier — show latest snapshot + upgrade prompt */
  if (!isPaid && data.upgrade_hint) return (
    <div className="space-y-3">
      {data.latest_status && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Latest Snapshot</p>
          <div className="flex items-center gap-3 flex-wrap">
            {data.latest_status.case_status && <StatusBadge status={data.latest_status.case_status} />}
            {latestDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" />
                {latestDate.label}: <span className="text-primary font-semibold ml-0.5">{latestDate.value}</span>
              </span>
            )}
          </div>
        </div>
      )}
      <div className="rounded-xl p-4 text-center space-y-2.5"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
        <Lock className="w-5 h-5 text-primary mx-auto" />
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">{data.upgrade_hint}</p>
        <Link href="/subscription">
          <Button size="sm" className="text-xs"
            style={{ background: "color-mix(in oklch, var(--primary-oklch) 20%, transparent)", color: "var(--primary-oklch)", border: "1px solid color-mix(in oklch, var(--primary-oklch) 30%, transparent)" }}>
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
        <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current Status</p>
          <div className="flex items-center gap-3 flex-wrap">
            {data.latest_status.case_status && <StatusBadge status={data.latest_status.case_status} />}
            {latestDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" />
                {latestDate.label}: <span className="text-primary font-semibold ml-0.5">{latestDate.value}</span>
              </span>
            )}
            {data.latest_status.order_count > 0 && (
              <span className="text-xs text-muted-foreground">{data.latest_status.order_count} orders</span>
            )}
          </div>
        </div>
      )}

      {events.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Event Log</p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {events.map((ev: any, i: number) => {
              const { Icon, color } = eventMeta(ev.event_type);
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `color-mix(in oklch, ${color} 10%, transparent)` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground capitalize">
                      {ev.event_type.replace(/_/g, " ")}
                    </p>
                    {ev.summary && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ev.summary}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(ev.detected_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-muted-foreground">
          <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracked-cases"] }),
  });
  const editCnrMutation = useMutation({
    mutationFn: ({ id, cnr }: { id: string; cnr: string }) =>
      apiFetch(`/court-intel/${id}`, { method: "PATCH", body: JSON.stringify({ cnr }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracked-cases"] }),
  });

  const refreshState = normalizeCnrRefreshState(tc.refresh_status, tc.refresh_error);
  const refreshPending = refreshState.status === "pending";
  const refreshFailed = refreshState.status === "failed";
  const cnrNotFound = tc.refresh_status === "cnr_not_found";
  const noSnapshot = !tc.last_refreshed && !tc.case_status;

  const lastRefreshed = tc.last_refreshed
    ? new Date(tc.last_refreshed).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
    : "Not fetched yet";
  const caseDate = caseDateDisplay(
    tc.case_status,
    tc.next_hearing_date,
    tc.last_listed_date,
    tc.disposal_date,
  );

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl overflow-hidden border border-border bg-card">

      <div className="px-4 pt-3 text-[11px] text-muted-foreground">
        Last successful fetch: <span className="text-foreground/80">{lastRefreshed}</span>
      </div>

      {(refreshPending || refreshFailed || noSnapshot) && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
            style={{
              background: refreshFailed ? "rgba(248,113,113,0.08)" : "rgba(96,165,250,0.07)",
              border: `1px solid ${refreshFailed ? "rgba(248,113,113,0.2)" : "rgba(96,165,250,0.15)"}`,
            }}>
            <span className={`text-[11px] flex items-start gap-1.5 ${refreshFailed ? "text-red-800 dark:text-red-300" : "text-muted-foreground"}`}>
               <AlertTriangle className={`w-3 h-3 shrink-0 mt-0.5 ${refreshFailed ? "text-red-700 dark:text-red-300" : "text-secondary"}`} />
              <span>
                {refreshFailed
                  ? `Latest eCourts India Partner API refresh failed. Previously saved data is unchanged. ${refreshState.error || ""}`
                  : refreshPending
                    ? "eCourts India Partner API refresh is in progress. Any previous successful data remains available."
                    : "No successful eCourts India Partner API response has been saved yet."}
              </span>
            </span>
            {cnrNotFound && (
              <button
                onClick={() => {
                  const cnr = window.prompt("Check or correct this CNR", tc.cnr);
                  if (cnr?.trim()) editCnrMutation.mutate({ id: tc.id, cnr: cnr.trim() });
                }}
                disabled={editCnrMutation.isPending}
                className="text-[11px] font-semibold text-secondary hover:text-secondary/80">
                {editCnrMutation.isPending ? "Saving…" : "Edit CNR"}
              </button>
            )}
            {!cnrNotFound && (refreshFailed || noSnapshot) && (
              <button
                data-testid={`retry-${tc.cnr}`}
                onClick={() => retryMutation.mutate(tc.id)}
                disabled={retryMutation.isPending}
                className="text-[11px] font-semibold text-secondary hover:text-secondary/80 transition-colors
                  flex items-center gap-1 shrink-0 disabled:opacity-50">
                {retryMutation.isPending
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Fetching…</>
                  : <><RefreshCw className="w-3 h-3" />Retry</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(96,165,250,0.1)" }}>
            <CalendarSearch className="w-5 h-5 text-secondary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-foreground tracking-wider">{tc.cnr}</span>
              {tc.case_status && <StatusBadge status={tc.case_status} />}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {tc.case_type && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{tc.case_type}
                </span>
              )}
              {tc.court_name && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{tc.court_name}</span>
              )}
              {caseDate && (
                <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{caseDate.label}: {caseDate.value}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Updated {lastRefreshed}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button data-testid={`expand-${tc.cnr}`}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Hide timeline" : "View timeline"}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-muted-foreground hover:bg-muted">
              {expanded
                ? <ChevronUp   className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
            </button>
            <button data-testid={`remove-${tc.cnr}`}
              onClick={() => removeMutation.mutate(tc.id)}
              disabled={removeMutation.isPending}
              title="Stop tracking"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all
                hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
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
            style={{ borderTop: "1px solid hsl(var(--border))" }}
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
    refetchInterval: (query) => {
      const rows = (query.state.data as { cases?: any[] } | undefined)?.cases ?? [];
      return rows.some((item) => item.refresh_status === "pending") ? 3_000 : false;
    },
    refetchIntervalInBackground: true,
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
          <CalendarSearch className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Sign in to track cases</h2>
          <Button onClick={() => (window.location.href = "/login")}>Sign in</Button>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-muted">
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
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-primary">
                Free plan shows latest status only.{" "}
                <Link href="/subscription" className="underline underline-offset-2 hover:text-primary/80">
                  Upgrade to LiveTrack
                </Link>{" "}
                for full event history, hearing alerts &amp; AI predictions.
              </p>
            </div>
          )}

          {/* Cases list */}
          <div className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Tracked Cases{cases.length > 0 && <span className="ml-2 text-muted-foreground">({cases.length})</span>}
              </p>
            </div>

            {isLoading && (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {isError && (
              <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="w-8 h-8 text-red-700 dark:text-red-300" />
                <p className="text-sm text-muted-foreground">Could not load tracked cases.</p>
                <Button size="sm" variant="ghost" onClick={() => refetch()}
                  className="text-muted-foreground hover:text-foreground text-xs">Try again</Button>
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
                className="rounded-2xl border border-dashed border-border bg-card p-10 flex flex-col items-center gap-4 text-center">
                <FeatureIcon feature="cnrTracker" size="large" />
                <div>
                  <p className="text-base font-bold text-foreground">No cases tracked yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Enter a CNR above to start tracking live hearing dates, orders, and status changes from eCourts India.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Find your CNR on your court notice or at{" "}
                  <a href="https://ecourts.gov.in" target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground">
                    ecourts.gov.in
                  </a>
                </p>
              </motion.div>
            )}
          </div>

          {/* How it works (shown only when empty) */}
          {!isLoading && cases.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">How It Works</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { Icon: Plus,      color: "#F5B754", title: "Add CNR",      desc: "Paste your 16-character Case Number from eCourts or court notice" },
                  { Icon: RefreshCw, color: "#34D399", title: "Auto Refresh", desc: "Polls eCourts nightly at 08:00 IST — or tap Refresh anytime" },
                  { Icon: Activity,  color: "#8B5CF6", title: "Get Alerts",   desc: "Hearing rescheduled, order passed? You're notified first" },
                ].map(({ Icon, color, title, desc }) => (
                  <div key={title} className="flex flex-col items-center text-center gap-2 rounded-xl border border-border bg-background p-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}12` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <p className="text-xs font-bold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
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
