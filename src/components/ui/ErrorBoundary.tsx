import { AlertTriangle } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Button } from './Button.tsx'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * App-level error state (§12.5 / step 3 "error states"): an unexpected render
 * failure shows a styled recovery card instead of a blank page. No error
 * details are rendered — messages can contain data (§7.4 logging rules);
 * details stay in the console for local debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-base p-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-card border border-subtle bg-surface p-8 text-center">
          <AlertTriangle aria-hidden className="size-8 text-danger" strokeWidth={1.75} />
          <div>
            <h1 className="text-widget font-semibold">Something went wrong</h1>
            <p className="mt-1 text-body text-secondary">
              The dashboard hit an unexpected error. Reload to continue — no data was changed.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </main>
    )
  }
}
