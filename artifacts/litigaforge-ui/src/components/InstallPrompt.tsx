import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

const VISITS_KEY = "litigaforge:mobile-visits";

export function InstallPrompt() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [settingsSlot, setSettingsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIos(isIosDevice);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!user?.id || location === "/login" || location.startsWith("/login/")) return;
    const key = `${VISITS_KEY}:${user.id}`;
    const previous = Number(localStorage.getItem(key) || 0);
    const next = previous + 1;
    localStorage.setItem(key, String(next));
  }, [location, user?.id]);

  const dismissedKey = user?.id ? `litigaforge:pwa-install-dismissed:${user.id}` : "";
  const promptedKey = user?.id ? `litigaforge:pwa-install-shown:${user.id}` : "";
  const isSettings = location === "/settings" || location.endsWith("/settings");
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
  const isMobile = typeof window !== "undefined"
    && window.matchMedia("(max-width: 767px)").matches
    && /iphone|ipad|ipod|android|mobile/.test(window.navigator.userAgent.toLowerCase());

  useEffect(() => {
    if (!user?.id || !isSettings || !isMobile || isStandalone) {
      setVisible(false);
      return;
    }
    const visits = Number(localStorage.getItem(`${VISITS_KEY}:${user.id}`) || 0);
    if (visits < 3 || localStorage.getItem(dismissedKey) || localStorage.getItem(promptedKey)) return;
    if (!ios && !installEvent) return;
    localStorage.setItem(promptedKey, "1");
    setVisible(true);
  }, [dismissedKey, installEvent, ios, isMobile, isSettings, isStandalone, user?.id]);

  useEffect(() => {
    if (!visible) {
      setSettingsSlot(null);
      return;
    }
    const attach = () => {
      const slot = document.getElementById("settings-install-slot");
      if (slot) {
        setSettingsSlot(slot);
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => observer.disconnect();
  }, [visible, location]);

  const dismiss = () => {
    if (dismissedKey) localStorage.setItem(dismissedKey, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  };

  if (!visible || !settingsSlot) return null;

  return createPortal(
    <aside className="mx-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm" data-testid="pwa-install-card">
      <Download className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Add LitigaForge to your home screen</p>
        {ios ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Tap Share in Safari, then choose <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Open your legal tools faster from your phone.</p>
        )}
        {installEvent && (
          <button type="button" onClick={install} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            Add to home screen
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss install prompt" onClick={dismiss} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </aside>,
    settingsSlot,
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};