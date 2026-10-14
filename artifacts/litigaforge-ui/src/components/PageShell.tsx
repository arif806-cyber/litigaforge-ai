import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: ReactNode;
  action?: React.ReactNode;
}

export function PageShell({ title, subtitle, icon, children, action }: PageShellProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 sm:space-y-6 sm:py-5 md:px-6">
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-border/60 pb-4">
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
