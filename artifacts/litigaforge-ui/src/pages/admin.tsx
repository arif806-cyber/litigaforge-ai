import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle, XCircle, RotateCcw, Users, Briefcase,
  Search, Loader2, AlertTriangle, Clock
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
  created_at: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"pending" | "users">("pending");
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

      <div className="flex gap-2 border-b border-border">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={Briefcase} label="Pending Lawyers" />
        <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users} label="All Users" />
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
        ) : (
          <UsersTab key="users" queryClient={queryClient} />
        )}
      </AnimatePresence>
    </div>
  );
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
                <Badge label={lawyer.district} />
                <Badge label={`${lawyer.experience_years} yrs`} />
                {lawyer.practice_areas?.map((area) => (
                  <Badge key={area} label={area} />
                ))}
              </div>
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
