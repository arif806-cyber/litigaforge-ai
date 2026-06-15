import type { ElementType, ReactNode } from "react";

export interface PaperSurfaceProps {
  children: ReactNode;
  /** Depth level: 1 resting, 2 raised card, 3 floating dialog. */
  elevation?: 1 | 2 | 3;
  /** Apply the faint ruled "legal paper" texture (uses .cfos-paper). */
  ruled?: boolean;
  /** Render as a different element (e.g. "section", "article"). */
  as?: ElementType;
  className?: string;
  "data-testid"?: string;
}

/**
 * PaperSurface — a depth-aware card surface. Three elevation levels plus an
 * optional ruled-paper texture give the interface the feel of stacked legal
 * paper.
 */
export function PaperSurface({
  children,
  elevation = 2,
  ruled = false,
  as,
  className,
  "data-testid": testId = "paper-surface",
}: PaperSurfaceProps) {
  const Tag = as ?? "div";
  const depth = ruled ? "cfos-paper" : `cfos-elev-${elevation}`;
  return (
    <Tag
      className={`rounded-xl border border-border ${ruled ? "" : "bg-card"} ${depth} ${className ?? ""}`}
      data-testid={testId}
    >
      {children}
    </Tag>
  );
}
