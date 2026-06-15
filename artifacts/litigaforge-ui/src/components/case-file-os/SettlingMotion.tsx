import type { ReactNode } from "react";
import { motion } from "framer-motion";

export interface SettlingMotionProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Animate when scrolled into view (true) vs. on mount (false). */
  whileInView?: boolean;
  className?: string;
  "data-testid"?: string;
}

const EASE = [0.22, 0.61, 0.36, 1] as const;
const FROM = { opacity: 0, y: 14, scale: 0.985 };
const TO = { opacity: 1, y: 0, scale: 1 };

/**
 * SettlingMotion — wraps content in the Case File OS "settle into the file"
 * entrance: a soft upward drift + scale that mirrors the cfos-settle keyframe.
 * Respects prefers-reduced-motion via framer-motion's reducedMotion handling.
 */
export function SettlingMotion({
  children,
  delay = 0,
  whileInView = true,
  className,
  "data-testid": testId = "cfos-settling-motion",
}: SettlingMotionProps) {
  const transition = { duration: 0.7, ease: EASE, delay };
  const motionProps = whileInView
    ? { initial: FROM, whileInView: TO, viewport: { once: true } as const, transition }
    : { initial: FROM, animate: TO, transition };
  return (
    <motion.div className={className} data-testid={testId} {...motionProps}>
      {children}
    </motion.div>
  );
}
