import { useState, useEffect } from "react";
import {
  getCountryFromPath,
  getPathWithoutCountry,
  buildCountryUrl,
} from "../lib/country";

const COUNTRY_API_BASE = "/litigaforge";
const countryConfigRequests = new Map<string, Promise<CountryConfig>>();
const COUNTRY_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CountryConfig {
  name: string;
  flag: string;
  currency: string;
  currency_symbol?: string;
  legal_system?: string;
  top_services?: string[];
  courts?: string[];
  emergency_legal?: string;
  bar_council?: string;
  primary_laws?: string[];
  payment_methods?: string[];
  [key: string]: unknown;
}

interface CountryMeta {
  name: string;
  flag: string;
  currency: string;
}

const COUNTRY_META: Record<string, CountryMeta> = {
  IN: { name: "India",          flag: "🇮🇳", currency: "₹" },
};

export function useCountry() {
  // URL is the source of truth for the active country; fall back to a stored
  // preference, then India.
  const urlCode = getCountryFromPath();
  const stored = (localStorage.getItem("country_override") || "").toUpperCase();
  const activeCode = "IN";

  const [activeConfig, setActiveConfig] = useState<CountryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let request = countryConfigRequests.get(activeCode);
    if (!request) {
      const storageKey = `lf:country-config:${activeCode}`;
      let cached: { expiresAt: number; config: CountryConfig } | null = null;
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) cached = JSON.parse(raw);
      } catch { /* storage may be unavailable; use the in-memory cache */ }
      if (cached && cached.expiresAt > Date.now() && cached.config) {
        request = Promise.resolve(cached.config);
      } else {
        request = fetch(`${COUNTRY_API_BASE}/api/country/${activeCode}`)
          .then((r) => {
            if (!r.ok) throw new Error(`Country config request failed (${r.status})`);
            return r.json();
          })
          .then((d) => {
            const config = d.config as CountryConfig;
            try {
              sessionStorage.setItem(storageKey, JSON.stringify({
                expiresAt: Date.now() + COUNTRY_CACHE_TTL_MS,
                config,
              }));
            } catch { /* storage may be unavailable; keep the in-memory cache */ }
            return config;
          });
      }
      countryConfigRequests.set(activeCode, request);
    }
    request
      .then((d) => {
        if (!cancelled) setActiveConfig(d);
      })
      .catch(() => {
        countryConfigRequests.delete(activeCode);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCode]);

  // Switch country: persist preference and SPA-navigate to the same page under
  // the new country prefix. pushState + the country-change event update the URL
  // and the router base together (no full page reload).
  const switchCountry = (code: string) => {
    const target = code.toLowerCase();
    if (target === activeCode.toLowerCase()) return;
    localStorage.setItem("country_override", code.toUpperCase());
    const url =
      buildCountryUrl(target, getPathWithoutCountry()) +
      window.location.search +
      window.location.hash;
    window.history.pushState(null, "", url);
    // lf-country-change: CountryGate updates its `country` state → WouterRouter
    // base changes so the correct country prefix is stripped.
    window.dispatchEvent(new Event("lf-country-change"));
    // popstate: wouter's browser-location hook subscribes to this event and
    // re-reads window.location.pathname. pushState alone doesn't fire popstate,
    // so without this dispatch wouter retains the stale path and renders a 404.
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return {
    loading,
    activeCode,
    activeConfig,
    switchCountry,
    allCountries: COUNTRY_META,
  };
}
