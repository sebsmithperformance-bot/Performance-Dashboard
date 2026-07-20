import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Condensable panel (spec §6.1, §12.5): every persistent dashboard card has a
 * compact state — a single ~48px row with icon, title, and its one most
 * important value — never fully hidden. 200ms ease-out via grid-rows.
 */
export function Panel({
  icon: Icon,
  title,
  keyValue,
  defaultCondensed = false,
  className = '',
  children,
}: {
  icon: LucideIcon
  title: string
  /** The one number/summary shown while condensed. */
  keyValue?: string
  defaultCondensed?: boolean
  /** layout hook, e.g. h-full so grid rows align without blank space */
  className?: string
  children: ReactNode
}) {
  const [condensed, setCondensed] = useState(defaultCondensed)

  return (
    <section className={`rounded-card border border-subtle bg-surface ${className}`}>
      <button
        type="button"
        onClick={() => setCondensed((c) => !c)}
        aria-expanded={!condensed}
        className="flex h-12 w-full items-center gap-3 px-5 text-left"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-secondary" strokeWidth={1.75} />
        <span className="section-label text-subhead text-primary">{title}</span>
        {condensed && keyValue !== undefined && (
          <span className="tabular ml-auto text-body font-semibold text-secondary">{keyValue}</span>
        )}
        <ChevronDown
          aria-hidden
          className={`${condensed ? '-rotate-90' : ''} ${condensed && keyValue !== undefined ? '' : 'ml-auto'} size-4 shrink-0 text-muted transition-transform duration-200 ease-out`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: condensed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </section>
  )
}
