import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Right-side detail drawer with backdrop and Escape-to-close. */
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-subtle bg-surface shadow-(--shadow-float)">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-subtle px-4">
          <h2 className="truncate text-subhead font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex size-10 items-center justify-center rounded-control text-secondary hover:bg-surface-2 hover:text-primary"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  )
}
