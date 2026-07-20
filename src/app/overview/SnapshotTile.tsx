import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { KpiAccent } from '../../lib/dashboard/selectors/overview-kpis.ts'

const ACCENT_BORDER: Record<KpiAccent, string> = {
  good: 'border-t-[var(--status-good)]',
  warning: 'border-t-[var(--status-warning)]',
  danger: 'border-t-[var(--status-danger)]',
  neutral: 'border-t-[var(--border-strong)]',
  info: 'border-t-[var(--status-info)]',
  brand: 'border-t-[var(--accent)]',
}

export interface TileSummary {
  label: string
  value: string
  unit?: string
  /** ≤6-word supporting line */
  sub?: string
  /** comparison / change line */
  note?: string
  accent?: KpiAccent
}

/**
 * §4 Team Snapshot tile: the WHOLE tile is one button that opens the tile's
 * detail drawer. Visible hover + focus states, pointer cursor, a "View details"
 * chevron cue, keyboard activation. Never more than one action per tile.
 */
export function SnapshotTile({
  icon: Icon,
  summary,
  onOpen,
}: {
  icon: LucideIcon
  summary: TileSummary
  onOpen: () => void
}) {
  const accent = summary.accent ?? 'neutral'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex min-w-0 cursor-pointer flex-col gap-2 rounded-card border border-subtle border-t-2 bg-surface p-4 text-left transition-colors duration-150 hover:border-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${ACCENT_BORDER[accent]}`}
    >
      <span className="flex items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
        <span className="section-label text-label text-secondary">{summary.label}</span>
        <ChevronRight
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted transition-colors group-hover:text-primary"
        />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="tabular text-kpi font-bold text-primary">{summary.value}</span>
        {summary.unit && <span className="text-label text-muted">{summary.unit}</span>}
      </span>
      {summary.sub && <span className="text-label text-secondary">{summary.sub}</span>}
      {summary.note && <span className="text-label text-muted">{summary.note}</span>}
      <span className="mt-auto pt-1 text-label font-medium text-muted group-hover:text-primary">
        View details
      </span>
    </button>
  )
}
