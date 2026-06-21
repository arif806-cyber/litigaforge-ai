import { useEffect, useState } from "react";

const BASE = "/litigaforge";
const TTL_MS = 30_000;

/**
 * Lawyer-side hook — returns true while the client is actively on their case screen.
 * 1) Does an immediate GET /cases/{caseId}/client-online check.
 * 2) Listens on the existing WS for "client_online" events, auto-clears after TTL_MS.
 */
export function useClientOnlineStatus(
  caseId: number | null | undefined
): boolean {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setIsOnline(false);
      return;
    }

    let cancelled = false;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;

    fetch(`${BASE}/cases/${caseId}/client-online`)
      .then((r) => (r.ok ? r.json() : { online: false }))
      .then((d: { online: boolean }) => { if (!cancelled) setIsOnline(d.online); })
      .catch(() => {});

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}${BASE}/ws/cases/${caseId}`
    );

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.event === "client_online") {
          if (!cancelled) setIsOnline(true);
          if (offlineTimer) clearTimeout(offlineTimer);
          offlineTimer = setTimeout(() => {
            if (!cancelled) setIsOnline(false);
          }, TTL_MS);
        }
      } catch {}
    };
    ws.onerror = () => {};

    return () => {
      cancelled = true;
      ws.close();
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, [caseId]);

  return isOnline;
}
