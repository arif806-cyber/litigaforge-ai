import { motion } from "framer-motion";
import { pt, arc } from "./geometry";

export interface RiskMeterProps {
  /** 0–100 risk value; needle sweeps green → amber → red. */
  value?: number;
  /** Pixel width of the gauge. */
  size?: number;
  /** Hide the "Risk index" caption. */
  showLabel?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * RiskMeter — a 180° gauge with green/amber/red zones and a needle.
 * Used for document / case risk indices.
 */
export function RiskMeter({
  value = 28,
  size = 184,
  showLabel = true,
  className,
  "data-testid": testId = "risk-meter",
}: RiskMeterProps) {
  const cx = 100, cy = 100, r = 74;
  const a0 = 270, span = 180;
  const clamped = Math.max(0, Math.min(100, value));
  const needle = a0 + (span * clamped) / 100;
  const [nx, ny] = pt(cx, cy, r - 8, needle);
  const [sx, sy] = pt(cx, cy, r - 8, a0);
  const zones: [number, number, string][] = [
    [0, 33, "hsl(var(--cfos-good))"],
    [33, 66, "hsl(var(--cfos-warn))"],
    [66, 100, "hsl(var(--cfos-risk))"],
  ];

  return (
    <div
      className={`flex flex-col items-center ${className ?? ""}`}
      style={{ width: size }}
      data-testid={testId}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Risk index ${clamped} out of 100`}
    >
      <svg viewBox="0 0 200 116" className="w-full">
        {zones.map(([s, e, c], i) => (
          <path key={i} d={arc(cx, cy, r, a0 + (span * s) / 100, a0 + (span * e) / 100)}
            fill="none" stroke={c} strokeWidth="10" strokeLinecap="butt" opacity={0.85} />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const a = a0 + (span / 8) * i;
          const [x1, y1] = pt(cx, cy, 84, a);
          const [x2, y2] = pt(cx, cy, 90, a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground) / .5)" strokeWidth="1.5" />;
        })}
        <motion.line x1={cx} y1={cy} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round"
          initial={{ x2: sx, y2: sy }} whileInView={{ x2: nx, y2: ny }} viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }} />
        <circle cx={cx} cy={cy} r="6" fill="hsl(var(--foreground))" />
        <circle cx={cx} cy={cy} r="2.5" fill="hsl(var(--card))" />
      </svg>
      <div className="-mt-2 flex flex-col items-center">
        <div className="cfos-mono text-2xl font-bold text-foreground leading-none">
          {clamped}<span className="text-sm text-muted-foreground">/100</span>
        </div>
        {showLabel && <div className="cfos-docket mt-1.5">Risk index</div>}
      </div>
    </div>
  );
}
