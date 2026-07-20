import type { ReactNode } from 'react'

export type Accent = 'good' | 'warning' | 'danger' | 'neutral' | 'info' | 'brand'

const TOP_BORDER: Record<Accent, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--border-strong)',
  brand: 'var(--penn-crimson)',
}
const VALUE_COLOR: Record<Accent, string> = {
  good: 'text-good',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-primary',
  brand: 'text-primary',
}

/**
 * Compact KPI card (§ visual redesign E): a small uppercase label, one large
 * tabular value, a short descriptor, and one concise interpretation line.
 * Optional thin semantic top border; optional value tint (always paired with
 * text, never colour alone, §12.2). No formulas, buttons, or big icons inside.
 */
export type KpiSize = 'compact' | 'wide'

export function KpiCard({
  label,
  value,
  unit,
  sub,
  note,
  accent,
  valueTone,
  size = 'compact',
}: {
  label: string
  value: ReactNode
  unit?: string
  /** short descriptor under the value, e.g. "Team Average · 25 athletes" */
  sub?: string
  /** one concise interpretation line, e.g. "−2.1% vs prior session" */
  note?: string
  /** thin semantic top border */
  accent?: Accent
  /** tint the big value (paired with text elsewhere on the card) */
  valueTone?: Accent
  /** density — matches the strip it sits in */
  size?: KpiSize
}) {
  const wide = size === 'wide'
  return (
    <div
      className={`flex flex-col gap-1 rounded-card border border-subtle bg-surface ${
        wide ? 'min-h-[8.5rem] p-5' : 'min-h-[7rem] p-4'
      }`}
      style={accent ? { borderTop: `2px solid ${TOP_BORDER[accent]}` } : undefined}
    >
      <span className="section-label text-label text-muted">{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          className={`display tabular leading-none font-bold ${wide ? 'text-[2.75rem]' : 'text-kpi'} ${
            valueTone ? VALUE_COLOR[valueTone] : 'text-primary'
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-label text-muted">{unit}</span>}
      </div>
      {sub && <span className={wide ? 'text-label text-secondary' : 'truncate text-label text-secondary'}>{sub}</span>}
      {note && <span className={wide ? 'text-label text-muted' : 'truncate text-label text-muted'}>{note}</span>}
    </div>
  )
}

/**
 * Responsive KPI strip: auto-packs as many cards as fit — compact packs ~8 on
 * wide desktop / ~4 on tablet / 2 on mobile; wide gives each card more room
 * (and lets long descriptors wrap instead of truncating).
 */
export function KpiStrip({
  children,
  size = 'compact',
}: {
  children: ReactNode
  size?: KpiSize
}) {
  return (
    <div
      className={`grid gap-3 ${
        size === 'wide'
          ? '[grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]'
          : '[grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]'
      }`}
    >
      {children}
    </div>
  )
}

/** Small uppercase section header for analytical panels (§ visual redesign F). */
export function SectionHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="section-label text-subhead text-secondary">{title}</h2>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  )
}
