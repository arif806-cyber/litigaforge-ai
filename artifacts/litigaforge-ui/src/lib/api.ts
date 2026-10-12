const BASE = "/litigaforge";

// Public endpoints that should NOT trigger a /login redirect on 401
// Only routes that genuinely permit anonymous access belong here. Protected AI
// routes and their job-status polls must refresh an expired access cookie before
// surfacing an authentication error.
const PUBLIC_PATH = /^\/(ask|contact|judgments|lawyers|legal-aid|chains|healthz|memory|stats|cases\?|research\/profile)/;

// Guard against concurrent refresh calls
let _refreshing: Promise<boolean> | null = null;

export async function _tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

type ApiFetchInit = Omit<RequestInit, "body"> & { body?: object | BodyInit | null };

export async function apiFetch(path: string, init?: ApiFetchInit) {
  const rawBody = (init as any)?.body;
  const isPlainObject =
    rawBody !== undefined &&
    rawBody !== null &&
    typeof rawBody === "object" &&
    !(rawBody instanceof FormData) &&
    !(rawBody instanceof Blob) &&
    !(rawBody instanceof URLSearchParams) &&
    !(rawBody instanceof ArrayBuffer);

  const body = isPlainObject ? JSON.stringify(rawBody) : rawBody;

  // Cookie-only auth: browser sends httpOnly cookie automatically
  // `body` is already normalised to BodyInit (string | null | Blob | …) at this point.
  const baseInit: RequestInit = {
    ...(init as RequestInit),
    credentials: "include",
    headers: {
      ...(isPlainObject || typeof rawBody === "string" ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    body: body as BodyInit | null | undefined,
  };
  const res = await fetch(`${BASE}${path}`, baseInit);

  if (res.status === 401) {
    // Always attempt one silent refresh. Public endpoints normally never return
    // 401, and this keeps protected routes working even if an allowlist entry
    // becomes stale when backend access rules change.
    const refreshed = await _tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${BASE}${path}`, baseInit);
      if (!retry.ok) {
        if (retry.status === 401 && !PUBLIC_PATH.test(path)) {
          window.location.href = "/login";
          return;
        }
        const detail = await _extractError(retry);
        throw new ApiRequestError(detail || `API error ${retry.status}`, retry.status);
      }
      return retry.json();
    }
    // Refresh failed — redirect only when the requested route requires auth.
    if (!PUBLIC_PATH.test(path)) {
      window.location.href = "/login";
      return;
    }
  }

  if (!res.ok) {
    const detail = await _extractError(res);
    throw new ApiRequestError(detail || `API error ${res.status}`, res.status);
  }

  return res.json();
}

export type LongJobStatus<TResult> = {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: TResult;
  progress?: TResult;
  error?: string;
};

export const LONG_JOB_ERROR = "Something went wrong — your text is saved. Tap Retry.";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export type LongJobFailureReason =
  | "network"
  | "unauthorized"
  | "failed"
  | "malformed"
  | "timeout";

export class LongJobError extends Error {
  constructor(
    readonly reason: LongJobFailureReason,
    readonly jobId: string,
    options?: ErrorOptions,
  ) {
    super(LONG_JOB_ERROR, options);
    this.name = "LongJobError";
  }
}

type LongJobOptions<TResult = unknown> = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxConsecutivePollErrors?: number;
  onQueued?: (jobId: string) => void;
  onProgress?: (progress: TResult) => void;
};

function jobFailure(reason: LongJobFailureReason, jobId: string, cause?: unknown): LongJobError {
  console.error("[LitigaForge AI job error]", { jobId, reason, cause });
  return new LongJobError(reason, jobId, cause === undefined ? undefined : { cause });
}

export async function pollLongJob<TResult>(
  jobId: string,
  path: string,
  options: LongJobOptions<TResult> = {},
): Promise<TResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 2500;
  const deadline = Date.now() + (options.timeoutMs ?? 3 * 60 * 1000);
  const startedAt = Date.now();
  const maxConsecutivePollErrors = options.maxConsecutivePollErrors ?? 3;
  let consecutivePollErrors = 0;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    let job: LongJobStatus<TResult>;
    try {
      job = await apiFetch(`/jobs/${encodeURIComponent(jobId)}/status`) as LongJobStatus<TResult>;
      consecutivePollErrors = 0;
    } catch (error) {
      consecutivePollErrors += 1;
      const status = error instanceof ApiRequestError ? error.status : undefined;
      console.warn("[LitigaForge AI job poll error]", {
        jobId,
        path,
        status,
        consecutivePollErrors,
        error,
      });
      if (status === 401 || status === 403) {
        throw jobFailure("unauthorized", jobId, error);
      }
      if (consecutivePollErrors >= maxConsecutivePollErrors) {
        throw jobFailure("network", jobId, error);
      }
      continue;
    }

    console.debug("[LitigaForge AI job poll]", { jobId, path, status: job?.status });
    if (job?.status === "completed") {
      if (job.result === undefined || job.result === null) {
        throw jobFailure("malformed", jobId);
      }
      const detail = { jobId, path, elapsedMs: Date.now() - startedAt };
      console.info("[LitigaForge AI job completed]", detail);
      window.dispatchEvent(new CustomEvent("litigaforge:job-completed", { detail }));
      return job.result;
    }
    if ((job?.status === "queued" || job?.status === "running") && job.progress !== undefined) {
      options.onProgress?.(job.progress);
    }
    if (job?.status === "failed") {
      throw jobFailure("failed", jobId, job.error);
    }
    if (job?.status !== "queued" && job?.status !== "running") {
      throw jobFailure("malformed", jobId, job);
    }
  }

  throw jobFailure("timeout", jobId);
}

/**
 * Starts a queued AI operation and resolves with only its completed result.
 * Poll errors are deliberately transient: a brief connection interruption does
 * not discard the caller's in-progress UI or submitted values.
 */
export async function runLongJob<TResult>(
  path: string,
  init: ApiFetchInit,
  options: LongJobOptions<TResult> = {},
): Promise<TResult> {
  const queued = await apiFetch(path, init) as LongJobStatus<TResult>;
  if (!queued?.job_id) throw jobFailure("malformed", "");
  options.onQueued?.(queued.job_id);
  return pollLongJob<TResult>(queued.job_id, path, options);
}

async function _extractError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.detail ?? json?.message ?? "";
  } catch {
    return res.text();
  }
}
