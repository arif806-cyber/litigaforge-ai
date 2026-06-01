import { ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function LegalDisclaimerBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex-shrink-0 w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2.5 z-50",
        className
      )}
    >
      <div className="flex items-start gap-2.5 max-w-7xl mx-auto">
        <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">Disclaimer:</span>{" "}
          This is an AI assistant only. All outputs should be verified by a qualified lawyer. Not a substitute for professional legal advice. No attorney-client relationship is created.
        </p>
      </div>
    </div>
  );
}

export function LegalDisclaimerFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex-shrink-0 w-full border-t border-border bg-card px-4 py-4",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span>
            This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/blog">
            <span className="text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer whitespace-nowrap text-xs">
              Legal Guides
            </span>
          </Link>
          <Link href="/privacy">
            <span className="text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer whitespace-nowrap text-xs">
              Privacy Policy
            </span>
          </Link>
          <Link href="/terms">
            <span className="text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer whitespace-nowrap text-xs">
              Terms
            </span>
          </Link>
          <span className="text-muted-foreground/60 whitespace-nowrap">
            LitigaForge AI
          </span>
        </div>
      </div>
    </footer>
  );
}
