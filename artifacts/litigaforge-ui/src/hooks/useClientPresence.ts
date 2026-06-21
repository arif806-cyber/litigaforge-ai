import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Client-side heartbeat hook.
 * Call once in the client's case detail / dashboard screen.
 * Fires POST /cases/{caseId}/client-heartbeat immediately on mount, then
 * every 20 s while the screen is open. Stops automatically on unmount.
 */
export function useClientPresence(caseId: number | null | undefined): void {
  useEffect(() => {
    if (!caseId) return;

    const ping = () => {
      apiFetch(`/cases/${caseId}/client-heartbeat`, { method: "POST" }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 20_000);
    return () => clearInterval(interval);
  }, [caseId]);
}
