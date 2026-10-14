export type AuthMode = "signin" | "signup";

export function initialAuthMode(pathname: string): AuthMode {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return /(?:^|\/)register$/.test(normalizedPath) ? "signup" : "signin";
}
