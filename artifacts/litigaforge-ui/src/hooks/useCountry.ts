import { useState, useEffect } from "react";
import {
  getCountryFromPath,
  getPathWithoutCountry,
  buildCountryUrl,
} from "../lib/country";

const COUNTRY_API_BASE = "/litigaforge";

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
  US: { name: "United States",  flag: "🇺🇸", currency: "$" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "£" },
  AE: { name: "UAE",            flag: "🇦🇪", currency: "د.إ" },
  AU: { name: "Australia",      flag: "🇦🇺", currency: "A$" },
  CA: { name: "Canada",         flag: "🇨🇦", currency: "CA$" },
  SG: { name: "Singapore",      flag: "🇸🇬", currency: "S$" },
  DE: { name: "Germany",        flag: "🇩🇪", currency: "€" },
};

export function useCountry() {
  // URL is the source of truth for the active country; fall back to a stored
  // preference, then India.
  const urlCode = getCountryFromPath();
  const stored = (localStorage.getItem("country_override") || "").toUpperCase();
  const activeCode = urlCode ? urlCode.toUpperCase() : (COUNTRY_META[stored] ? stored : "IN");

  const [activeConfig, setActiveConfig] = useState<CountryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${COUNTRY_API_BASE}/api/country/${activeCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setActiveConfig(d.config as CountryConfig);
      })
      .catch(() => {})
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
    window.dispatchEvent(new Event("lf-country-change"));
  };

  return {
    loading,
    activeCode,
    activeConfig,
    switchCountry,
    allCountries: COUNTRY_META,
  };
}
