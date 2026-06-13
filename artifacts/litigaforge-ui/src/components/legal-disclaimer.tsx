import { ShieldAlert, Scale } from "lucide-react";
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

const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Legal Tools",
    links: [
      { label: "Ask a Lawyer (AI)", href: "/ask" },
      { label: "Document Analyzer", href: "/review" },
      { label: "Judgment Finder", href: "/judgments" },
      { label: "Free Documents", href: "/free-documents" },
    ],
  },
  {
    heading: "Find Help",
    links: [
      { label: "Find a Lawyer", href: "/lawyers" },
      { label: "Post a Case", href: "/post-case" },
      { label: "Free Legal Aid", href: "/legal-aid" },
      { label: "Pricing", href: "/subscription" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Legal Guides", href: "/blog" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  },
];

export function LegalDisclaimerFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn(
        "flex-shrink-0 w-full border-t border-border bg-card",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-base text-foreground">
              <Scale className="w-5 h-5 text-primary" />
              <span>LitigaForge AI</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-3 max-w-xs">
              AI-powered legal answers and verified lawyer matching. Built for clients and advocates who want clarity, fast.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-3">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>
                      <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                        {l.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer + copyright */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col gap-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              This platform only connects users and provides AI-generated information — not legal advice. Any final attorney-client relationship is directly between the client and the lawyer. Always verify outputs with a qualified advocate.
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            &copy; {year} LitigaForge AI. All rights reserved. LitigaForge AI is not a law firm and does not provide legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
