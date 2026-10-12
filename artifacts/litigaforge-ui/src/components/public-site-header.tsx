import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Scale, X } from "lucide-react";
import { cn } from "@/lib/utils";

const publicLinks = [
  { href: "/judgments", label: "Judgments" },
  { href: "/lawyers", label: "Find a Lawyer" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type PublicSiteLink = { href: string; label: string };
type PublicSiteHeaderProps = {
  links?: PublicSiteLink[];
  actions?: ReactNode;
  mobileActions?: ReactNode;
  mobileMenu?: boolean;
};

export function PublicSiteHeader({
  links = publicLinks,
  actions,
  mobileActions,
  mobileMenu = false,
}: PublicSiteHeaderProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const renderLink = ({ href, label }: PublicSiteLink, mobile = false) => {
    const active = location === href || (href !== "/" && !href.startsWith("#") && location.startsWith(`${href}/`));
    const className = cn(
      "flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium transition-colors duration-200",
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      mobile && "w-full",
    );
    const onClick = mobileMenu && mobile ? () => setMenuOpen(false) : undefined;
    return href.startsWith("#")
      ? <a key={`${mobile ? "mobile-" : ""}${href}`} href={href} onClick={onClick} className={className}>{label}</a>
      : <Link key={`${mobile ? "mobile-" : ""}${href}`} href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={className}>{label}</Link>;
  };
  return (
    <header className={cn("public-site-header sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl", mobileMenu && "lf-public-home-header")}>
      <div className="public-site-header-inner mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="LitigaForge AI home" className="flex min-h-11 shrink-0 items-center gap-2.5 text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Scale className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.04em]">LitigaForge <span className="text-primary">AI</span></span>
        </Link>
        <nav aria-label="Main navigation" className={cn("flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap", mobileMenu && "hidden md:flex")}>
          {links.map((link) => renderLink(link))}
        </nav>
        <div className={cn("min-w-0 items-center gap-2", mobileMenu ? "hidden md:flex" : "flex")}>
          {actions ?? (
            <Link href="/login" className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:-translate-y-px">
              Sign in
            </Link>
          )}
        </div>
        {mobileMenu && (
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
      </div>
      {mobileMenu && menuOpen && (
        <div className="public-site-mobile-menu border-t border-border bg-background px-4 py-3 md:hidden">
          <nav aria-label="Main navigation" className="grid gap-1">
            {links.map((link) => renderLink(link, true))}
          </nav>
          <div
            className="mt-3 grid gap-3 border-t border-border pt-3"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            {mobileActions ?? actions ?? (
              <Link href="/login" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicSiteFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={cn("public-site-footer border-t border-border bg-card", className)}>{children}</footer>;
}

export function PublicPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicSiteHeader mobileMenu />
      {children}
    </>
  );
}
