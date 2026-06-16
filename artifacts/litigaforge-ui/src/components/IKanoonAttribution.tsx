import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const IK_HOME = "https://indiankanoon.org";

/** Indian Kanoon's API Terms of Service require visible attribution wherever
 *  their judgment content is displayed. Render this badge on any page that
 *  shows data sourced from Indian Kanoon. */
export function isIndianKanoon(source?: string | null): boolean {
  return !!source && source.toLowerCase().includes("kanoon");
}

/** `source_url` is untrusted (DB/API ingestion), so validate strictly before
 *  using it as an href: only http(s) URLs on the indiankanoon.org domain are
 *  allowed, otherwise fall back to the Indian Kanoon home page. This blocks
 *  `javascript:` and look-alike hosts (e.g. evil.test/?u=indiankanoon.org). */
function safeIndianKanoonHref(sourceUrl?: string | null): string {
  if (!sourceUrl) return IK_HOME;
  try {
    const u = new URL(sourceUrl);
    const okScheme = u.protocol === "http:" || u.protocol === "https:";
    const okHost =
      u.hostname === "indiankanoon.org" || u.hostname.endsWith(".indiankanoon.org");
    return okScheme && okHost ? u.href : IK_HOME;
  } catch {
    return IK_HOME;
  }
}

interface IKanoonAttributionProps {
  /** Only renders when this names Indian Kanoon (e.g. "IndianKanoon"). */
  sourceName?: string | null;
  /** Deep-links to the specific judgment on indiankanoon.org when available. */
  sourceUrl?: string | null;
  className?: string;
}

export function IKanoonAttribution({ sourceName, sourceUrl, className }: IKanoonAttributionProps) {
  if (!isIndianKanoon(sourceName)) return null;

  const href = safeIndianKanoonHref(sourceUrl);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="attribution-indiankanoon"
      aria-label="Powered by Indian Kanoon"
      title="Powered by Indian Kanoon"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
        className,
      )}
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Scale className="h-3.5 w-3.5" />
      </span>
      {/* "Powered by" label hides on mobile, keeping a compact icon + wordmark */}
      <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
        Powered by
      </span>
      <span className="text-sm font-bold leading-none tracking-tight">
        <span className="text-foreground">Indian</span>
        <span className="text-primary">Kanoon</span>
      </span>
    </a>
  );
}
