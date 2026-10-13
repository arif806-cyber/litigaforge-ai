const BLOG_REPO = "arif806-cyber/litigaforge-blog";

export async function fetchRollingArticleQuota(
  token: string,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<number | null> {
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://api.github.com/repos/${BLOG_REPO}/commits?path=src/content/blog&since=${encodeURIComponent(since)}&per_page=100`;
  try {
    const response = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "litigaforge-vm-scheduler",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const commits: unknown = await response.json();
    return Array.isArray(commits) ? commits.length : null;
  } catch {
    return null;
  }
}
