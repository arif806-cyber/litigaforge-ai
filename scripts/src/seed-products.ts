import { getUncachableStripeClient } from "./stripeClient";

/**
 * Idempotently create LitigaForge subscription products + per-currency prices in
 * Stripe. India is intentionally excluded (Razorpay-only).
 *
 * Run with: pnpm --filter @workspace/scripts run seed-products
 */

type Tier = "professional" | "advocate_pro";

const PRODUCTS: { tier: Tier; name: string; description: string }[] = [
  {
    tier: "professional",
    name: "LitigaForge Professional",
    description: "Professional plan — 50 cases/month with advanced AI matching.",
  },
  {
    tier: "advocate_pro",
    name: "LitigaForge Advocate Pro",
    description:
      "Advocate Pro plan — unlimited cases with multi-AI legal strategy.",
  },
];

// Monthly price per tier, per currency, in the currency's minor unit.
const TIER_PRICES: Record<Tier, Record<string, number>> = {
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

async function seed() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding LitigaForge products and prices...");

  for (const def of PRODUCTS) {
    // Find existing product by tier metadata (idempotent).
    const existing = await stripe.products.search({
      query: `metadata['tier']:'${def.tier}' AND active:'true'`,
    });

    let product = existing.data[0];
    if (product) {
      console.log(`Product exists: ${product.name} (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: def.name,
        description: def.description,
        metadata: { tier: def.tier },
      });
      console.log(`Created product: ${product.name} (${product.id})`);
    }

    // Existing active prices for this product, keyed by currency.
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });
    const haveCurrency = new Set(existingPrices.data.map((p) => p.currency));

    const amounts = TIER_PRICES[def.tier];
    for (const [currency, unitAmount] of Object.entries(amounts)) {
      if (haveCurrency.has(currency)) {
        console.log(`  price exists: ${currency} ${unitAmount}`);
        continue;
      }
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency,
        recurring: { interval: "month" },
        metadata: { tier: def.tier },
      });
      console.log(`  created price: ${currency} ${unitAmount} (${price.id})`);
    }
  }

  console.log("✓ Seed complete. Webhooks/backfill will sync to the database.");
}

seed().catch((err) => {
  console.error("Error seeding products:", err);
  process.exit(1);
});
