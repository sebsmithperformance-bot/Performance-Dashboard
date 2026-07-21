import { UserCheck, UserPlus, UserX } from 'lucide-react'
import { Badge } from '../../components/ui/Badge.tsx'
import { Button } from '../../components/ui/Button.tsx'
import type { PreviewBundle } from '../../lib/import/backend.ts'
import type { AthleteDecision } from '../../lib/import/resolve-athletes.ts'
import type { SessionDecision } from '../../lib/import/resolve-sessions.ts'
import type { KpiConfig } from '../../lib/import/types.ts'

/** Unmapped source headers: map to an existing KPI or ignore (§4.2 step 5). */
export function MappingPanel({
  bundle,
  onMap,
  onIgnore,
}: {
  bundle: PreviewBundle
  onMap: (header: string, kpiKey: string) => void
  onIgnore: (header: string) => void
}) {
  if (bundle.stage.unmappedHeaders.length === 0) return null
  const kpis = [...bundle.context.kpis.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )
  return (
    <section className="rounded-card border border-warning/40 bg-surface p-4">
      <h3 className="text-subhead font-semibold">Unmapped source headers</h3>
      <p className="mt-1 text-label text-secondary">
        Map each to an existing KPI or ignore it for this import. Mappings persist for future
        imports. Creating a brand-new KPI requires full configuration in Metric Settings first.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {bundle.stage.unmappedHeaders.map((header) => (
          <li key={header} className="flex flex-wrap items-center gap-2">
            <code className="rounded-control bg-surface-2 px-2 py-1 text-label">{header}</code>
            <MapSelect header={header} kpis={kpis} onMap={onMap} />
            <Button variant="ghost" onClick={() => onIgnore(header)}>
              Ignore
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function MapSelect({
  header,
  kpis,
  onMap,
}: {
  header: string
  kpis: KpiConfig[]
  onMap: (header: string, kpiKey: string) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Map {header} to KPI</span>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value !== '') onMap(header, e.target.value)
        }}
        className="h-9 rounded-control border border-subtle bg-surface-2 px-2 text-body"
      >
        <option value="" disabled>
          Map to existing KPI…
        </option>
        {kpis.map((kpi) => (
          <option key={kpi.key} value={kpi.key}>
            {kpi.displayName} ({kpi.canonicalUnit})
          </option>
        ))}
      </select>
    </label>
  )
}

/** Athlete ladder outcomes needing a human decision (§4.2 step 4). */
export function AthletePanel({
  bundle,
  onDecide,
}: {
  bundle: PreviewBundle
  onDecide: (refKey: string, decision: AthleteDecision | null) => void
}) {
  const needsAttention = bundle.athleteItems.filter(
    (i) => i.resolution.status !== 'matched' || i.decision !== undefined,
  )
  if (needsAttention.length === 0) return null

  return (
    <section className="rounded-card border border-subtle bg-surface p-4">
      <h3 className="text-subhead font-semibold">Athlete resolution</h3>
      <p className="mt-1 text-label text-secondary">
        Fuzzy matches are suggestions only — confirm, create, or skip. Nothing is created
        automatically.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {needsAttention.map((item) => (
          <li key={item.refKey} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.rawName}</span>
            <span className="tabular text-label text-muted">{item.rowCount} rows</span>
            {item.decision !== undefined ? (
              <>
                <Badge tone={item.decision.action === 'skip' ? 'neutral' : 'good'}>
                  {item.decision.action === 'use'
                    ? 'match confirmed'
                    : item.decision.action === 'create'
                      ? 'will create athlete'
                      : 'skipped for this import'}
                </Badge>
                <Button variant="ghost" onClick={() => onDecide(item.refKey, null)}>
                  Undo
                </Button>
              </>
            ) : (
              <>
                {item.resolution.status === 'suggested' &&
                  item.resolution.candidates.map((c) => (
                    <Button
                      key={c.athleteId}
                      variant="secondary"
                      onClick={() =>
                        onDecide(item.refKey, { action: 'use', athleteId: c.athleteId })
                      }
                    >
                      <UserCheck aria-hidden className="size-4" />
                      Use {c.name} ({Math.round(c.score * 100)}%)
                    </Button>
                  ))}
                {item.resolution.status === 'unmatched' && (
                  <Badge tone="danger">no roster match</Badge>
                )}
                <Button
                  variant="secondary"
                  onClick={() => onDecide(item.refKey, { action: 'create' })}
                >
                  <UserPlus aria-hidden className="size-4" />
                  Create new athlete
                </Button>
                <Button variant="ghost" onClick={() => onDecide(item.refKey, { action: 'skip' })}>
                  <UserX aria-hidden className="size-4" />
                  Skip
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Ambiguous sessions need a manual pick (§4.2 step 3). */
export function SessionPanel({
  bundle,
  onDecide,
}: {
  bundle: PreviewBundle
  onDecide: (refKey: string, decision: SessionDecision | null) => void
}) {
  const ambiguous = bundle.sessionItems.filter(
    (i) => i.resolution.status === 'ambiguous' || i.decision !== undefined,
  )
  if (ambiguous.length === 0) return null

  return (
    <section className="rounded-card border border-subtle bg-surface p-4">
      <h3 className="text-subhead font-semibold">Session resolution</h3>
      <p className="mt-1 text-label text-secondary">
        Several existing sessions could own these rows — pick one. Same-day sessions never merge.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {ambiguous.map((item) => (
          <li key={item.refKey} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {item.ref.date} · {item.ref.label} ({item.ref.type})
            </span>
            <span className="tabular text-label text-muted">{item.rowCount} rows</span>
            {item.decision !== undefined ? (
              <>
                <Badge tone="good">resolved</Badge>
                <Button variant="ghost" onClick={() => onDecide(item.refKey, null)}>
                  Undo
                </Button>
              </>
            ) : (
              item.resolution.status === 'ambiguous' &&
              item.resolution.candidates.map((c) => (
                <Button
                  key={c.id}
                  variant="secondary"
                  onClick={() => onDecide(item.refKey, { action: 'use', sessionId: c.id })}
                >
                  {c.startTime ?? '—'} {c.label}
                </Button>
              ))
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
