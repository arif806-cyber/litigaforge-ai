type McpConnectorAccess = {
  enabled: boolean;
  role?: string | null;
  hasAdvocateProfile: boolean;
  isAdmin: boolean;
  activePortal: "client" | "advocate";
};

export function canShowMcpConnector({
  enabled,
  role,
  hasAdvocateProfile,
  isAdmin,
  activePortal,
}: McpConnectorAccess): boolean {
  if (!enabled) return false;
  if (isAdmin) return true;
  return activePortal === "advocate"
    && (role === "advocate" || role === "lawyer")
    && hasAdvocateProfile;
}
