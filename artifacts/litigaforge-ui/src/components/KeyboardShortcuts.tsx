"use client";

import { useEffect } from "react";
import { useLocation } from "wouter";

const SHORTCUTS: Record<string, string> = {
  "/": "/",
  "c": "/cases",
  "a": "/ask",
  "l": "/lawyers",
  "j": "/judgments",
  "r": "/review",
  "s": "/subscription",
  "p": "/post-case",
  "m": "/my-cases",
  "?": "/use-cases",
};

export function KeyboardShortcuts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const path = SHORTCUTS[e.key.toLowerCase()];
      if (path) {
        e.preventDefault();
        setLocation(path);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setLocation]);

  return null;
}
