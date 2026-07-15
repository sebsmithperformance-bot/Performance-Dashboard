import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** §12.5 empty states: icon + one-line message + a clear next step — never a blank card. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-subtle bg-surface p-10 text-center">
      <Icon aria-hidden className="size-8 text-muted" strokeWidth={1.75} />
      <div>
        <h3 className="text-subhead font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-body text-secondary">{message}</p>
      </div>
      {action}
    </div>
  )
}
