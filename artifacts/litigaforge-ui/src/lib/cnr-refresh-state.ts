const LEGACY_CNR_REFRESH_ERROR =
  /(?:ecourts\s+api.*unreachable.*server|(?:requires.*)?indian.*network.*ip)/i;

export type CnrRefreshViewState = {
  status: "pending" | "failed" | "other";
  error: string | null;
  legacy: boolean;
};

export function isLegacyCnrRefreshError(value: unknown): boolean {
  return typeof value === "string" && LEGACY_CNR_REFRESH_ERROR.test(value);
}

export function normalizeCnrRefreshState(
  status: unknown,
  error: unknown,
): CnrRefreshViewState {
  const statusText = typeof status === "string" ? status : "";
  const errorText = typeof error === "string" ? error.trim() : "";
  const legacy =
    isLegacyCnrRefreshError(statusText) || isLegacyCnrRefreshError(errorText);

  if (legacy) {
    return { status: "pending", error: null, legacy: true };
  }

  return {
    status: statusText === "pending" ? "pending" : statusText === "failed" ? "failed" : "other",
    error: errorText || null,
    legacy: false,
  };
}

export function currentCnrErrorMessage(value: unknown, fallback: string): string {
  const errorObject =
    value && typeof value === "object"
      ? (value as { detail?: unknown; message?: unknown })
      : undefined;
  const message =
    typeof value === "string"
      ? value
      : typeof errorObject?.detail === "string"
        ? errorObject.detail
        : typeof errorObject?.message === "string"
          ? errorObject.message
          : "";

  if (isLegacyCnrRefreshError(message)) {
    return "That CNR error came from an older lookup path. Submit again to use the eCourts India Partner API.";
  }
  return message.trim() || fallback;
}
