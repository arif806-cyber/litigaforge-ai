import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { _tryRefresh } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface NewMessageEvent {
  event: "new_message";
  thread_id: number;
  sender_name?: string;
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    let socket: WebSocket | undefined;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/litigaforge/ws/messages`);

      socket.onopen = () => {
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25_000);
      };

      socket.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data) as NewMessageEvent;
          if (data.event !== "new_message") return;

          queryClient.invalidateQueries({ queryKey: ["chat-threads", user.id] });
          queryClient.invalidateQueries({ queryKey: ["chat-messages", data.thread_id] });

          if (!location.startsWith("/messages")) {
            toast({
              title: `New message from ${data.sender_name || "someone"}`,
              description: "Tap to open the conversation.",
              onClick: () => navigate(`/messages?thread=${data.thread_id}`),
            });
          }
        } catch {
          // Ignore malformed frames and keep the live connection open.
        }
      };

      socket.onclose = async (event) => {
        if (pingTimer) clearInterval(pingTimer);
        if (stopped) return;
        if (event.code === 4001) await _tryRefresh();
        reconnectTimer = setTimeout(connect, 3_000);
      };

      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      socket?.close();
    };
  }, [location, navigate, queryClient, user]);
}