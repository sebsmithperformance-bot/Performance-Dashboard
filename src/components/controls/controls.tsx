/**
 * Shared filter controls (Step 5 §1): consistent, token-pure selectors used
 * across every coach-facing page. Each is a labeled control — no unlabeled
 * icon-only inputs.
 */
import type { ReactNode } from 'react'
import { formatDayLabel } from '../../lib/dashboard/format.ts'
import type { DashKpi, DashSession, Position } from '../../lib/dashboard/types.ts'

export const CONTROL_CLASS =
  'h-9 rounded-control border border-subtle bg-surface-2 px-2 text-body text-primary focus:border-accent'

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-subtle bg-surface p-3">
      {children}
    </div>
  )
}

export function LabeledControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-label text-secondary">
      {label}
      {children}
    </label>
  )
}

const POSITIONS: Position[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']

/** Position filter as chips: All + the four editable groups. */
export function PositionSelector({
  value,
  onChange,
}: {
  value: Position | null
  onChange: (position: Position | null) => void
}) {
  const options: { key: string; label: string; position: Position | null }[] = [
    { key: 'all', label: 'All', position: null },
    ...POSITIONS.map((p) => ({ key: p, label: p + 's', position: p as Position | null })),
  ]
  return (
    <div role="group" aria-label="Position group" className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.position}
          onClick={() => onChange(option.position)}
          className={`rounded-full border px-3 py-1 text-label font-medium transition-colors duration-150 ${
            value === option.position
              ? 'border-accent bg-accent/15 text-primary'
              : 'border-subtle text-secondary hover:border-strong hover:text-primary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function MetricSelector({
  kpis,
  value,
  onChange,
  label = 'Metric',
}: {
  kpis: DashKpi[]
  value: string
  onChange: (kpiKey: string) => void
  label?: string
}) {
  return (
    <LabeledControl label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL_CLASS}>
        {kpis.map((kpi) => (
          <option key={kpi.key} value={kpi.key}>
            {kpi.displayName}
          </option>
        ))}
      </select>
    </LabeledControl>
  )
}

export function SessionPicker({
  dates,
  date,
  onDateChange,
  sessionsOnDate,
  sessionId,
  onSessionChange,
}: {
  dates: string[]
  date: string
  onDateChange: (date: string) => void
  sessionsOnDate: DashSession[]
  sessionId: string | null
  onSessionChange: (id: string) => void
}) {
  return (
    <>
      <LabeledControl label="Date">
        <select
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className={CONTROL_CLASS}
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDayLabel(d)}
            </option>
          ))}
        </select>
      </LabeledControl>
      {sessionsOnDate.length > 1 && (
        <LabeledControl label="Session">
          <select
            value={sessionId ?? sessionsOnDate[0]?.id}
            onChange={(e) => onSessionChange(e.target.value)}
            className={CONTROL_CLASS}
          >
            {sessionsOnDate.map((s) => (
              <option key={s.id} value={s.id}>
                {s.startTime} · {s.label}
              </option>
            ))}
          </select>
        </LabeledControl>
      )}
    </>
  )
}

export function DateRangeSelector({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  return (
    <>
      <LabeledControl label="From">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className={CONTROL_CLASS}
        />
      </LabeledControl>
      <LabeledControl label="To">
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className={CONTROL_CLASS}
        />
      </LabeledControl>
    </>
  )
}

export function AthleteSelector({
  athletes,
  value,
  onChange,
}: {
  athletes: { id: string; fullName: string }[]
  value: string | null
  onChange: (athleteId: string) => void
}) {
  return (
    <LabeledControl label="Athlete">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL_CLASS}
      >
        <option value="" disabled>
          Select athlete…
        </option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.fullName}
          </option>
        ))}
      </select>
    </LabeledControl>
  )
}

/** One season exists locally; the control stays for the multi-season future. */
export function SeasonSelector({ seasonLabel }: { seasonLabel: string }) {
  return (
    <LabeledControl label="Season">
      <select value={seasonLabel} onChange={() => undefined} className={CONTROL_CLASS}>
        <option value={seasonLabel}>{seasonLabel}</option>
      </select>
    </LabeledControl>
  )
}
