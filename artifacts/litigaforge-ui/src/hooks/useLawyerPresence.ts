import { useEffect, useState } from "react";

const BACKEND = "/litigaforge";

/**
 * Subscribes to the case presence WebSocket.
 * Returns the Set of lawyer IDs currently reviewing the given case.
 * Each entry auto-expires 15 s after the last broadcast from that lawyer.
 */
export function useLawyerPresence(caseId: number | null | undefined): Set<number> {
  const [reviewingIds, setReviewingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!caseId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}${BACKEND}/ws/cases/${caseId}`;

    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    const expiryTimers = new Map<number, ReturnType<typeof setTimeout>>();

    try {
      ws = new WebSocket(url);

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data as string);
          if (data.event !== "lawyer_viewing") return;

          const lawyerId: number = data.lawyer_id;

          setReviewingIds((prev) => new Set(prev).add(lawyerId));

          const old = expiryTimers.get(lawyerId);
          if (old) clearTimeout(old);

          const timer = setTimeout(() => {
            setReviewingIds((prev) => {
              const next = new Set(prev);
              next.delete(lawyerId);
              return next;
            });
            expiryTimers.delete(lawyerId);
          }, 15_000);

          expiryTimers.set(lawyerId, timer);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        // silent — presence is non-critical
      };

      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30_000);
    } catch {
      // WebSocket unavailable (e.g. SSR) — graceful no-op
    }

    return () => {
      pingTimer && clearInterval(pingTimer);
      expiryTimers.forEach((t) => clearTimeout(t));
      expiryTimers.clear();
      ws?.close();
    };
  }, [caseId]);

  return reviewingIds;
}
