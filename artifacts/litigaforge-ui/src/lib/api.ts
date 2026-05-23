const BASE = "/litigaforge";

export async function apiFetch(path: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("lf_token") : null;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.detail ?? json?.message ?? "";
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `API error ${res.status}`);
  }
  return res.json();
}
