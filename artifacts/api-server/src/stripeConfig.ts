/**
 * LitigaForge international pricing config.
 *
 * India (IN) uses Razorpay (handled by the Python backend) and is intentionally
 * NOT present here. Every other supported country pays via Stripe Checkout in its
 * local currency.
 *
 * This file is the single source of truth for currency + amounts. The seed script
 * (scripts/src/seed-products.ts) keeps an identical copy so products/prices in
 * Stripe match what the API serves.
 */

export type Tier = "professional" | "advocate_pro";

// ISO 3166-1 alpha-2 country code (lowercase) -> ISO 4217 currency (lowercase).
// `in` is deliberately excluded: India is Razorpay-only.
export const COUNTRY_CURRENCY: Record<string, string> = {
  us: "usd",
  gb: "gbp",
  ae: "aed",
  au: "aud",
  ca: "cad",
  sg: "sgd",
  de: "eur",
};

// Monthly price per tier, per currency, in the currency's minor unit (e.g. cents).
export const TIER_PRICES: Record<Tier, Record<string, number>> = {
  professional: {
    usd: 1200,
    gbp: 1000,
    eur: 1100,
    aed: 4500,
    aud: 1800,
    cad: 1600,
    sgd: 1600,
  },
  advocate_pro: {
    usd: 3000,
    gbp: 2500,
    eur: 2800,
    aed: 11000,
    aud: 4500,
    cad: 4000,
    sgd: 4000,
  },
};

export const PRODUCTS: { tier: Tier; name: string; description: string }[] = [
  {
    tier: "professional",
    name: "LitigaForge Professional",
    description: "Professional plan — 50 cases/month with advanced AI matching.",
  },
  {
    tier: "advocate_pro",
    name: "LitigaForge Advocate Pro",
    description: "Advocate Pro plan — unlimited cases with multi-AI legal strategy.",
  },
];

export function currencyForCountry(country: string | undefined | null): string | null {
  if (!country) return null;
  return COUNTRY_CURRENCY[country.toLowerCase()] ?? null;
}
