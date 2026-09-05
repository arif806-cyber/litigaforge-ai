/**
 * Browser origins permitted to call the public Node API or receive a
 * browser-facing redirect URL. Requests without an Origin header are
 * intentionally supported: webhooks, MCP clients, and server-to-server
 * proxies do not use browser CORS.
 */
const PRODUCTION_ORIGIN = "https://litigaforge.com";

const replitPreviewHost = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:replit\.app|replit\.dev|repl\.co)$/i;

function configuredReplitOrigins(): Set<string> {
  const origins = new Set<string>();
  const values = [
    process.env.REPLIT_DEV_DOMAIN,
    ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
  ];

  for (const value of values) {
    const domain = value?.trim();
    if (!domain) continue;
    try {
      const url = new URL(domain.includes("://") ? domain : `https://${domain}`);
      if (url.protocol === "https:" && !url.username && !url.password) {
        origins.add(url.origin);
      }
    } catch {
      // Environment configuration must not make the API more permissive.
    }
  }
  return origins;
}

const configuredOrigins = configuredReplitOrigins();

export function isTrustedBrowserOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (
      url.origin === PRODUCTION_ORIGIN ||
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return url.origin === PRODUCTION_ORIGIN;
    }

    return configuredOrigins.has(url.origin) || replitPreviewHost.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Never reflect an arbitrary Origin/Host into payment-provider return URLs.
 */
export function trustedFrontendOrigin(origin: string | undefined): string {
  return origin && isTrustedBrowserOrigin(origin) ? origin : PRODUCTION_ORIGIN;
}