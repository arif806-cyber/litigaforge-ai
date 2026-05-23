export function LoadingSpinner({
  message = "Loading...",
}: {
  message?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem",
        gap: 12,
        color: "var(--color-text-secondary)",
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: "2px solid var(--color-border-tertiary)",
          borderTopColor: "#D97706",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <span>{message}</span>
    </div>
  )
}
