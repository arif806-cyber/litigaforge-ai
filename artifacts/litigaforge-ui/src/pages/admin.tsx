import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle, XCircle, RotateCcw, Users, Briefcase,
  Search, Loader2, AlertTriangle, Clock, MessageSquare, Activity, Mail
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PendingLawyer {
  id: number;
  name: string;
  email: string;
  phone: string;
  bar_number: string;
  bar_council?: string | null;
  courts_practised?: string[] | null;
  district: string;
  practice_areas: string[];
  experience_years: number;
  created_at: string;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  subscription_tier: string;
  cases_this_month: number;
  is_superuser: boolean;
  email_verified: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"pending" | "advocates" | "questions" | "users" | "ecourts" | "ik" | "mcp">("pending");
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<number | null>(null);
  const queryClient = useQueryClient();

  if (loading) {
    return (<>
      <SEOHelmet title="Admin Dashboard" description="Manage lawyer verifications, users, and platform administration." canonical="/admin" />
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </>);
  }

  if (!user?.is_superuser) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <EmailTestPanel />

      <div className="flex gap-2 border-b border-border">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={Briefcase} label="Pending Lawyers" />
        <TabButton active={tab === "advocates"} onClick={() => setTab("advocates")} icon={Users} label="All Advocates" />
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")} icon={MessageSquare} label="Question Moderation" />
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="All Users" />
        <TabButton active={tab === "ecourts"} onClick={() => setTab("ecourts")} icon={Activity} label="eCourts Usage" />
        <TabButton active={tab === "ik"} onClick={() => setTab("ik")} icon={Activity} label="Indian Kanoon Usage" />
        <TabButton active={tab === "mcp"} onClick={() => setTab("mcp")} icon={Activity} label="MCP Plans & Usage" />
      </div>

      <AnimatePresence mode="wait">
        {tab === "pending" ? (
          <PendingLawyersTab
            key="pending"
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            showRejectInput={showRejectInput}
            setShowRejectInput={setShowRejectInput}
            queryClient={queryClient}
          />
        ) : tab === "advocates" ? (
          <AllAdvocatesTab key="advocates" queryClient={queryClient} />
        ) : tab === "questions" ? (
          <QuestionModerationTab key="questions" queryClient={queryClient} />
        ) : tab === "users" ? (
          <UsersTab key="users" queryClient={queryClient} />
        ) : tab === "mcp" ? (
          <McpPlansUsageTab key="mcp" />
        ) : tab === "ik" ? (
          <IndianKanoonUsageTab key="ik" />
        ) : (
          <EcourtsUsageTab key="ecourts" />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailTestPanel() {
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const sendTest = useMutation({
    mutationFn: () => apiFetch("/admin/email/test", { method: "POST" }),
    onSuccess: (result: any) => {
      setNotice({ ok: true, text: `Test email sent to ${result.sent_to}.` });
    },
    onError: (error: unknown) => {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Email test failed." });
    },
  });
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="font-semibold">Outgoing email</h2>
        <p className="text-sm text-muted-foreground">Send a test message to your admin email address.</p>
        {notice && <p role={notice.ok ? "status" : "alert"} className={`mt-2 text-sm ${notice.ok ? "text-emerald-600" : "text-destructive"}`}>{notice.text}</p>}
      </div>
      <Button type="button" variant="outline" disabled={sendTest.isPending} onClick={() => {
        setNotice(null);
        sendTest.mutate();
      }}>
        {sendTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
        {sendTest.isPending ? "Sending…" : "Send test email"}
      </Button>
    </section>
  );
}

function IndianKanoonUsageTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-indian-kanoon-usage"],
    queryFn: () => apiFetch("/ik/admin/costs").then((value) => value as {
      costs: Array<{ feature: string; calls: number; today_cost_inr: number; month_cost_inr: number }>;
      today_total_inr: number; month_total_inr: number; daily_cap_inr: number; remaining_today_inr: number;
    }),
    refetchInterval: 60_000,
  });
  const inr = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading Indian Kanoon usage…</div>;
  if (isError || !data) return <div className="space-y-3 p-6"><p className="text-sm text-destructive">Could not load Indian Kanoon usage.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>;
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-lg border border-border p-4"><div className="text-sm text-muted-foreground">Today</div><div className="text-xl font-semibold">{inr(data.today_total_inr)}</div></article>
      <article className="rounded-lg border border-border p-4"><div className="text-sm text-muted-foreground">This month</div><div className="text-xl font-semibold">{inr(data.month_total_inr)}</div></article>
      <article className="rounded-lg border border-border p-4"><div className="text-sm text-muted-foreground">Daily cap / remaining</div><div className="text-xl font-semibold">{inr(data.daily_cap_inr)} / {inr(data.remaining_today_inr)}</div></article>
    </div>
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Feature</th><th className="p-3">Calls this month</th><th className="p-3">Today</th><th className="p-3">This month</th></tr></thead>
      <tbody>{data.costs.map((row) => <tr key={row.feature} className="border-b border-border last:border-0"><td className="p-3">{row.feature}</td><td className="p-3">{row.calls}</td><td className="p-3">{inr(row.today_cost_inr)}</td><td className="p-3">{inr(row.month_cost_inr)}</td></tr>)}</tbody></table>
      {!data.costs.length && <p className="p-4 text-sm text-muted-foreground">No Indian Kanoon API usage recorded this month.</p>}
    </div>
  </section>;
}

function EcourtsUsageTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-ecourts-usage"],
    queryFn: () => apiFetch("/admin/ecourts/usage").then((value) => value as {
      started_at: string;
      persistence: string;
      days: Array<{ date: string; calls: number; estimated_credits: number; endpoints: Record<string, { calls: number; estimated_credits: number }> }>;
    }),
    refetchInterval: 60_000,
  });
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading API usage…</div>;
  if (isError || !data) return <div className="space-y-3 p-6"><p className="text-sm text-destructive">Could not load eCourts usage.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>;
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        Credit figures are estimates from successful partner requests. Usage is held in server memory since <strong>{new Date(data.started_at).toLocaleString()}</strong> and resets when the API process restarts.
      </div>
      {data.days.length === 0 ? <p className="rounded-lg border border-border p-5 text-sm text-muted-foreground">No successful partner requests have been recorded in this process.</p> :
        data.days.map((day) => (
          <article key={day.date} className="rounded-lg border border-border p-4">
            <div className="flex justify-between gap-3"><h2 className="font-semibold">{day.date}</h2><span>{day.calls} calls · {day.estimated_credits.toFixed(2)} estimated credits</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(day.endpoints).map(([name, stats]) => <div key={name} className="flex justify-between rounded bg-muted/50 px-3 py-2 text-sm"><span>{name}</span><span>{stats.calls} · {stats.estimated_credits.toFixed(2)} cr</span></div>)}
            </div>
          </article>
        ))
      }
    </section>
  );
}

function AllAdvocatesTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-all-advocates"],
    queryFn: () => apiFetch("/admin/lawyers"),
  });
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: number; kind: "hide" | "restore" | "revoke-verification" }) =>
      apiFetch(`/admin/lawyers/${id}/${kind}`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-all-advocates"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-pending-lawyers"] }),
      ]);
    },
  });
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (isError) return <div className="flex flex-col items-center gap-3 py-12"><AlertTriangle className="w-8 h-8 text-destructive" /><p>{(error as Error)?.message || "Could not load advocates."}</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>;
  const advocates = data?.lawyers ?? [];
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{data?.total ?? advocates.length} advocate profiles, including hidden and verified profiles.</p>
    {advocates.map((advocate: any) => <div key={advocate.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{advocate.name || "Unnamed advocate"} {advocate.admin_hidden && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">Hidden</span>}</p>
        <p className="text-sm text-muted-foreground">{advocate.email} · {advocate.district || "No district"}</p>
        <p className="text-xs text-muted-foreground">{advocate.verified ? "Verified" : `Not verified (${advocate.verification_status || "unknown"})`}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {advocate.admin_hidden
          ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: advocate.id, kind: "restore" })}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>
          : <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: advocate.id, kind: "hide" })}>Hide from directory</Button>}
        {advocate.verified && <Button size="sm" variant="destructive" disabled={action.isPending} onClick={() => {
          if (window.confirm(`Revoke verification for ${advocate.name || "this advocate"}?`)) action.mutate({ id: advocate.id, kind: "revoke-verification" });
        }}>Revoke verification</Button>}
      </div>
    </div>)}
    {action.isError && <p role="alert" className="text-sm text-destructive">The advocate update failed. Please retry.</p>}
  </div>;
}

function QuestionModerationTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-pending-questions"],
    queryFn: () => apiFetch("/admin/questions/pending"),
  });
  const approve = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/questions/${id}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending-questions"] }),
  });
  const reject = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/questions/${id}/reject`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending-questions"] }),
  });
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <AlertTriangle className="w-8 h-8 text-destructive" />
      <p className="text-destructive">{(error as Error)?.message || "Failed to load moderation queue."}</p>
      <Button variant="outline" onClick={() => refetch()}>Retry</Button>
    </div>
  );
  const questions = data?.questions || [];
  if (!questions.length) return <div className="text-center py-16 text-muted-foreground">No questions awaiting review.</div>;
  return <div className="space-y-4">
    {questions.map((question: any) => (
      <div key={question.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Private original — admin only</p>
          <p className="text-sm">{question.question}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Redacted public version</p>
          <p className="text-sm font-medium">{question.public_question}</p>
          <p className="text-sm whitespace-pre-line mt-3 pt-3 border-t border-border">{question.public_answer}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => approve.mutate(question.id)} disabled={approve.isPending || reject.isPending}>
            <CheckCircle className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => reject.mutate(question.id)} disabled={approve.isPending || reject.isPending}>
            <XCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      </div>
    ))}
  </div>;
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function PendingLawyersTab({
  rejectReason,
  setRejectReason,
  showRejectInput,
  setShowRejectInput,
  queryClient,
}: {
  rejectReason: Record<number, string>;
  setRejectReason: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  showRejectInput: number | null;
  setShowRejectInput: React.Dispatch<React.SetStateAction<number | null>>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-pending-lawyers"],
    queryFn: () => apiFetch("/admin/lawyers/pending"),
    retry: 2,
  });

  const approveMutation = useMutation({
    mutationFn: (lawyerId: number) => apiFetch(`/admin/lawyers/${lawyerId}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending-lawyers"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiFetch(`/admin/lawyers/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pending-lawyers"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 gap-3"
      >
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-base font-semibold text-destructive">Failed to load pending lawyers</p>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message || "Unknown error"}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-2 gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </Button>
      </motion.div>
    );
  }

  const lawyers: PendingLawyer[] = data?.lawyers || [];

  if (lawyers.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground"
      >
        <CheckCircle className="w-10 h-10 text-emerald-500" />
        <p className="text-lg font-medium">No pending verifications</p>
        <p className="text-sm">All advocate registrations have been reviewed.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-2 gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4"
    >
      {lawyers.map((lawyer) => (
        <div
          key={lawyer.id}
          className="border border-border rounded-xl p-5 bg-card shadow-sm space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-base">{lawyer.name}</h3>
              <p className="text-sm text-muted-foreground">{lawyer.email} • {lawyer.phone}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge label={`Bar #${lawyer.bar_number}`} />
                {lawyer.bar_council && <Badge label={lawyer.bar_council} />}
                <Badge label={lawyer.district} />
                <Badge label={`${lawyer.experience_years} yrs`} />
                {lawyer.practice_areas?.map((area) => (
                  <Badge key={area} label={area} />
                ))}
              </div>
              {!!lawyer.courts_practised?.length && (
                <p className="text-xs text-muted-foreground">Courts: {lawyer.courts_practised.join(", ")}</p>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {new Date(lawyer.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => approveMutation.mutate(lawyer.id)}
              disabled={approveMutation.isPending}
              data-testid={`approve-lawyer-${lawyer.id}`}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve
            </Button>

            {showRejectInput === lawyer.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Reason for rejection..."
                  value={rejectReason[lawyer.id] || ""}
                  onChange={(e) => setRejectReason((prev) => ({ ...prev, [lawyer.id]: e.target.value }))}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    rejectMutation.mutate({ id: lawyer.id, reason: rejectReason[lawyer.id] || "" });
                    setShowRejectInput(null);
                  }}
                  disabled={rejectMutation.isPending}
                  data-testid={`reject-lawyer-${lawyer.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRejectInput(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowRejectInput(lawyer.id)}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            )}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function UsersTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users"),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) => apiFetch(`/admin/users/${userId}/reset-usage`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const verifyMutation = useMutation({
    mutationFn: (userId: number) => apiFetch(`/admin/users/${userId}/verify-email`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const users: AdminUser[] = data?.users || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Tier</th>
              <th className="text-left px-4 py-3 font-medium">Cases</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    {u.name}
                    {u.is_superuser && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        <Shield className="w-3 h-3" />
                        ADMIN
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="capitalize px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {u.subscription_tier}
                  </span>
                </td>
                <td className="px-4 py-3">{u.cases_this_month}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {!u.email_verified && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mr-1 h-7 text-xs"
                      onClick={() => verifyMutation.mutate(u.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" /> Verify
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => resetMutation.mutate(u.id)}
                    disabled={resetMutation.isPending}
                    data-testid={`reset-usage-${u.id}`}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
      {label}
    </span>
  );
}

function McpPlansUsageTab() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [toolsText, setToolsText] = useState<Record<string, string>>({});
  const [capsText, setCapsText] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [setupLink, setSetupLink] = useState("");
  const plansQuery = useQuery({ queryKey: ["admin-mcp-plans"], queryFn: () => apiFetch("/admin/mcp-plans"), retry: false });
  const usageQuery = useQuery({ queryKey: ["admin-mcp-usage"], queryFn: () => apiFetch("/admin/mcp-usage"), retry: false });
  const reviewerAudit = useQuery({ queryKey: ["admin-mcp-reviewer-audit"], queryFn: () => apiFetch("/admin/mcp-reviewer-audit"), retry: false });
  const inviteReviewer = useMutation({
    mutationFn: () => apiFetch("/admin/mcp-reviewers", { method: "POST", body: { email: reviewerEmail } }),
    onSuccess: async (result: any) => {
      setSetupLink(result.setup_url);
      setReviewerEmail("");
      setNotice(`Reviewer ${result.created ? "created" : "upgraded"} with 30-day access, all tools, and a 200-call daily limit.`);
      await reviewerAudit.refetch();
    },
    onError: (error: unknown) => setNotice(error instanceof Error ? error.message : "Could not provision reviewer access."),
  });
  const plans = plansQuery.data?.plans || {};
  const update = (id: string, field: string, value: any) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || plans[id]), [field]: value } }));
  };
  const save = async (id: string) => {
    try {
      const config = { ...(drafts[id] || plans[id]) };
      config.tools = (toolsText[id] ?? (config.tools || []).join(",")).split(",").map((x: string) => x.trim()).filter(Boolean);
      config.tool_daily_caps = JSON.parse(capsText[id] ?? JSON.stringify(config.tool_daily_caps || {}));
      await apiFetch(`/admin/mcp-plans/${id}`, { method: "PUT", body: config });
      setNotice(`${id} settings saved.`);
      setDrafts((current) => ({ ...current, [id]: config }));
      await queryClient.invalidateQueries({ queryKey: ["admin-mcp-plans"] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save plan settings. Check the limits and JSON fields.");
    }
  };
  const numericFields = ["price_inr", "gst_percent", "daily_calls", "monthly_calls", "seats", "overage_inr"];
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">MCP plan settings</h2>
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Invite or upgrade a Reviewer</h3>
        <p className="text-sm text-muted-foreground">Creates or upgrades a real account with all MCP tools, 200 calls/day, and up to 30 days of access. A one-time password setup link is shown once; share it through a trusted channel.</p>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setSetupLink(""); inviteReviewer.mutate(); }}>
          <Input type="email" required value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)} placeholder="reviewer@company.example" className="min-w-64 flex-1" />
          <Button type="submit" disabled={inviteReviewer.isPending}>{inviteReviewer.isPending ? "Preparing…" : "Create setup link"}</Button>
        </form>
        {setupLink && <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">One-time link — expires in one hour. It is not saved here; copy it now and send it securely.</p>
          <Input readOnly value={setupLink} onFocus={(event) => event.currentTarget.select()} aria-label="One-time password setup link" />
        </div>}
        {reviewerAudit.data?.entries?.length > 0 && <div className="space-y-1">
          <h4 className="text-sm font-medium">Recent reviewer access changes</h4>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
            {reviewerAudit.data.entries.map((entry: any) => <li key={entry.id}>{new Date(entry.created_at).toLocaleString()} · {entry.action} · {entry.reviewer_email} · admin {entry.admin_email || "removed"}</li>)}
          </ul>
        </div>}
      </section>
      {plansQuery.isError && <p className="text-sm text-muted-foreground">MCP v2 may be disabled, or admin settings are unavailable.</p>}
      {Object.entries(plans).map(([id, original]: [string, any]) => {
        const plan = drafts[id] || original;
        return <section key={id} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold capitalize">{id.replaceAll("_", " ")}</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!plan.enabled} onChange={(e) => update(id, "enabled", e.target.checked)}
                disabled={id === "data_api"} /> Enabled
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {numericFields.map((field) => <label key={field} className="text-xs text-muted-foreground">
              {field.replaceAll("_", " ")}
              <input type="number" min="0" value={plan[field] ?? ""} onChange={(e) =>
                update(id, field, e.target.value === "" ? null : Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>)}
          </div>
          <label className="block text-xs text-muted-foreground">Allowed tool names (comma-separated)
            <input value={toolsText[id] ?? (plan.tools || []).join(",")} onChange={(e) =>
              setToolsText((current) => ({ ...current, [id]: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="block text-xs text-muted-foreground">Per-tool daily caps (JSON)
            <input value={capsText[id] ?? JSON.stringify(plan.tool_daily_caps || {})} onChange={(e) =>
              setCapsText((current) => ({ ...current, [id]: e.target.value }))}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground" />
          </label>
          <Button onClick={() => void save(id)}>Save {id} plan</Button>
        </section>;
      })}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold">Usage, cost and estimated revenue (this month)</h3>
        {usageQuery.isError && <p className="text-sm text-muted-foreground">Usage data is unavailable.</p>}
        <p className="text-sm">Estimated plan revenue: ₹{Number(usageQuery.data?.estimated_revenue_inr || 0).toLocaleString("en-IN")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr><th>User</th><th>Org</th><th>Plan</th><th>Calls</th><th>Cost</th><th>Revenue estimate</th><th>By tool</th></tr></thead>
            <tbody>{(usageQuery.data?.users || []).map((entry: any) => <tr key={entry.user_id} className="border-t border-border">
              <td className="py-2">{entry.email}</td><td>{entry.organization_id ?? "—"}</td><td>{entry.plan_id}</td><td>{entry.calls_this_month}</td>
              <td>₹{Number(entry.cost_inr).toFixed(2)}</td><td>₹{Number(entry.revenue_estimate_inr).toLocaleString("en-IN")}</td>
              <td>{Object.entries(entry.by_tool || {}).map(([tool, count]) => `${tool}: ${count}`).join(", ")}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
