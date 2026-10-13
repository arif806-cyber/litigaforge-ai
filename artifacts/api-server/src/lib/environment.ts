export function appEnvironment(): string {
  const explicit = process.env["APP_ENV"]?.trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env["REPLIT_DEPLOYMENT"]?.trim()) return "production";
  const legacy = (process.env["NODE_ENV"] ?? "").trim().toLowerCase();
  return legacy || "development";
}

export function schedulersEnabled(): boolean {
  const explicit = process.env["SCHEDULER_ENABLED"]?.trim().toLowerCase();
  if (explicit) return ["1", "true", "yes", "on"].includes(explicit);
  return ["production", "prod"].includes(appEnvironment());
}
