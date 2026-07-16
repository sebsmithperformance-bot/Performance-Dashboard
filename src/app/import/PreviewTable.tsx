import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge.tsx'
import type { PreviewModel, PreviewRow } from '../../lib/import/validate.ts'

type Filter =
  | 'all'
  | 'errors'
  | 'warnings'
  | 'inserts'
  | 'updates'
  | 'skips'
  | 'unresolved_athletes'
  | 'unresolved_sessions'

const ACTION_TONE = {
  insert: 'good',
  update: 'warning',
  skip: 'neutral',
  error: 'danger',
} as const

function matches(row: PreviewRow, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'errors':
      return row.action === 'error'
    case 'warnings':
      return row.hasWarning
    case 'inserts':
      return row.action === 'insert'
    case 'updates':
      return row.action === 'update'
    case 'skips':
      return row.action === 'skip'
    case 'unresolved_athletes':
      return row.athleteState === 'unresolved'
    case 'unresolved_sessions':
      return row.sessionState === 'unresolved'
  }
}

const RENDER_CAP = 200

/** §4.2 step 8: preview table with filter chips and summary counts. */
export function PreviewTable({ preview }: { preview: PreviewModel }) {
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = useMemo(
    () => preview.rows.filter((r) => matches(r, filter)),
    [preview.rows, filter],
  )
  const s = preview.summary

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: preview.rows.length },
    { key: 'errors', label: 'Errors', count: s.observations.error },
    { key: 'warnings', label: 'Warnings', count: s.warnings },
    { key: 'inserts', label: 'Inserts', count: s.observations.insert },
    { key: 'updates', label: 'Updates', count: s.observations.update },
    { key: 'skips', label: 'Skips', count: s.observations.skip },
    { key: 'unresolved_athletes', label: 'Unresolved athletes', count: s.unresolvedAthletes },
    { key: 'unresolved_sessions', label: 'Unresolved sessions', count: s.unresolvedSessions },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Preview filters">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            aria-pressed={filter === chip.key}
            className={`rounded-full border px-3 py-1 text-label font-medium transition-colors duration-150 ${
              filter === chip.key
                ? 'border-accent bg-accent/15 text-primary'
                : 'border-subtle text-secondary hover:border-strong hover:text-primary'
            }`}
          >
            {chip.label} <span className="tabular">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-subtle">
        <table className="w-full min-w-[860px] text-body">
          <thead>
            <tr className="border-b border-subtle bg-surface text-left text-label text-muted">
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Athlete</th>
              <th className="px-3 py-2 font-medium">Session</th>
              <th className="px-3 py-2 font-medium">KPI</th>
              <th className="px-3 py-2 font-medium">Raw</th>
              <th className="px-3 py-2 font-medium">Canonical</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, RENDER_CAP).map((row, i) => (
              <tr
                key={`${row.sourceRowNumber}-${row.kpiKey ?? 'x'}-${i}`}
                className="border-b border-subtle last:border-b-0 hover:bg-surface-2"
              >
                <td className="tabular px-3 py-2 text-muted">{row.sourceRowNumber}</td>
                <td className="px-3 py-2">
                  {row.athleteLabel}
                  {row.athleteState === 'create' && <Badge tone="brand">new</Badge>}
                  {row.athleteState === 'unresolved' && <Badge tone="danger">unresolved</Badge>}
                </td>
                <td className="px-3 py-2">
                  {row.sessionLabel}
                  {row.sessionState === 'create' && <Badge tone="brand">new</Badge>}
                  {row.sessionState === 'unresolved' && <Badge tone="danger">pick</Badge>}
                </td>
                <td className="px-3 py-2">{row.kpiName ?? '—'}</td>
                <td className="tabular px-3 py-2">{row.rawValue || '—'}</td>
                <td className="tabular px-3 py-2">{row.valueCanonical ?? '—'}</td>
                <td className="px-3 py-2 text-muted">{row.unit ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge tone={ACTION_TONE[row.action]}>{row.action}</Badge>
                </td>
                <td className="max-w-[360px] px-3 py-2 text-label text-secondary">
                  {row.notes.join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > RENDER_CAP && (
          <p className="border-t border-subtle px-3 py-2 text-label text-muted">
            Showing first {RENDER_CAP} of {filtered.length} matching rows.
          </p>
        )}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-body text-secondary">No rows match this filter.</p>
        )}
      </div>
    </div>
  )
}
