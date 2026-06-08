import { pool } from "@workspace/db";

/**
 * Raw SQL access to the shared Postgres database.
 *
 * Reads Stripe product/price data from the `stripe.*` schema (kept in sync by
 * stripe-replit-sync) and reads/writes the Python-owned `users` / `subscriptions`
 * tables. We use the existing `@workspace/db` pool so both services share one
 * connection string.
 */

export interface PlanPrice {
  tier: string;
  priceId: string;
  currency: string;
  unitAmount: number;
}

export interface LfUser {
  id: number;
  email: string;
  name: string | null;
  subscription_tier: string | null;
  stripe_customer_id: string | null;
}

export class Storage {
  // Plans (tier + price) for a currency, sourced from the synced stripe schema.
  async getPlansForCurrency(currency: string): Promise<PlanPrice[]> {
    const result = await pool.query(
      `SELECT pr.id AS price_id,
              pr.unit_amount,
              pr.currency,
              p.metadata->>'tier' AS tier
         FROM stripe.prices pr
         JOIN stripe.products p ON p.id = pr.product
        WHERE pr.active = true
          AND p.active = true
          AND pr.currency = $1
          AND p.metadata->>'tier' IS NOT NULL`,
      [currency],
    );
    return result.rows.map((r) => ({
      tier: r.tier as string,
      priceId: r.price_id as string,
      currency: r.currency as string,
      unitAmount: Number(r.unit_amount),
    }));
  }

  async getUserById(id: number): Promise<LfUser | null> {
    const result = await pool.query(
      `SELECT id, email, name, subscription_tier, stripe_customer_id
         FROM users WHERE id = $1`,
      [id],
    );
    return (result.rows[0] as LfUser) ?? null;
  }

  async setStripeCustomerId(userId: number, customerId: string): Promise<void> {
    await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [
      customerId,
      userId,
    ]);
  }

  // Activate a tier after a verified Stripe subscription and record it.
  async activateTier(
    userId: number,
    tier: string,
    paymentRef: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users SET subscription_tier = $1 WHERE id = $2`,
        [tier, userId],
      );
      await client.query(
        `INSERT INTO subscriptions (user_id, tier, started_at, status, payment_ref)
         VALUES ($1, $2, NOW(), 'active', $3)`,
        [userId, tier, paymentRef],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

export const storage = new Storage();
