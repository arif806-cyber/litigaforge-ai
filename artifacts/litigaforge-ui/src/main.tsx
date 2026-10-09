import { createRoot } from "react-dom/client";
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
    let reloadedForUpdate = false;
    serviceWorkers.addEventListener("controllerchange", () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    }, { once: true });
  }

  void serviceWorkers.register(serviceWorkerUrl, {
    scope: appBase.pathname,
    updateViaCache: "none",
  }).then((registration) => registration.update()).catch(() => {
    console.warn("LitigaForge service-worker update check failed; the online app remains available.");
  });
}

const helmetContext: Record<string, any> = {};

createRoot(document.getElementById("root")!).render(
  <HelmetProvider context={helmetContext}>
    <App />
  </HelmetProvider>
);
