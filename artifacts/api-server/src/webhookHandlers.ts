import Stripe from "stripe";
import { getStripeSync, getStripeCredentials } from "./stripeClient";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

/**
 * Resolve the LitigaForge tier for a Stripe subscription by looking up the
 * price/product in the locally-synced `stripe.*` schema (source of truth).
 * Falls back to subscription metadata only if the DB lookup yields nothing.
 */
async function tierFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const priceId = sub.items.data[0]?.price?.id;
  if (priceId) {
    try {
      const result = await pool.query(
        `SELECT p.metadata->>'tier' AS tier
           FROM stripe.prices pr
           JOIN stripe.products p ON p.id = pr.product
          WHERE pr.id = $1
          LIMIT 1`,
        [priceId],
      );
      const tier = (result.rows[0]?.tier as string | undefined) ?? null;
      if (tier) return tier;
    } catch (err) {
      logger.warn({ err }, "Could not resolve tier from stripe.prices — falling back to metadata");
    }
  }
  // Fallback: subscription-level metadata written at checkout/update time.
  return (sub.metadata?.["lf_tier"] as string | undefined) ?? null;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " +
          typeof payload +
          ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    // Let stripe-replit-sync sync Stripe data to the local `stripe.*` schema
    // first so that tierFromSubscription() reads fresh data when it queries the DB.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Then apply our app-specific tier updates.
    try {
      await WebhookHandlers.handleAppEvents(payload, signature);
    } catch (err) {
      logger.error({ err }, "Stripe app-event handler failed (non-fatal)");
    }
  }

  static async handleAppEvents(payload: Buffer, signature: string): Promise<void> {
    const { secretKey, webhookSecret } = await getStripeCredentials();
    if (!webhookSecret) {
      logger.warn("No webhookSecret configured — skipping app-event handling");
      return;
    }

    const stripe = new Stripe(secretKey);
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        await pool.query(
          `UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = $1`,
          [customerId],
        );
        await pool.query(
          `UPDATE subscriptions SET status = 'cancelled'
             WHERE user_id = (SELECT id FROM users WHERE stripe_customer_id = $1)
               AND status IN ('active', 'pending_cancellation')`,
          [customerId],
        );
        logger.info({ customerId }, "Stripe subscription deleted → tier reset to free");
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        if (sub.status === "active") {
          // Derive tier from the synced stripe DB tables (source of truth),
          // falling back to subscription metadata only if the DB lookup fails.
          const tier = await tierFromSubscription(sub);
          if (tier === "professional" || tier === "advocate_pro") {
            await pool.query(
              `UPDATE users SET subscription_tier = $1 WHERE stripe_customer_id = $2`,
              [tier, customerId],
            );
            // Mark any pending_cancellation subscriptions as active again
            // (user re-subscribed or cancelled their cancellation).
            if (!sub.cancel_at_period_end) {
              await pool.query(
                `UPDATE subscriptions SET status = 'active'
                   WHERE user_id = (SELECT id FROM users WHERE stripe_customer_id = $1)
                     AND status = 'pending_cancellation'`,
                [customerId],
              );
            }
            logger.info({ customerId, tier }, "Stripe subscription updated → tier activated");
          }
        } else if (
          sub.status === "canceled" ||
          sub.status === "unpaid" ||
          sub.status === "past_due"
        ) {
          await pool.query(
            `UPDATE users SET subscription_tier = 'free' WHERE stripe_customer_id = $1`,
            [customerId],
          );
          logger.info(
            { customerId, status: sub.status },
            "Stripe subscription non-active → tier reset to free",
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string"
            ? inv.customer
            : (inv.customer as Stripe.Customer | null)?.id ?? null;
        if (customerId) {
          logger.warn({ customerId }, "Stripe invoice payment failed");
        }
        break;
      }

      default:
        break;
    }
  }
}
