import { Router, type IRouter } from "express";
import { getUserId } from "../auth";
import { storage, type PlanPrice } from "../stripeStorage";
import { currencyForCountry } from "../stripeConfig";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

// Resolve the paid-tier plans for a currency. Prefers the synced `stripe.*`
// schema, but falls back to the live Stripe API whenever the schema is empty OR
// the query throws (e.g. catalog not yet backfilled / migrations not applied).
// This keeps both /plans and /checkout working without requiring a backfill.
async function resolvePlans(currency: string): Promise<PlanPrice[]> {
  let plans: PlanPrice[] = [];
  try {
    plans = await storage.getPlansForCurrency(currency);
  } catch {
    plans = [];
  }
  if (plans.length > 0) return plans;

  const stripe = await getUncachableStripeClient();
  const prices = await stripe.prices.list({
    active: true,
    currency,
    expand: ["data.product"],
    limit: 100,
  });
  return prices.data
    .map((price) => {
      const product = price.product;
      const tier =
        typeof product === "object" && product && !("deleted" in product)
          ? (product.metadata?.["tier"] ?? null)
          : null;
      if (!tier || price.unit_amount == null) return null;
      return {
        tier,
        priceId: price.id,
        currency: price.currency,
        unitAmount: price.unit_amount,
      } as PlanPrice;
    })
    .filter((p): p is PlanPrice => p !== null);
}

// GET /api/stripe/plans?country=ae
// Returns the Stripe price for each paid tier in the country's local currency.
// India is Razorpay-only and is rejected here.
router.get("/stripe/plans", async (req, res) => {
  const country = String(req.query["country"] ?? "").toLowerCase();
  const currency = currencyForCountry(country);

  if (!currency) {
    return res
      .status(400)
      .json({ error: "Stripe checkout is not available for this country." });
  }

  try {
    const plans = await resolvePlans(currency);
    res.json({ currency, plans });
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to load Stripe plans");
    res.status(500).json({ error: "Failed to load plans." });
    return;
  }
});

// POST /api/stripe/checkout  { tier, country }
// For NEW subscribers: creates (or reuses) a Stripe customer and returns a
// Checkout session URL.
// For EXISTING subscribers upgrading/downgrading: performs an in-place
// subscription price-swap with proration so no second subscription is created
// and no double-charge occurs.
router.post("/stripe/checkout", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const tier = String(req.body?.tier ?? "");
  const country = String(req.body?.country ?? "").toLowerCase();
  const currency = currencyForCountry(country);

  if (!currency) {
    return res
      .status(400)
      .json({ error: "Stripe checkout is not available for this country." });
  }
  if (tier !== "professional" && tier !== "advocate_pro") {
    return res.status(400).json({ error: "Invalid tier." });
  }

  try {
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    const plans = await resolvePlans(currency);
    const plan = plans.find((p) => p.tier === tier);
    if (!plan) {
      return res
        .status(400)
        .json({ error: "No price configured for this plan/currency." });
    }

    const stripe = await getUncachableStripeClient();

    // Ensure a Stripe customer exists for this user.
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { lf_user_id: String(userId) },
      });
      customerId = customer.id;
      await storage.setStripeCustomerId(userId, customerId);
    }

    // Check for an existing active (or scheduled-to-cancel) subscription.
    // If one exists, swap the price in-place with proration instead of opening
    // a second checkout session — avoiding double charges.
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const existingSub = existingSubs.data[0];
    if (existingSub) {
      const subItemId = existingSub.items.data[0]?.id;
      if (!subItemId) {
        return res.status(500).json({ error: "Could not read existing subscription." });
      }

      await stripe.subscriptions.update(existingSub.id, {
        items: [{ id: subItemId, price: plan.priceId }],
        proration_behavior: "always_invoice",
        metadata: { lf_user_id: String(userId), lf_tier: tier },
        cancel_at_period_end: false,
      });

      // Activate the new tier immediately — the webhook will confirm, but we
      // also do it here so the user sees the change right away.
      await storage.activateTier(userId, tier, existingSub.id);

      res.json({ upgraded: true, tier });
      return;
    }

    // No existing subscription — create a Checkout session for new subscribers.
    const origin =
      req.get("origin") ??
      `${req.protocol}://${req.get("host")}`;
    const base = country ? `${origin}/${country}` : origin;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${base}/subscription?stripe=success`,
      cancel_url: `${base}/subscription?stripe=cancel`,
      subscription_data: {
        metadata: { lf_user_id: String(userId), lf_tier: tier },
      },
      metadata: { lf_user_id: String(userId), lf_tier: tier },
    });

    res.json({ url: session.url });
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Failed to start checkout." });
    return;
  }
});

// POST /api/stripe/reconcile
// Called when the user returns from a successful Checkout. Reads the user's
// active subscription from Stripe (source of truth) and activates the tier on
// the Python-owned users table.
router.post("/stripe/reconcile", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const user = await storage.getUserById(userId);
    if (!user?.stripe_customer_id) {
      return res.json({ tier: null });
    }

    const stripe = await getUncachableStripeClient();
    const subs = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: "active",
      limit: 1,
      expand: ["data.items.data.price.product"],
    });

    const sub = subs.data[0];
    if (!sub) {
      return res.json({ tier: null });
    }

    const product = sub.items.data[0]?.price?.product;
    const tier =
      typeof product === "object" && product && !("deleted" in product)
        ? (product.metadata?.["tier"] ?? null)
        : (sub.metadata?.["lf_tier"] ?? null);

    if (tier !== "professional" && tier !== "advocate_pro") {
      return res.json({ tier: null });
    }

    await storage.activateTier(userId, tier, sub.id);
    res.json({ tier });
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to reconcile Stripe subscription");
    res.status(500).json({ error: "Failed to confirm subscription." });
    return;
  }
});

// POST /api/stripe/portal
// Creates a Stripe Billing Portal session so international subscribers can
// self-manage their plan (cancel, update payment method, view invoices).
router.post("/stripe/portal", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const user = await storage.getUserById(userId);
    if (!user?.stripe_customer_id) {
      return res
        .status(400)
        .json({ error: "No Stripe subscription found for this account." });
    }

    const stripe = await getUncachableStripeClient();
    const origin =
      req.get("origin") ?? `${req.protocol}://${req.get("host")}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${origin}/subscription`,
    });

    res.json({ url: session.url });
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to create Stripe portal session");
    res.status(500).json({ error: "Failed to open subscription management." });
    return;
  }
});

// POST /api/stripe/cancel
// Schedules the Stripe subscription for cancellation at period end and records
// a pending_cancellation row in the subscriptions table. The webhook resets the
// tier to free when Stripe fires customer.subscription.deleted at period end.
router.post("/stripe/cancel", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const user = await storage.getUserById(userId);
    if (!user?.stripe_customer_id) {
      return res
        .status(400)
        .json({ error: "No active Stripe subscription found." });
    }

    const stripe = await getUncachableStripeClient();

    const subs = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    const sub = subs.data[0];
    if (!sub) {
      return res.status(400).json({ error: "No active Stripe subscription found." });
    }

    await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    // Persist the pending-cancellation state so the billing history and any
    // admin tooling know what the user requested. The webhook handler will
    // flip this to 'cancelled' when Stripe fires the deletion event.
    await storage.recordPendingCancellation(userId, sub.id);

    res.json({
      message:
        "Your subscription will be cancelled at the end of the current billing period. You will keep your current benefits until then.",
    });
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to cancel Stripe subscription");
    res.status(500).json({ error: "Failed to cancel subscription." });
    return;
  }
});

export default router;
