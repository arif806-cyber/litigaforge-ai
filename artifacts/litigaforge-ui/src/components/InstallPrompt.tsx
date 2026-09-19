import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "litigaforge:pwa-install-dismissed";

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone || localStorage.getItem(DISMISSED_KEY) === "1") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !/crios/.test(ua);
    setIos(isIosDevice);
    if (isIosDevice) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl">
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
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};