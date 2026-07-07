/**
 * eCourts Relay Worker
 *
 * Proxies requests to api.ecourts.gov.in from Cloudflare's edge network
 * (Indian PoPs via Smart Placement), bypassing Replit's US-based IP geo-block.
 *
 * Auth: backend sends Authorization: Bearer {ECOURTSINDIA_API_KEY} → relay
 * checks it against RELAY_SECRET env binding → forwards same header to eCourts.
 *
 * Smart Placement is enabled in wrangler.toml so CF routes Worker execution
 * close to api.ecourts.gov.in (Indian data-centre).
 */

const TARGET_BASE = "https://api.ecourts.gov.in/api/ords/ecourt";

export default {
  async fetch(request, env) {
    if (env.RELAY_SECRET) {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
      const ok =
        token === env.RELAY_SECRET ||
        (env.RELAY_SECRET_2 && token === env.RELAY_SECRET_2);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const url = new URL(request.url);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const outHeaders = new Headers(request.headers);
    outHeaders.delete("host");

    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = request.body;
    }

    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: outHeaders,
        body,
      });
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "relay_fetch_failed", detail: String(err) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
