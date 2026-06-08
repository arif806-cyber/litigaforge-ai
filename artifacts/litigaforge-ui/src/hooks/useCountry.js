import { useState, useEffect } from "react";

const COUNTRY_CONFIG = {
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
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState(
    () => localStorage.getItem("country_override") || null
  );

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const res = await fetch("/litigaforge/api/country-detect");
        const data = await res.json();
        setCountry(data);
      } catch {
        setCountry({ country_code: "IN", config: COUNTRY_CONFIG["IN"] });
      } finally {
        setLoading(false);
      }
    };
    fetchCountry();
  }, []);

  const switchCountry = (code) => {
    localStorage.setItem("country_override", code);
    setOverride(code);
    window.location.reload();
  };

  const activeCode = override || country?.country_code || "IN";
  const activeConfig = country?.config || COUNTRY_CONFIG[activeCode] || COUNTRY_CONFIG["IN"];

  return {
    country,
    loading,
    activeCode,
    activeConfig,
    switchCountry,
    allCountries: COUNTRY_CONFIG,
  };
}
