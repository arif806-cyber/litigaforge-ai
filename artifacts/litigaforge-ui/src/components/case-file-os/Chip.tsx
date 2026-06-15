import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Chip — a compact metadata pill (location, next hearing, document type).
 */
export function Chip({ icon, children, className, "data-testid": testId = "chip" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-secondary-foreground ${className ?? ""}`}
      data-testid={testId}
    >
      {icon}{children}
    </span>
  );
}
