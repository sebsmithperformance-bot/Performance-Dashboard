import { useMemo } from 'react'
import { InfoHint } from '../../../components/ui/InfoHint.tsx'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import { lastSessionGpsView } from '../../../lib/dashboard/selectors/last-session.ts'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

/** §4 Data Completeness drill-down: which athletes are missing device data on
 *  the latest GPS session, and the latest valid date. Missing ≠ zero. */
export function DataCompletenessDetail({
  dataset,
  date,
}: {
  dataset: DashboardDataset
  date: string
}) {
  const last = lastSessionGpsView(dataset, date, ['workload'])

  const missingAthletes = useMemo(() => {
    if (!last) return []
    const obs = dataset.observationsBySession.get(last.session.id) ?? []
    const withData = new Set(obs.map((o) => o.athleteId))
    return dataset.athletes
      .filter((a) => {
        const part = dataset.participationByKey.get(`${a.id}|${last.session.id}`)
        return part && part.exposureMin > 0 && !withData.has(a.id)
      })
      .map((a) => ({ name: a.fullName, position: a.position }))
  }, [dataset, last])

  if (!last) {
    return <p className="text-body text-secondary">No GPS session on or before this date.</p>
  }

  const complete = last.participants
  const incomplete = last.missingDevice

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-control bg-surface-2 px-3 py-2">
          <dt className="text-label text-muted">Complete</dt>
          <dd className="tabular text-subhead font-semibold text-good">{complete}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-3 py-2">
          <dt className="text-label text-muted">Incomplete</dt>
          <dd className="tabular text-subhead font-semibold">{incomplete}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-3 py-2">
          <dt className="text-label text-muted">Latest valid</dt>
          <dd className="tabular text-body font-semibold">{formatDayLabel(last.session.date)}</dd>
        </div>
      </dl>

      <div>
        <h3 className="mb-2 section-label text-label text-secondary">
          Missing device data ({missingAthletes.length})
        </h3>
        {missingAthletes.length === 0 ? (
          <p className="text-body text-secondary">
            Every participating athlete has device data for {last.session.label}.
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col divide-y divide-subtle overflow-y-auto rounded-control border border-subtle">
            {missingAthletes.map((a) => (
              <li key={a.name} className="flex items-baseline gap-2 px-3 py-2">
                <span className="text-body font-medium">{a.name}</span>
                <span className="text-label text-muted">{a.position}</span>
                <span className="ml-auto text-label text-secondary">no device record</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="flex items-center gap-1 text-label text-muted">
        Missing is never counted as zero.
        <InfoHint label="About data completeness">
          A record is complete when a participating athlete produced a device observation for the
          session. A missing record is held out of that athlete’s rolling 7- and 28-day Workload
          windows (it poisons them) rather than being treated as a zero, so ACWR and trends stay
          honest.
        </InfoHint>
      </p>
    </div>
  )
}
