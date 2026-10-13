import { logger } from "./logger";
import { appEnvironment } from "./environment";
import { fetchRollingArticleQuota } from "./blogQuota";

const BLOG_REPO = "arif806-cyber/litigaforge-blog";
const WORKFLOW = "pipeline.yml";
const DISPATCH_URL = `https://api.github.com/repos/${BLOG_REPO}/actions/workflows/${WORKFLOW}/dispatches`;

/** Return tomorrow's daily dispatch slot (00:45 UTC / 06:15 IST). */
export function nextSlot(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(0, 45, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** Invalid or unavailable quota is deliberately fail-closed. */
export function rollingArticleQuota(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

let dispatchInFlight = false;
let lastDispatchDay: string | null = null;

async function triggerBlogPipeline(token: string): Promise<void> {
  if (dispatchInFlight) return;
  const quota = await fetchRollingArticleQuota(token);
  if (quota === null || quota >= 3) {
    logger.warn("blog-scheduler: unavailable or exhausted rolling 7-day quota — not dispatching");
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  if (lastDispatchDay === day) return;
  dispatchInFlight = true;
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
      body: JSON.stringify({
        ref: "main",
        inputs: {
          max_articles: String(Math.min(3 - quota, 3)),
          country: "IN",
          focus_regions: "Telangana,Andhra Pradesh",
        },
      }),
      signal: controller.signal,
    });
    if (res.status === 204) {
      lastDispatchDay = day;
      logger.info("blog-scheduler: India-focused pipeline triggered (HTTP 204)");
    } else {
      logger.error({ status: res.status, body: await res.text().catch(() => "") }, "blog-scheduler: trigger failed");
    }
  } catch (err) {
    logger.error({ err }, "blog-scheduler: trigger error");
  } finally {
    clearTimeout(timeout);
    dispatchInFlight = false;
  }
}

/** Starts an in-process, fail-closed, at-most-daily India blog scheduler. */
export function startBlogScheduler(): void {
  if (!["production", "prod"].includes(appEnvironment())) {
    logger.info("blog-scheduler: non-production environment — disabled");
    return;
  }
  const token = process.env["GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE"];
  if (!token) {
    logger.warn("blog-scheduler: GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE not set — disabled");
    return;
  }
  const scheduleNext = (): void => {
    const now = new Date();
    const next = nextSlot(now);
    const delay = next.getTime() - now.getTime();
    setTimeout(() => void triggerBlogPipeline(token).finally(scheduleNext), delay);
  };
  scheduleNext();
}