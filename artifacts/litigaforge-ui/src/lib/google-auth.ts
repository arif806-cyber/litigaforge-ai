export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const hasGoogleClientId = !!GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential: string;
}

interface PromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (resp: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (n: PromptNotification) => void) => void;
          cancel: () => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

export function loadGoogleIdentity(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) return Promise.resolve();
  if (document.getElementById("gis-script")) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}
