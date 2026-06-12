import { logger } from "./logger";

const BLOG_REPO = "arif806-cyber/litigaforge-blog";
const WORKFLOW = "pipeline.yml";
const DISPATCH_URL = `https://api.github.com/repos/${BLOG_REPO}/actions/workflows/${WORKFLOW}/dispatches`;

/**
 * Returns the next "every 2 hours at :15 IST" slot strictly after `now`.
 *
 * :15 IST is minute 45 of an even UTC hour (e.g. 12:45 UTC = 18:15 IST), so the
 * cadence is 00:15, 02:15, 04:15 ... 18:15, 20:15, 22:15 IST.
 */
function nextSlot(now: Date): Date {
  const c = new Date(now);
  c.setUTCSeconds(0, 0);
  c.setUTCMinutes(45);
  while (c.getTime() <= now.getTime() || c.getUTCHours() % 2 !== 0) {
    c.setTime(c.getTime() + 60 * 60 * 1000);
  }
  return c;
}

async function triggerBlogPipeline(token: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(DISPATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "litigaforge-vm-scheduler",
      },
      body: JSON.stringify({ ref: "main", inputs: { max_articles: "3" } }),
      signal: controller.signal,
    });
    if (res.status === 204) {
      logger.info("blog-scheduler: pipeline triggered (HTTP 204)");
    } else {
      const body = await res.text().catch(() => "");
      logger.error(
        { status: res.status, body },
        "blog-scheduler: trigger failed",
      );
    }
  } catch (err) {
    logger.error({ err }, "blog-scheduler: trigger error");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Starts an in-process timer that triggers the LitigaForge blog content pipeline
 * (a GitHub Actions `workflow_dispatch`) every 2 hours, aligned to :15 IST.
 *
 * Runs only in the production deploy (`NODE_ENV === "production"`, which the
 * api-server artifact.toml sets for the live always-on VM), so local dev never
 * fires it. Replit's always-on VM is a reliable timer, unlike GitHub's free
 * `schedule` cron, which silently drops most scheduled runs.
 */
export function startBlogScheduler(): void {
  if (process.env["NODE_ENV"] !== "production") {
    logger.info("blog-scheduler: non-production environment — disabled");
    return;
  }
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE"];
  if (!token) {
    logger.warn(
      "blog-scheduler: GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE not set — disabled",
    );
    return;
  }

  const scheduleNext = (): void => {
    const now = new Date();
    const next = nextSlot(now);
    const delay = next.getTime() - now.getTime();
    logger.info(
      `blog-scheduler: next trigger at ${next.toISOString()} (in ${Math.round(
        delay / 60000,
      )} min)`,
    );
    setTimeout(() => {
      void triggerBlogPipeline(token).finally(scheduleNext);
    }, delay);
  };

  scheduleNext();
}
