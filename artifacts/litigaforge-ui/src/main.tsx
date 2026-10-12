import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

declare const __LITIGAFORGE_BUILD_VERSION__: string;

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
