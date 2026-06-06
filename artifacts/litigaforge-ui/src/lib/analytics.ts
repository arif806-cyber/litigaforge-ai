const GA_ID = import.meta.env.VITE_GA4_ID as string | undefined;

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export function initGA(): void {
  if (!GA_ID || document.getElementById("ga4-script")) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => window.dataLayer.push(args);
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.id = "ga4-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export function trackPageView(path: string): void {
  if (!GA_ID || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    send_to: GA_ID,
  });
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!GA_ID || typeof window.gtag !== "function") return;
  window.gtag("event", name, { send_to: GA_ID, ...params });
}
