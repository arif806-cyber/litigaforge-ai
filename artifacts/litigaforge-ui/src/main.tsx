import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "@fontsource-variable/inter";
import "./index.css";
import * as Sentry from "@sentry/react";

declare const __LITIGAFORGE_BUILD_VERSION__: string;
declare const __LITIGAFORGE_RELEASE__: string;
declare const __LITIGAFORGE_SENTRY_DSN__: string;

function safeRoute(pathname: string): string {
  const fixed = new Set(["in", "us", "uk", "au", "ca", "login", "register", "signup", "admin", "client-dashboard", "lawyer-dashboard", "post-case", "my-cases", "matches", "messages", "documents", "workspace", "settings", "subscription", "judgments", "review", "ask", "legal-chat", "docket", "requests", "advocate", "cases", "clients", "earnings", "cnr-tracker"]);
  return pathname.split("/").map((part) => !part ? "" : fixed.has(part) ? part : ":param").join("/").slice(0, 200);
}

if (__LITIGAFORGE_SENTRY_DSN__) {
  Sentry.init({
    dsn: __LITIGAFORGE_SENTRY_DSN__,
    environment: import.meta.env.PROD ? "production" : "development",
    release: __LITIGAFORGE_RELEASE__,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      const values = event.exception?.values;
      if (!values?.length) return null;
      return {
        type: undefined,
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: event.platform,
        level: event.level,
        environment: import.meta.env.PROD ? "production" : "development",
        release: __LITIGAFORGE_RELEASE__,
        exception: { values: values.map((value) => ({
          type: value.type ?? "Error",
          ...(value.stacktrace ? { stacktrace: { frames: value.stacktrace.frames?.map((frame) => ({
            filename: frame.filename, lineno: frame.lineno, function: frame.function,
          })) } } : {}),
        })) },
        tags: { route: safeRoute(window.location.pathname) },
      };
    },
    beforeSendTransaction(event) {
      event.request = undefined;
      event.user = undefined;
      event.extra = undefined;
      event.breadcrumbs = undefined;
      event.transaction = safeRoute(event.transaction ?? "");
      event.tags = { route: event.transaction };
      for (const span of event.spans ?? []) {
        span.description = undefined;
        span.data = {};
      }
      return event;
    },
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const serviceWorkers = navigator.serviceWorker;
  const basePath = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const appBase = new URL(basePath, window.location.origin);
  const serviceWorkerUrl = new URL("sw.js", appBase);
  serviceWorkerUrl.searchParams.set("v", __LITIGAFORGE_BUILD_VERSION__);
  const hadController = Boolean(serviceWorkers.controller);

  if (hadController) {
    serviceWorkers.addEventListener("controllerchange", () => {
      window.dispatchEvent(new Event("litigaforge:pwa-update"));
    });
  }

  void serviceWorkers.register(serviceWorkerUrl, {
    scope: appBase.pathname,
    updateViaCache: "none",
  }).then((registration) => registration.update()).catch(() => {
    console.warn("LitigaForge service-worker update check failed; the online app remains available.");
  });
}

function PwaUpdatePrompt() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const show = () => setAvailable(true);
    window.addEventListener("litigaforge:pwa-update", show);
    return () => window.removeEventListener("litigaforge:pwa-update", show);
  }, []);
  if (!available) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
      <span>New version available</span>
      <button className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

const helmetContext: Record<string, any> = {};

createRoot(document.getElementById("root")!).render(
  <HelmetProvider context={helmetContext}>
    <>
      <App />
      <PwaUpdatePrompt />
    </>
  </HelmetProvider>
);
