const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

declare global {
  interface Window {
    grecaptcha: {
      ready: (fn: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export const hasRecaptcha = !!SITE_KEY;

export function initRecaptcha(): void {
  if (!SITE_KEY || document.getElementById("recaptcha-script")) return;
  const s = document.createElement("script");
  s.id = "recaptcha-script";
  s.async = true;
  s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  document.head.appendChild(s);
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY || typeof window.grecaptcha === "undefined") return null;
  return new Promise<string | null>((resolve) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(SITE_KEY as string, { action })
        .then((token) => resolve(token))
        .catch(() => resolve(null));
    });
  });
}
