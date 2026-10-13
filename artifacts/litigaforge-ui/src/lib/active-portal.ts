export type ActivePortal = "client" | "advocate";

export function portalFromRole(role?: string | null): ActivePortal {
  return role === "advocate" || role === "lawyer" ? "advocate" : "client";
}

export function portalStorageKey(userId: number | string): string {
  return `lf_active_portal:${userId}`;
}

export function validPortal(value: string | null): value is ActivePortal {
  return value === "client" || value === "advocate";
}

export function portalDashboardPath(portal: ActivePortal): string {
  return portal === "advocate" ? "/lawyer-dashboard" : "/client-dashboard";
}

export function postAuthDestination(
  portal: ActivePortal,
  hasAdvocateProfile: boolean,
  safeNext: string | null,
): string {
  if (portal === "advocate" && !hasAdvocateProfile) return "/lawyers/register?setup=advocate";
  return safeNext ?? portalDashboardPath(portal);
}

// Navigation is determined by the user's active portal, never by the current URL.
export function clientNavigationActive(portal: ActivePortal, _path: string): boolean {
  return portal === "client";
}

function matchesRoute(path: string, route: string): boolean {
  return path === route || path.startsWith(`${route}/`);
}

export function portalForRoute(path: string, hasAdvocateProfile: boolean): ActivePortal | null {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const clientRoutes = ["/client-dashboard", "/post-case", "/my-cases", "/documents"];
  if (clientRoutes.some((route) => matchesRoute(pathname, route))) return "client";

  const advocateRoutes = ["/lawyer-dashboard", "/advocate-dashboard", "/advocate/cases", "/requests"];
  if (hasAdvocateProfile && advocateRoutes.some((route) => matchesRoute(pathname, route))) {
    return "advocate";
  }
  return null;
}
