import { useEffect, type ReactNode } from "react";

export function ThemeProvider({ children, storageKey = "vite-ui-theme" }: {
  children: ReactNode;
  storageKey?: string;
}) {
  useEffect(() => {
    try { localStorage.removeItem(storageKey); } catch { /* storage may be unavailable */ }
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = "#f5f3ed";
    });
  }, [storageKey]);

  return <>{children}</>;
}