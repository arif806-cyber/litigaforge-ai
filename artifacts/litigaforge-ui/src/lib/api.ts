const BASE = "/litigaforge";

// Public endpoints that should NOT trigger a /login redirect on 401
const PUBLIC_PATH = /^\/(ask|clarify|document\/analyze|judgments|lawyers|legal-aid|chains|healthz|memory|cases\?)/;

// Guard against concurrent refresh calls
let _refreshing: Promise<boolean> | null = null;

async function _tryRefresh(): Promise<boolean> {
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

export async function apiFetch(path: string, init?: RequestInit) {
  // Cookie-only auth: browser sends httpOnly cookie automatically
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (res.status === 401) {
    if (!PUBLIC_PATH.test(path)) {
      // Attempt a silent token refresh and retry once
      const refreshed = await _tryRefresh();
      if (refreshed) {
        const retry = await fetch(`${BASE}${path}`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...init?.headers,
          },
          ...init,
        });
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

async function _extractError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.detail ?? json?.message ?? "";
  } catch {
    return res.text();
  }
}
