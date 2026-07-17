import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const TONE = {
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  good: 'var(--status-good)',
  neutral: 'var(--status-neutral)',
} as const

/**
 * Flag/alert card (§12.5): 4px semantic left border on a surface card, icon +
 * headline + the specific numbers — never a bare colored dot.
 */
export function AlertCard({
  tone,
  icon: Icon,
  headline,
  children,
}: {
  tone: keyof typeof TONE
  icon: LucideIcon
  headline: string
  children?: ReactNode
}) {
  return (
    <div
      className="rounded-card border border-subtle bg-surface p-3 pl-4"
      style={{ borderLeft: `4px solid ${TONE[tone]}` }}
    >
      <div className="flex items-start gap-2">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-body font-medium">{headline}</p>
          {children && <div className="mt-1 text-label text-secondary">{children}</div>}
        </div>
      </div>
    </div>
  )
}
