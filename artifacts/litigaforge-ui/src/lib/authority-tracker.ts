import { apiFetch, ApiRequestError } from "./api";

export interface AuthorityMonitor {
  id: number;
  query?: string;
  citation?: string;
  last_checked_at?: string | null;
}

export interface AuthorityAlert {
  id: number;
  case_name: string;
  citation: string;
  source_url: string;
  source_name?: string;
  created_at: string;
}

export interface AuthorityTrackerData {
  searches: AuthorityMonitor[];
  watches: AuthorityMonitor[];
  alerts: AuthorityAlert[];
  referenceCount: number;
  error?: string;
}

type Collection<T> = { [key: string]: T[] | undefined };

function collection<T>(value: unknown, key: string): T[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as Record<string, unknown>)[key];
  return Array.isArray(items) ? items as T[] : [];
}

function rejectionMessage(reason: unknown): string {
  return reason instanceof ApiRequestError
    ? reason.message
    : reason instanceof Error ? reason.message : "Could not load research tools.";
}

export async function loadAuthorityTrackerData(): Promise<AuthorityTrackerData> {
  const results = await Promise.allSettled([
    apiFetch<Collection<AuthorityMonitor>>("/authorities/saved-searches"),
    apiFetch<Collection<AuthorityMonitor>>("/authorities/citation-watches"),
    apiFetch<Collection<AuthorityAlert>>("/authorities/alerts"),
    apiFetch<{ authorities?: unknown[] } | unknown[]>("/authorities"),
  ] as const);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");
  if (!fulfilled.length) {
    const reason = failures[0]?.status === "rejected" ? failures[0].reason : undefined;
    if (reason instanceof ApiRequestError) throw reason;
    throw new Error(rejectionMessage(reason));
  }

  const valueAt = <T,>(index: number): T | undefined => {
    const result = results[index];
    return result?.status === "fulfilled" ? result.value as T : undefined;
  };
  const authorityData = valueAt<{ authorities?: unknown[] } | unknown[]>(3);
  const authorities = Array.isArray(authorityData)
    ? authorityData
    : Array.isArray(authorityData?.authorities) ? authorityData.authorities : [];
  const error = failures.length
    ? rejectionMessage(failures[0]?.status === "rejected" ? failures[0].reason : undefined)
    : undefined;

  return {
    searches: collection<AuthorityMonitor>(valueAt(0), "searches"),
    watches: collection<AuthorityMonitor>(valueAt(1), "watches"),
    alerts: collection<AuthorityAlert>(valueAt(2), "alerts"),
    referenceCount: authorities.length,
    ...(error ? { error } : {}),
  };
}
