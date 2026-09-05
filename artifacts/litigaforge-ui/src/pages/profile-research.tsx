import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SEOHelmet } from "@/components/SEOHelmet";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { Button } from "@/components/ui/button";
import {
  Scale, Loader2, Landmark, CalendarDays, BookOpen, ArrowLeft,
  Link2, Check, NotebookPen, EyeOff,
} from "lucide-react";

interface ProfileJudgment {
  id: number;
  case_name: string;
  court: string;
  court_slug: string;
  year: number;
  slug: string;
  outcome: string;
  judgment_date: string | null;
  citation: string;
  path: string;
}

interface ProfileBookmark {
  judgment: ProfileJudgment;
  notes: string;
  saved_at: string | null;
}

interface ProfileData {
  username: string;
  name: string;
  is_profile_public?: boolean;
  count: number;
  bookmarks: ProfileBookmark[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function ProfileResearch() {
  const params = useParams();
  const username = params.username ?? "";
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const ownerUsername = user?.username?.toLowerCase();
  const isOwner = Boolean(ownerUsername && ownerUsername === username.toLowerCase());

  const { data, isLoading, isError } = useQuery<ProfileData>({
    queryKey: ["research-profile", username, isOwner ? "owner" : "public"],
    queryFn: () =>
      apiFetch(isOwner ? "/research/me" : `/research/profile/${username}`),
    enabled: Boolean(username),
    retry: false,
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading research portfolio…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 max-w-2xl mx-auto px-4 py-24 text-center space-y-5">
          <Scale className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Profile not found or private</h1>
          <p className="text-sm text-muted-foreground">
            This research portfolio doesn't exist or its owner has made it private.
          </p>
          <Link href="/judgments">
            <Button data-testid="link-back-judgments">
              <ArrowLeft className="w-4 h-4 mr-2" /> Explore Judgment Digest
            </Button>
          </Link>
        </div>
        <LegalDisclaimerFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet
        title={`@${data.username}'s Legal Research Portfolio | LitigaForge`}
        description={`${data.name} has researched ${data.count} ${data.count === 1 ? "judgment" : "judgments"} on LitigaForge — browse their saved case law and notes.`}
        canonical={`/profile/${data.username}/research`}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 space-y-8" data-testid="page-profile-research">
        {/* Profile header */}
        <header className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary flex-shrink-0">
            {initials(data.name)}
          </div>
          <div className="space-y-2 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight" data-testid="text-profile-name">
              {data.name}
            </h1>
            <p className="text-sm font-mono text-muted-foreground" data-testid="text-profile-username">@{data.username}</p>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span
                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                data-testid="badge-cases-researched"
              >
                <BookOpen className="w-4 h-4" /> Cases Researched: {data.count}
              </span>
              {isOwner && data.is_profile_public === false ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground"
                  data-testid="badge-private-profile"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Private — only you can see this
                </span>
              ) : (
                <button
                  onClick={copyLink}
                  data-testid="button-copy-profile-link"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Link2 className="w-3.5 h-3.5" /> Share profile</>}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Bookmarks */}
        {data.bookmarks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center space-y-3" data-testid="empty-research">
            <Scale className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No saved judgments yet.</p>
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Saved Judgments</h2>
            <div className="space-y-3">
              {data.bookmarks.map((b) => (
                <article
                  key={b.judgment.id}
                  data-testid={`research-item-${b.judgment.id}`}
                  className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1.5">
                      <Landmark className="w-3 h-3" /> {b.judgment.court}
                    </span>
                    {b.saved_at && (
                      <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" /> Saved {formatDate(b.saved_at)}
                      </span>
                    )}
                  </div>

                  <Link
                    href={b.judgment.path}
                    data-testid={`link-judgment-${b.judgment.id}`}
                    className="block group"
                  >
                    <h3 className="text-base md:text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors font-serif">
                      {b.judgment.case_name}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
                    {b.judgment.citation && <span className="font-mono">{b.judgment.citation}</span>}
                    {b.judgment.outcome && <span className="text-amber-700">{b.judgment.outcome}</span>}
                  </div>

                  {b.notes && (
                    <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3">
                      <p className="text-sm text-foreground/85 leading-relaxed flex gap-2">
                        <NotebookPen className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span className="whitespace-pre-wrap">{b.notes}</span>
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-muted-foreground border-t border-border/60 pt-5 leading-relaxed">
          This is a personal research portfolio of saved case-law summaries on LitigaForge. Summaries are
          AI-assisted and provided for general information only — not legal advice.
        </p>
      </main>

      <LegalDisclaimerFooter />
    </div>
  );
}
