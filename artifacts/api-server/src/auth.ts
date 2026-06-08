import type { Request } from "express";
import jwt from "jsonwebtoken";
import { logger } from "./lib/logger";

/**
 * Verifies the LitigaForge access token issued by the Python backend.
 *
 * The Python service signs a short-lived HS256 JWT with SESSION_SECRET and a
 * payload of `{ sub: "<user_id>" }`. It is delivered as the httpOnly cookie
 * `lf_token` (path "/", so it reaches this Node service too) or as an
 * Authorization: Bearer header. We verify it here to identify the user for
 * Stripe checkout — never trusting a client-supplied user id.
 */

// Must match the Python backend's JWT signing secret. We never fall back to a
// hardcoded default: a known secret would let anyone forge tokens and act as any
// user. If it is missing we fail closed (deny all auth) rather than crash, so the
// frontend this server also hosts keeps serving.
const SECRET_KEY = process.env["SESSION_SECRET"];
if (!SECRET_KEY) {
  logger.error(
    "SESSION_SECRET is not set — Stripe auth is disabled (all tokens rejected).",
  );
}

function extractToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.["lf_token"];
  if (cookieToken) return cookieToken;

  const header = req.headers["authorization"] ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}

export function getUserId(req: Request): number | null {
  if (!SECRET_KEY) return null;
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    const sub = payload.sub;
    if (sub === undefined || sub === null) return null;
    const id = Number(sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
