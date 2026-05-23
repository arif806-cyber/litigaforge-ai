export function ErrorMessage({
  error,
  onRetry,
}: {
  error: string | Error | unknown
  onRetry?: () => void
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred"

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        background: "var(--color-background-danger)",
        border: "0.5px solid var(--color-border-danger)",
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 14,
        color: "var(--color-text-danger)",
      }}
    >
      <span>⚠</span>
      <div style={{ flex: 1 }}>
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginLeft: 12,
              fontSize: 13,
              color: "var(--color-text-danger)",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
