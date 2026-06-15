import { type ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: ReactNode;
  action?: React.ReactNode;
}

export function PageShell({ title, subtitle, icon, children, action }: PageShellProps) {
  return (
    <div className="space-y-6 px-4 md:px-6 py-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight flex items-center gap-3">
            {icon}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
