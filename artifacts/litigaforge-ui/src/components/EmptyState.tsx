export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        textAlign: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <p
        style={{
          fontSize: 15,
          fontWeight: 500,
          margin: 0,
          color: "var(--color-text-primary)",
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: 13,
            margin: 0,
            color: "var(--color-text-secondary)",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{ marginTop: 8, fontSize: 13 }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
