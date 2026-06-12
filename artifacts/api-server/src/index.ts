import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { getStripeSync } from "./stripeClient";
import { logger } from "./lib/logger";
import { startBlogScheduler } from "./lib/blogScheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Initialize the Stripe schema, managed webhook and data sync.
 *
 * IMPORTANT: this is best-effort and MUST NOT throw. This server also serves the
 * frontend dist, so a Stripe outage (e.g. integration not connected) must never
 * prevent the site from coming up. Failures are logged and the server continues.
 */
async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const firstDomain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
    if (firstDomain) {
      const webhookUrl = `https://${firstDomain}/api/stripe/webhook`;
      const webhookResult =
        await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info(
        { webhook: webhookResult?.url ?? "setup complete" },
        "Stripe webhook configured",
      );
    } else {
      logger.warn("REPLIT_DOMAINS not set — skipping managed webhook setup");
    }

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err) => logger.error({ err }, "Error syncing Stripe data"));
  } catch (err) {
    logger.error({ err }, "Failed to initialize Stripe — continuing without it");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void initStripe();
  startBlogScheduler();
});
