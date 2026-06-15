import { useId } from "react";
import { motion } from "framer-motion";
import { pt, arc } from "./geometry";

export interface ScoreRingProps {
  /** 0–100 score the dial fills to. */
  score: number;
  /** Docket label under the number (e.g. "Match", "Fit"). */
  label?: string;
  /** Pixel size of the square instrument. */
  size?: number;
  /** Hide the label to use the ring inline inside a card. */
  showLabel?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * ScoreRing — a 270° instrument dial with tick marks and a gold sweep.
 * Used for AI match / fit scores. The gradient id is namespaced with
 * useId() so multiple rings on one page never collide.
 */
export function ScoreRing({
  score,
  label = "Match",
  size = 184,
  showLabel = true,
  className,
  "data-testid": testId = "score-ring",
}: ScoreRingProps) {
  const cx = 100, cy = 100, r = 76;
  const start = 225, sweep = 270;
  const gradId = `cfosScore-${useId()}`;
  const ticks = Array.from({ length: 11 }, (_, i) => start + (sweep / 10) * i);
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ width: size, height: size }}
      data-testid={testId}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`${label} score ${clamped} out of 100`}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--cfos-gold))" />
            <stop offset="100%" stopColor="hsl(var(--cfos-gold-soft))" />
          </linearGradient>
        </defs>
        {ticks.map((a, i) => {
          const [x1, y1] = pt(cx, cy, 88, a);
          const [x2, y2] = pt(cx, cy, i % 5 === 0 ? 80 : 84, a);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(var(--muted-foreground) / .45)" strokeWidth={i % 5 === 0 ? 2 : 1} />
          );
        })}
        <path d={arc(cx, cy, r, start, start + sweep)} fill="none"
          stroke="hsl(var(--muted-foreground) / .18)" strokeWidth="9" strokeLinecap="round" />
        <motion.path d={arc(cx, cy, r, start, start + sweep)} fill="none"
          stroke={`url(#${gradId})`} strokeWidth="9" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: clamped / 100 }}
          viewport={{ once: true }} transition={{ duration: 1.3, ease: [0.22, 0.61, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="cfos-mono font-bold leading-none text-foreground" style={{ fontSize: size * 0.26 }}>{clamped}</div>
        {showLabel && (
          <div className="cfos-docket mt-1.5" style={{ color: "hsl(var(--cfos-gold))" }}>{label} score</div>
        )}
      </div>
    </div>
  );
}
