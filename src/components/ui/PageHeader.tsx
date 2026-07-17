import type { ReactNode } from 'react'

/** Intra-page header row: optional title/description plus right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title?: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end gap-3">
      {(title || description) && (
        <div className="min-w-0">
          {title && <h2 className="text-widget font-semibold">{title}</h2>}
          {description && <p className="mt-0.5 text-label text-secondary">{description}</p>}
        </div>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
