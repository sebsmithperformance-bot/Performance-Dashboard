import { Info } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * Small info affordance: an icon button that reveals a short explanation in a
 * popover. Keeps formulas, band definitions, and methodology out of primary
 * page space (coach-feedback: reduce clutter) while leaving them one click
 * away. Closes on outside-click or Escape; toggle is keyboard-reachable.
 */
export function InfoHint({
  label = 'More detail',
  children,
  align = 'end',
}: {
  /** accessible name for the trigger */
  label?: string
  children: ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-secondary"
      >
        <Info aria-hidden className="size-3.5" />
      </button>
      {open && (
        <span
          id={panelId}
          role="note"
          className={`absolute top-6 z-30 w-64 rounded-card border border-subtle bg-surface p-3 text-label leading-relaxed text-secondary shadow-lg ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </span>
      )}
    </span>
  )
}
