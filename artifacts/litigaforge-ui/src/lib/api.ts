const BASE = "/litigaforge";

function getToken(): string | null {
  return localStorage.getItem("lf_token");
}

export async function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}
