import { motion } from "framer-motion";

export interface ConfidenceRow {
  /** Model / source name. */
  label: string;
  /** 0–100 confidence value. */
  value: number;
}

export interface ConfidenceBarsProps {
  /** Per-model confidence read-out (multi-AI synthesis). */
  rows: ConfidenceRow[];
  className?: string;
  "data-testid"?: string;
}

/**
 * ConfidenceBars — a multi-AI synthesis read-out: one animated navy→gold bar
 * per model (Claude / Gemini / GPT-5).
 */
export function ConfidenceBars({
  rows,
  className,
  "data-testid": testId = "confidence-bars",
}: ConfidenceBarsProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`} data-testid={testId}>
      {rows.map((r, i) => {
        const v = Math.max(0, Math.min(100, r.value));
        return (
          <div key={r.label} className="flex items-center gap-3">
            <div className="cfos-docket w-28 shrink-0 text-right">{r.label}</div>
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--cfos-gold)))" }}
                initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.1 * i, ease: "easeOut" }} />
            </div>
            <div className="cfos-mono w-9 text-sm font-semibold text-foreground">{v}</div>
          </div>
        );
      })}
    </div>
  );
}
