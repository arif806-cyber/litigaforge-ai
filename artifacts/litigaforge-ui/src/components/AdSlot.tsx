import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-2540372254816391";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Renders a Google AdSense unit. The AdSense script is already loaded globally
 * from index.html. A slot id is required for a real ad to render — pass `slot`
 * or set VITE_ADSENSE_SLOT. With no slot id we render nothing (no broken box).
 */
export function AdSlot({
  slot,
  className,
  label = true,
}: {
  slot?: string;
  className?: string;
  label?: boolean;
}) {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const adSlot = slot || (import.meta.env.VITE_ADSENSE_SLOT as string | undefined);

  useEffect(() => {
    if (!adSlot || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* ad blocker or script not yet ready — fail silently */
    }
  }, [adSlot]);

  if (!adSlot) return null;

  return (
    <div className={className} data-testid="ad-slot">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 text-center mb-1">
          Advertisement
        </p>
      )}
      <ins
        ref={insRef as React.RefObject<HTMLModElement>}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
