/**
 * Case File OS — the "living dossier" design system for LitigaForge AI.
 *
 * Trust-first, paper-depth components: instrument gauges, the legal-pad margin
 * rule, docket metadata headers and a radial case map. The visual language was
 * validated on the mockup sandbox
 * (artifacts/mockup-sandbox/src/components/mockups/case-file-os) — those copies
 * remain the canonical visual spec; these are the production components
 * (cross-artifact imports are not permitted in this monorepo).
 *
 * Design tokens & utility classes live in src/index.css under the `--cfos-*`
 * / `.cfos-*` namespace.
 */
export { ScoreRing } from "./ScoreRing";
export type { ScoreRingProps } from "./ScoreRing";
export { RiskMeter } from "./RiskMeter";
export type { RiskMeterProps } from "./RiskMeter";
export { DocketHeader } from "./DocketHeader";
export type { DocketHeaderProps, DocketItem } from "./DocketHeader";
export { MarginRuleCard } from "./MarginRuleCard";
export type { MarginRuleCardProps } from "./MarginRuleCard";
export { PaperSurface } from "./PaperSurface";
export type { PaperSurfaceProps } from "./PaperSurface";
export { SettlingMotion } from "./SettlingMotion";
export type { SettlingMotionProps } from "./SettlingMotion";
export { Stamp } from "./Stamp";
export type { StampProps } from "./Stamp";
export { Chip } from "./Chip";
export type { ChipProps } from "./Chip";
export { StageTimeline } from "./StageTimeline";
export type { StageTimelineProps } from "./StageTimeline";
export { ConfidenceBars } from "./ConfidenceBars";
export type { ConfidenceRow, ConfidenceBarsProps } from "./ConfidenceBars";
export { CaseMap } from "./CaseMap";
export type {
  CaseMapProps,
  CaseMapNode,
  CaseMapCenter,
  CaseMapLegendItem,
} from "./CaseMap";
