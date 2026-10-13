import type { CSSProperties } from "react";
import { FEATURE_ICON_TOKENS, type FeatureIconToken, type FeatureKey } from "@/lib/featureIcons";

const TILE_SIZE = { small: 29, medium: 40, large: 60 } as const;

export function FeatureIcon({ feature, size = "medium", className = "" }: {
  feature: FeatureKey;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  const token = FEATURE_ICON_TOKENS[feature] as FeatureIconToken;
  const Icon = token.icon;
  const px = TILE_SIZE[size];
  const fill = token.gradient
    ? `linear-gradient(155deg, ${token.gradient[0]}, ${token.gradient[1]})`
    : `linear-gradient(155deg, color-mix(in srgb, ${token.color} 92%, white), ${token.color} 56%, color-mix(in srgb, ${token.color} 88%, black))`;

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22.5%] border border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] dark:border-[0.5px] dark:border-white/30 ${className}`}
      style={{ width: px, height: px, background: fill } as CSSProperties}
    >
      <Icon className="relative z-10 h-[60%] w-[60%] text-white" strokeWidth={2} />
    </span>
  );
}
