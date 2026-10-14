import type { CSSProperties } from "react";
import { FEATURE_ICON_TOKENS, type FeatureIconToken, type FeatureKey } from "@/lib/featureIcons";

const TILE_SIZE = { small: 29, medium: 40, large: 60 } as const;

/**
 * One icon system for the whole app: a soft brand-gold tile with a gold glyph.
 * Feature colours in FEATURE_ICON_TOKENS are intentionally ignored so screens
 * never read as a rainbow; meaning comes from the glyph and the label.
 * `inverted` is for icons sitting on a filled brand surface (active nav item).
 */
export function FeatureIcon({ feature, size = "medium", className = "", inverted = false }: {
  feature: FeatureKey;
  size?: keyof typeof TILE_SIZE;
  className?: string;
  inverted?: boolean;
}) {
  const token = FEATURE_ICON_TOKENS[feature] as FeatureIconToken;
  const Icon = token.icon;
  const px = TILE_SIZE[size];

  return (
    <span
      aria-hidden="true"
      data-feature-icon={feature}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[28%] ${
        inverted
          ? "bg-white/15 text-sidebar-primary-foreground"
          : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
      } ${className}`}
      style={{ width: px, height: px } as CSSProperties}
    >
      <Icon className="h-[55%] w-[55%]" strokeWidth={1.9} />
    </span>
  );
}
