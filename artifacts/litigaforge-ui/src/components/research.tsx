import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Bookmark, BookmarkCheck, Loader2, Trash2, Check, X, ExternalLink, Eye, EyeOff,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const USERNAME_RE = /^[a-z][a-z0-9_]{2,29}$/;

interface BookmarkStatus {
  bookmarked: boolean;
  notes: string;
}

// ── Reusable username claim form ─────────────────────────────────────────────
export function ClaimUsernameForm({
  onClaimed,
  hideHint,
}: {
  onClaimed?: (username: string) => void;
  hideHint?: boolean;
}) {
  const { refreshUser } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name = value.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) {
      setError("3–30 characters, start with a letter; lowercase letters, numbers and underscores only.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/research/username", {
        method: "POST",
        body: JSON.stringify({ username: name }),
      });
      await refreshUser();
      onClaimed?.(res.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set username.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground">@</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-testid="input-username"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button type="submit" size="sm" disabled={saving} data-testid="button-claim-username">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Claim"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600" data-testid="username-error">{error}</p>}
      {!error && !hideHint && (
        <p className="text-xs text-muted-foreground">
          You'll get a public, shareable portfolio at <span className="font-mono">/profile/&lt;username&gt;/research</span>
        </p>
      )}
    </form>
  );
}

// ── Modal wrapper used by the "My Research" header button ────────────────────
export function ClaimUsernameDialog({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary" /> Claim your research username
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a unique username to unlock your public, shareable research portfolio.
            </p>
          </div>
          <button onClick={onClose} data-testid="button-close-claim" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ClaimUsernameForm
          onClaimed={(u) => {
            onClose();
            setLocation(`/profile/${u}/research`);
          }}
        />
      </div>
    </div>
  );
}

// ── "My Research" header button (logged-in only) ─────────────────────────────
export function MyResearchButton() {
  const { user, refreshUser } = useAuth();
  const [showClaim, setShowClaim] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const visibilityMut = useMutation({
    mutationFn: (isPublic: boolean) =>
      apiFetch("/research/visibility", {
        method: "PUT",
        body: JSON.stringify({ is_public: isPublic }),
      }),
    onMutate: () => setVisibilityError(""),
    onSuccess: async () => {
      await refreshUser();
    },
    onError: (err) => {
      setVisibilityError(
        err instanceof Error ? err.message : "Could not update portfolio visibility.",
      );
    },
  });
  if (!user) return null;

  if (user.username) {
    const isPublic = user.is_profile_public !== false;
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/profile/${user.username}/research`}
          data-testid="link-my-research"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors"
        >
          <Bookmark className="w-4 h-4" /> My Research
        </Link>
        <button
          type="button"
          onClick={() => visibilityMut.mutate(!isPublic)}
          disabled={visibilityMut.isPending}
          aria-pressed={isPublic}
          aria-label={`Research portfolio is ${isPublic ? "public" : "private"}. Make it ${isPublic ? "private" : "public"}.`}
          title={visibilityError || `Portfolio ${isPublic ? "public" : "private"} — click to change`}
          data-testid="button-research-visibility"
          className={
            "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors disabled:cursor-wait disabled:opacity-60 " +
            (visibilityError
              ? "border-red-300 bg-red-50 text-red-700"
              : isPublic
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary")
          }
        >
          {visibilityMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPublic ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
          {isPublic ? "Public" : "Private"}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowClaim(true)}
        data-testid="button-open-claim"
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Bookmark className="w-4 h-4" /> My Research
      </button>
      {showClaim && <ClaimUsernameDialog onClose={() => setShowClaim(false)} />}
    </>
  );
}

// ── "Save to research" control for a single judgment ─────────────────────────
export function SaveToResearch({ judgmentId }: { judgmentId: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const statusKey = ["research-bookmark", judgmentId];
  const { data: status, isLoading } = useQuery<BookmarkStatus>({
    queryKey: statusKey,
    queryFn: () => apiFetch(`/research/bookmarks/${judgmentId}`),
    enabled: !!user,
    retry: false,
  });

  const bookmarked = !!status?.bookmarked;

  // Keep the textarea in sync with the server notes whenever the panel opens
  // or the saved notes change underneath us.
  useEffect(() => {
    if (open) setNotes(status?.notes ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMut = useMutation({
    mutationFn: (n: string) =>
      apiFetch("/research/bookmarks", {
        method: "POST",
        body: JSON.stringify({ judgment_id: judgmentId, notes: n }),
      }),
    onSuccess: (data: { notes: string }) => {
      qc.setQueryData<BookmarkStatus>(statusKey, { bookmarked: true, notes: data.notes });
    },
  });

  const removeMut = useMutation({
    mutationFn: () => apiFetch(`/research/bookmarks/${judgmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData<BookmarkStatus>(statusKey, { bookmarked: false, notes: "" });
      setNotes("");
      setOpen(false);
    },
  });

  // Logged-out: invite to sign in.
  if (!user) {
    return (
      <Link
        href="/login"
        data-testid="button-save-research-signin"
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Bookmark className="w-4 h-4" /> Sign in to save
      </Link>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        data-testid="button-toggle-save-research"
        className={
          "inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border transition-colors " +
          (bookmarked
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card hover:border-primary/40 hover:text-primary")
        }
      >
        {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        {bookmarked ? "Saved to research" : "Save to research"}
      </button>

      {open && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-xl" data-testid="panel-save-research">
          <label className="block text-xs font-semibold text-muted-foreground">
            Your private note (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Why does this judgment matter to your research?"
            data-testid="textarea-research-notes"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => saveMut.mutate(notes)}
              disabled={saveMut.isPending}
              data-testid="button-save-research"
            >
              {saveMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Check className="w-4 h-4 mr-1.5" /> {bookmarked ? "Update note" : "Save"}</>
              )}
            </Button>
            {bookmarked && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeMut.mutate()}
                disabled={removeMut.isPending}
                data-testid="button-remove-research"
                className="text-red-600 hover:text-red-700"
              >
                {removeMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Trash2 className="w-4 h-4 mr-1.5" /> Remove</>
                )}
              </Button>
            )}
          </div>

          {/* Portfolio link / claim prompt */}
          {bookmarked && (
            <div className="pt-3 border-t border-border/60">
              {user.username ? (
                <Link
                  href={`/profile/${user.username}/research`}
                  data-testid="link-view-portfolio"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  View my research portfolio <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Claim a username to get a public, shareable portfolio of your saved cases:
                  </p>
                  <ClaimUsernameForm hideHint />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
