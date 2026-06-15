export interface DocketItem {
  label: string;
  value: string;
}

export interface DocketHeaderProps {
  /** Key/value metadata pairs rendered as a monospace docket strip. */
  items: DocketItem[];
  className?: string;
  "data-testid"?: string;
}

/**
 * DocketHeader — a monospace metadata strip (case no, court, filed date…).
 * The signature "file header" device of Case File OS.
 */
export function DocketHeader({
  items,
  className,
  "data-testid": testId = "docket-header",
}: DocketHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${className ?? ""}`}
      data-testid={testId}
    >
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <span className="cfos-docket">{label}</span>
          <span className="cfos-mono text-sm font-semibold text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}
