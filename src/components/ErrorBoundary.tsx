import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface State {
  error: Error | null
}

/** Keeps a crash in one section from blanking the whole app. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Section crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page" role="alert" style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ font: '600 1.8rem/1.2 var(--font-display)' }}>This section hit a problem</h1>
        <p style={{ margin: '12px auto 24px', maxWidth: '48ch', color: 'var(--muted)' }}>
          Your progress is safe. Reload to try again, or go back to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
          <Link className="btn" to="/" onClick={() => this.setState({ error: null })}>
            Dashboard
          </Link>
        </div>
      </div>
    )
  }
}
