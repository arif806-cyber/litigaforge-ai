import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ForgeDashboardSnapshot } from "@/components/forgeos/types";

const BASE = "/litigaforge";

export type ForgeOsStreamStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Subscribes to GET /forgeos/stream (SSE) and writes every "snapshot" frame
 * straight into the ["forgeos-dashboard"] React Query cache, so the initial
 * useQuery fetch and the live feed share one source of truth. Native
 * EventSource auto-reconnects on drop; we only surface connection status for
 * the UI's "Live" indicator, we don't hand-roll reconnect logic.
 *
 * `enabled` gates the subscription (only mount when the superuser gate has
 * passed and the page is actually visible) — never opens a connection
 * otherwise.
 */
export function useForgeOsStream(enabled: boolean) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ForgeOsStreamStatus>("connecting");
  const sourceRef = useRef<EventSource | null>(null);
  const openedOnceRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`${BASE}/forgeos/stream`, { withCredentials: true });
    sourceRef.current = source;
    setStatus("connecting");

    source.addEventListener("snapshot", (evt: MessageEvent) => {
      try {
        const snapshot = JSON.parse(evt.data) as ForgeDashboardSnapshot;
        queryClient.setQueryData(["forgeos-dashboard"], snapshot);
        openedOnceRef.current = true;
        setStatus("live");
      } catch {
        // malformed frame — drop silently, next snapshot will self-correct
      }
    });

    source.addEventListener("event", () => {
      // A discrete mission/workflow event arrived — the next periodic
      // snapshot (or the initial one) already carries the up-to-date
      // aggregate state, but bump status to "live" so the indicator reflects
      // an active connection even between snapshot frames.
      setStatus("live");
    });

    source.onopen = () => setStatus("live");
    source.onerror = () => {
      setStatus(openedOnceRef.current ? "reconnecting" : "connecting");
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, queryClient]);

  return status;
}
