// GA4 is bootstrapped by the inline snippet in index.html: it defines the
// global gtag() stub, runs gtag('config', …, { send_page_view: false }), and
// defers the heavy gtag/js script until the page is interactive (load + 3s).
// This module only SENDS events through that global gtag — which queues into
// dataLayer until the real library loads, so nothing is lost. Page views are
// sent manually on every route change so SPA navigations are tracked, not just
// the first load. VITE_GA4_ID overrides the id only if explicitly set.
const GA_ID =
  (import.meta.env.VITE_GA4_ID as string | undefined) || "G-DHTR1SECG4";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export function trackPageView(path: string): void {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: GA_ID,
  });
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, { send_to: GA_ID, ...params });
}
