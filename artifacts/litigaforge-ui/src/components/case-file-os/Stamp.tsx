import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export interface StampProps {
  children?: ReactNode;
  /** Override the leading icon (defaults to a shield check). */
  icon?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Stamp — a rotated "VERIFIED"-style impression for trust signals
 * (bar-verified lawyers, authenticated documents).
 */
export function Stamp({
  children = "Bar-verified",
  icon,
  className,
  "data-testid": testId = "stamp",
}: StampProps) {
  return (
    <span
      className={`cfos-stamp inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold ${className ?? ""}`}
      data-testid={testId}
    >
      {icon ?? <ShieldCheck className="w-3 h-3" />} {children}
    </span>
  );
}
