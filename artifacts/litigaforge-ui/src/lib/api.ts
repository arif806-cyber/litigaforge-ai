const BASE = "/litigaforge";

// Public endpoints that should NOT trigger a /login redirect on 401
const PUBLIC_PATH = /^\/(ask|clarify|contact|document\/analyze|documents\/paid|documents\/free|jobs\/|judgments|lawyers|legal-aid|chains|healthz|memory|stats|cases\?|research\/profile)/;

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
    if (!PUBLIC_PATH.test(path)) {
      // Attempt a silent token refresh and retry once
      const refreshed = await _tryRefresh();
      if (refreshed) {
        const retry = await fetch(`${BASE}${path}`, baseInit);
        if (!retry.ok) {
          if (retry.status === 401) {
            window.location.href = "/login";
            return;
          }
          const detail = await _extractError(retry);
          throw new Error(detail || `API error ${retry.status}`);
        }
        return retry.json();
      }
      // Refresh failed — session is truly expired
      window.location.href = "/login";
      return;
    }
    // Public endpoint 401 — fall through to error handling below
  }

  if (!res.ok) {
    const detail = await _extractError(res);
    throw new Error(detail || `API error ${res.status}`);
  }

  return res.json();
}

export type LongJobStatus<TResult> = {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: TResult;
  error?: string;
};

export const LONG_JOB_ERROR = "Something went wrong — your text is saved. Tap Retry.";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Starts a queued AI operation and resolves with only its completed result.
 * Poll errors are deliberately transient: a brief connection interruption does
 * not discard the caller's in-progress UI or submitted values.
 */
export async function runLongJob<TResult>(
  path: string,
  init: ApiFetchInit,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<TResult> {
  const queued = await apiFetch(path, init) as LongJobStatus<TResult>;
  if (!queued?.job_id) throw new Error(LONG_JOB_ERROR);

  const pollIntervalMs = options.pollIntervalMs ?? 2500;
  const deadline = Date.now() + (options.timeoutMs ?? 3 * 60 * 1000);

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    try {
      const job = await apiFetch(`/jobs/${encodeURIComponent(queued.job_id)}/status`) as LongJobStatus<TResult>;
      if (job.status === "completed") {
        if (job.result === undefined) throw new Error(LONG_JOB_ERROR);
        return job.result;
      }
      if (job.status === "failed") throw new Error(LONG_JOB_ERROR);
    } catch (error) {
      if (error instanceof Error && error.message === LONG_JOB_ERROR) throw error;
      // Polling is read-only; tolerate transient network/server failures.
    }
  }

  throw new Error(LONG_JOB_ERROR);
}

async function _extractError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.detail ?? json?.message ?? "";
  } catch {
    return res.text();
  }
}
