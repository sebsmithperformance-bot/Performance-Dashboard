import { TriangleAlert } from 'lucide-react'
import { Button } from './Button.tsx'

/** Failure state with a concrete next step — never a blank card (§12.5). */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-card border border-danger/40 bg-surface p-10 text-center"
    >
      <TriangleAlert aria-hidden className="size-8 text-danger" strokeWidth={1.75} />
      <div>
        <h3 className="text-subhead font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-body text-secondary">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
