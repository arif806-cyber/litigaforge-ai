import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft, ArrowRight, Loader2, ExternalLink, ChevronDown,
  Scale, Gavel, CalendarDays, Landmark, BookOpen, Share2,
  Link2, Check, MessageSquareText, FileText,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SaveToResearch } from "@/components/research";
import { IKanoonAttribution } from "@/components/IKanoonAttribution";
import { useAuth } from "@/lib/auth-context";

interface RelatedItem {
  case_name: string;
  court: string;
  court_slug: string;
  year: number;
  slug: string;
  outcome: string;
  judgment_date: string | null;
  path: string;
}

interface JudgmentDetail {
  id: number;
  case_name: string;
  court: string;
  court_slug: string;
  bench?: string;
  judgment_date: string | null;
  year: number;
  slug: string;
  full_text: string;
  summary_en: string;
  summary_hi: string;
  acts_cited: string[];
  outcome: string;
  citation: string;
  source_name?: string;
  source_url?: string;
  og_image_url: string;
  path: string;
  url: string;
  related: RelatedItem[];
  text_complete?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function Paragraph({ text }: { text: string }) {
  const m = text.match(/^([A-Z][A-Za-z ]{2,20}):\s+([\s\S]*)$/);
  if (m) {
    return (
      <p className="text-[15px] leading-relaxed text-foreground/80">
        <span className="font-bold text-foreground">{m[1]}: </span>
        {m[2]}
      </p>
    );
  }
  return <p className="text-[15px] leading-relaxed text-foreground/80">{text}</p>;
}

export default function JudgmentDetail() {
  const { user } = useAuth();
  const params = useParams();
  const court = params.court ?? "";
  const year = params.year ?? "";
  const slug = params.slug ?? "";
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: j, isLoading, isError } = useQuery<JudgmentDetail>({
    queryKey: ["judgment-detail", court, year, slug],
    queryFn: () => apiFetch(`/judgments/item/${court}/${year}/${slug}`),
    enabled: Boolean(court && year && slug),
    retry: false,
  });

  // Tolerant fallback: if the exact URL is missing, ask the API for the
  // canonical one and auto-forward (truncated / wrong-court / stray-keyword
  // links keep working). The api-server already 301s most full-page loads;
  // this also covers in-app navigation to a stale link.
  const [, setLocation] = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (!isError || !court || !year || !slug) return;
    let cancelled = false;
    setRedirecting(true);
    apiFetch(`/judgments/resolve/${court}/${year}/${slug}`)
      .then((res: { path?: string }) => {
        if (cancelled) return;
        const here = `/judgments/${court}/${year}/${slug}`;
        if (res?.path && res.path !== here) setLocation(res.path, { replace: true });
        else setRedirecting(false);
      })
      .catch(() => {
        if (!cancelled) setRedirecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isError, court, year, slug, setLocation]);

  const shareUrl = j?.url ?? "";
  const shareText = j ? `${j.case_name} — ${j.outcome || "Judgment summary"} | LitigaForge` : "";

  const share = (network: "whatsapp" | "twitter" | "linkedin") => {
    if (!shareUrl) return;
    const encUrl = encodeURIComponent(shareUrl);
    const encText = encodeURIComponent(shareText);
    const map = {
      whatsapp: `https://wa.me/?text=${encText}%20${encUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
    };
    window.open(map[network], "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  if (isLoading || redirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading judgment…</p>
      </div>
    );
  }

  if (isError || !j) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-5">
        <Scale className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Judgment not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn't find this judgment. It may have been moved or removed.
        </p>
        <Link href="/judgments">
          <Button data-testid="link-back-digest"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Judgment Digest</Button>
        </Link>
      </div>
    );
  }

  const summaryShort = (j.summary_en || "").slice(0, 200);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: j.case_name,
        description: summaryShort,
        datePublished: j.judgment_date || undefined,
        dateModified: j.judgment_date || undefined,
        image: j.og_image_url,
        inLanguage: "en",
        author: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
        publisher: {
          "@type": "Organization",
          name: "LitigaForge AI",
          logo: { "@type": "ImageObject", url: "https://litigaforge.com/og-image.png" },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": j.url },
      },
      {
        "@type": "LegalCase",
        name: j.case_name,
        url: j.url,
        ...(j.citation ? { alternateName: j.citation } : {}),
        ...(j.court ? { about: j.court } : {}),
      },
    ],
  };

  const fullParas = (j.full_text || "").split(/\n\n+/).map(s => s.trim()).filter(Boolean);

  return (<>
    <SEOHelmet
      title={`${j.case_name} (${j.year}) — ${j.court} | LitigaForge`}
      description={j.summary_en?.slice(0, 160) || `${j.case_name}: ${j.outcome}`}
      canonical={j.path}
      ogImage={j.og_image_url}
      keywords={`${j.case_name}, ${j.citation}, ${j.court}, judgment summary, case law`}
      structuredData={structuredData}
    />

    <article className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-8">
      {/* back link */}
      <Link
        href="/judgments"
        data-testid="link-back-digest"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Judgment Digest
      </Link>

      {/* header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1.5">
            <Landmark className="w-3 h-3" /> {j.court}
          </span>
          {j.judgment_date && (
            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> {formatDate(j.judgment_date)}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight font-serif">
          {j.case_name}
        </h1>

        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-sm text-muted-foreground">
          {j.citation && (
            <span className="font-mono">{j.citation}</span>
          )}
          {j.bench && (
            <span className="inline-flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5" /> {j.bench}</span>
          )}
        </div>

        {j.outcome && (
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <Scale className="w-4 h-4 text-amber-600" />
            {j.outcome}
          </div>
        )}
        <span
          data-testid="judgment-text-status"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border",
            j.text_complete === false
              ? "text-amber-800 bg-amber-50 border-amber-200"
              : "text-emerald-800 bg-emerald-50 border-emerald-200",
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          {j.text_complete === false ? "Text incomplete — verify with source" : "Text complete"}
        </span>
      </header>

      {/* save to research */}
      <SaveToResearch judgmentId={j.id} />

      {/* share row */}
      <div className="flex items-center gap-2 flex-wrap border-y border-border/60 py-3">
        <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5 mr-1">
          <Share2 className="w-3.5 h-3.5" /> Share
        </span>
        <button onClick={() => share("whatsapp")} data-testid="share-whatsapp" className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors">WhatsApp</button>
        <button onClick={() => share("twitter")} data-testid="share-twitter" className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors">X / Twitter</button>
        <button onClick={() => share("linkedin")} data-testid="share-linkedin" className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors">LinkedIn</button>
        <button onClick={copyLink} data-testid="share-copy" className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors inline-flex items-center gap-1.5">
          {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Link2 className="w-3.5 h-3.5" /> Copy link</>}
        </button>
      </div>

      {/* English summary */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Summary
        </h2>
        <p className="text-base leading-relaxed text-foreground/85">{j.summary_en}</p>
      </section>

      {/* Hindi summary */}
      {j.summary_hi && (
        <section className="space-y-3 bg-muted/30 border border-border/60 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground tracking-wider flex items-center gap-2">
            <span className="text-primary">हिंदी सारांश</span>
          </h2>
          <p className="text-base leading-relaxed text-foreground/85" lang="hi">{j.summary_hi}</p>
        </section>
      )}

      {/* Acts cited */}
      {j.acts_cited?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Acts & Provisions Cited
          </h2>
          <div className="flex flex-wrap gap-2">
            {j.acts_cited.map((a, i) => (
              <span key={i} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-card border border-border text-foreground/80">
                {a}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Full text (collapsible) */}
      {fullParas.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowFull(v => !v)}
            data-testid="toggle-full-text"
            className="w-full flex items-center justify-between gap-3 text-left bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 transition-colors"
          >
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              <Gavel className="w-4 h-4 text-primary" /> Full Judgment Notes
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showFull && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showFull && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 bg-background border border-border rounded-xl p-5">
                  {fullParas.map((p, i) => <Paragraph key={i} text={p} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Ask AI CTA */}
      <section className="bg-gradient-to-br from-primary/5 to-amber-50 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary" /> Questions about this case?
          </h2>
          <p className="text-sm text-muted-foreground">Ask our AI how this precedent could apply to your situation.</p>
        </div>
        <Link href="/legal-chat">
          <Button data-testid="cta-ask-ai" className="shadow-sm flex-shrink-0">
            Ask AI <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </section>

      <section className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Build this into your case strategy</h2>
          <p className="text-sm text-muted-foreground mt-1">Open a visual Workspace to connect this precedent with facts and arguments.</p>
        </div>
        <Link href={user ? "/workspace" : "/register?role=advocate&next=/workspace"}>
          <Button data-testid="cta-open-workspace" className="flex-shrink-0">
            Open in Workspace <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </section>

      {/* Source */}
      {j.source_url && (
        <a
          href={j.source_url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-source"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          View full text on {j.source_name ?? "the source"} <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {/* Related */}
      {j.related?.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-border/60">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Related Judgments</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {j.related.map(r => (
              <Link
                key={`${r.court_slug}-${r.year}-${r.slug}`}
                href={r.path}
                data-testid={`related-${r.slug}`}
                className="group block bg-card rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.court}</span>
                  {r.judgment_date && <span className="text-[10px] text-muted-foreground">· {r.year}</span>}
                </div>
                <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {r.case_name}
                </h3>
                {r.outcome && <p className="text-xs text-amber-700 mt-1.5 line-clamp-1">{r.outcome}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* disclaimer */}
      <p className="text-xs text-muted-foreground border-t border-border/60 pt-5 leading-relaxed">
        This summary is provided for general information only and is AI-assisted. It is not legal advice.
        Always verify the judgment with the official reporter or {j.source_name ?? "the source"} before relying on or citing it in court.
      </p>

      {/* IndianKanoon attribution (required by their API Terms of Service) */}
      <div className="flex justify-start">
        <IKanoonAttribution sourceName={j.source_name} sourceUrl={j.source_url} />
      </div>
    </article>
  </>);
}
