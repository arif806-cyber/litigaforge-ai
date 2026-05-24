import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  FileText, MapPin, Clock, EyeOff, ArrowRight, Plus,
  Search, Filter, Loader2, AlertTriangle, PenSquare, X, Check
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
};

const CASE_TYPES = [
  "Property Dispute", "Family Matter", "Criminal", "Civil", "Consumer",
  "Labour", "Tax", "IP / Trademark", "Other"
];

export default function MyCases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCase, setEditingCase] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", case_type: "", description: "", location: "", budget_range: "", is_anonymous: false });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => apiFetch("/cases/requirements/mine"),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; body: any }) => apiFetch(`/cases/requirements/${vars.id}`, { method: "PATCH", body: vars.body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-cases"] });
      setEditingCase(null);
    },
  });

  if (!user) {
    return (<>
      <SEOHelmet title="My Cases" description="Track your posted cases, match proposals, and lawyer responses." canonical="/my-cases" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Sign In Required</h2>
          <Button onClick={() => window.location.href = "/login"}>Sign In</Button>
        </div>
      </div>
    </>);
  }

  const cases = data?.cases ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-5xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Legal Requirements</h1>
          <p className="text-muted-foreground mt-1">
            Cases you have posted and proposals received from lawyers.
          </p>
        </div>
        <Link href="/post-case">
          <Button data-testid="new-case-button">
            <Plus className="w-4 h-4 mr-2" />
            Post New Case
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-destructive">Failed to load your cases</h3>
          <p className="text-sm text-muted-foreground max-w-md text-center">{(error as Error)?.message ?? "Please try again."}</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No Cases Posted Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Post your first legal requirement to connect with verified lawyers in your area.
          </p>
          <Link href="/post-case">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Post a Case
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c: any, i: number) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    {c.is_anonymous && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <EyeOff className="w-3 h-3" /> Anonymous
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {c.case_type}
                    </span>
                    {c.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {c.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", STATUS_COLORS[c.status] || STATUS_COLORS.open)}>
                    {c.status?.toUpperCase()}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      setEditingCase(c);
                      setEditForm({
                        title: c.title || "",
                        case_type: c.case_type || "",
                        description: c.description || "",
                        location: c.location || "",
                        budget_range: c.budget_range || "",
                        is_anonymous: c.is_anonymous || false,
                      });
                    }}
                    data-testid={`edit-case-${c.id}`}
                  >
                    <PenSquare className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Link href={`/matches?case=${c.id}`}>
                    <Button variant="outline" size="sm">
                      Find Lawyers
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingCase && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setEditingCase(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-card border border-card-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Edit Case Requirement</h3>
                <button onClick={() => setEditingCase(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">Case Type</label>
                  <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={editForm.case_type} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))}>
                    {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Location</label>
                    <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Budget</label>
                    <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={editForm.budget_range} onChange={e => setEditForm(f => ({ ...f, budget_range: e.target.value }))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm.is_anonymous} onChange={e => setEditForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                  <EyeOff className="w-3.5 h-3.5" /> Post anonymously
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingCase(null)}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: editingCase.id, body: editForm })}
                  data-testid="save-edit-case"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Save Changes
                </Button>
              </div>
              {updateMutation.isError && (
                <p className="text-xs text-destructive text-center">{(updateMutation.error as Error)?.message}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
