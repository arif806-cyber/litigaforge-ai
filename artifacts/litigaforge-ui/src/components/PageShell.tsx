import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: ReactNode;
  action?: React.ReactNode;
  compactMobileHeader?: boolean;
}

export function PageShell({ title, subtitle, icon, children, action, compactMobileHeader = false }: PageShellProps) {
  return (
    <div
      data-testid="page-shell"
      className={[
        "mx-auto w-full max-w-7xl px-4 md:px-6",
        compactMobileHeader
          ? "space-y-0 sm:space-y-0 md:space-y-5 pt-0 pb-4 sm:pb-5 md:pt-5"
          : "space-y-5 py-4 sm:space-y-6 sm:py-5",
      ].filter(Boolean).join(" ")}
    >
      <div
        data-testid="page-shell-header"
        className={[
          "flex items-start justify-between gap-3 flex-wrap",
          compactMobileHeader ? "border-b-0 pb-0 md:border-b md:border-border/60 md:pb-4" : "border-b border-border/60 pb-4",
        ].filter(Boolean).join(" ")}
      >
        <div className="min-w-0 flex-1">
          <h1 className="lf-page-title hidden min-w-0 flex-wrap items-center gap-2 text-xl font-bold leading-tight text-foreground md:flex md:gap-3 md:text-[30px] md:leading-9">
            {icon}
            <span className="min-w-0 break-words">{title}</span>
          </h1>
          {subtitle && <p className="hidden text-sm text-muted-foreground mt-0.5 md:block">{subtitle}</p>}
        </div>
        {action && <div className="w-full md:w-auto [&_button]:w-full md:[&_button]:w-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}
