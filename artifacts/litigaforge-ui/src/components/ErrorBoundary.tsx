import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  section?: string
}
interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <p style={{ fontSize: 15, marginBottom: 8 }}>
              Something went wrong loading this section.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{ fontSize: 13 }}
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
