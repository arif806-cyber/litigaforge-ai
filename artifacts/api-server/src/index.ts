import app from "./app";
import { logger } from "./lib/logger";
import { startBlogScheduler } from "./lib/blogScheduler";
import { schedulersEnabled } from "./lib/environment";
import * as Sentry from "@sentry/node";

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

if (process.env["SENTRY_DSN"]) Sentry.setupExpressErrorHandler(app);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (schedulersEnabled()) startBlogScheduler();
});
