import { Gauge } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AlertCard } from '../../../components/ui/AlertCard.tsx'
import { formatDayLabel } from '../../../lib/dashboard/format.ts'
import { athleteFlagsView } from '../../../lib/dashboard/selectors/speed-flags.ts'
import { useSettings } from '../../../lib/settings/SettingsContext.tsx'
import type { DashboardDataset } from '../../../lib/dashboard/types.ts'

/**
 * §4 Speed Flags drill-down — flagged athletes with the transparent rule
 * (current top speed, % of baseline, exposure, baseline size, threshold),
 * plus insufficient baselines listed separately (never flagged).
 */
export function FlagsDetail({ dataset, date }: { dataset: DashboardDataset; date: string }) {
  const { settings } = useSettings()
  const view = useMemo(
    () => athleteFlagsView(dataset, date, settings.thresholds),
    [dataset, date, settings.thresholds],
  )
  const [showInsufficient, setShowInsufficient] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      {view.session ? (
        <p className="text-label text-secondary">
          {view.session.label}, {formatDayLabel(view.session.date)} · rule: top speed below{' '}
          {view.thresholdPct}% of baseline best, needs ≥ {view.minBaseline} baseline sessions
        </p>
      ) : (
        <p className="text-label text-secondary">No speed-eligible session yet.</p>
      )}

      {view.session && view.flags.length === 0 && (
        <p className="text-body text-secondary">
          No speed flags — all {view.evaluated} evaluated athletes are at or above{' '}
          {view.thresholdPct}% of their baseline.
        </p>
      )}

      {view.flags.map((flag) => (
        <AlertCard
          key={flag.athleteId}
          tone="warning"
          icon={Gauge}
          headline={`${flag.name} — ${flag.percentOfBest.toFixed(1)}% of baseline top speed`}
        >
          <p className="tabular">
            {flag.position} · current {flag.currentTopSpeed.toFixed(1)} mph · baseline best{' '}
            {flag.baselineBest.toFixed(1)} mph (n={flag.baselineSize}) · threshold{' '}
            {view.thresholdPct}% · exposure{' '}
            {flag.exposureMin !== null ? `${flag.exposureMin} min` : 'unknown'}
          </p>
          <p>
            {flag.reason} — worth a coach review
            {flag.exposureMin !== null &&
            flag.exposureMin < settings.thresholds.speedMinExposureMin
              ? '; short exposure may under-expose maximal speed'
              : ' of recent exposure'}
            .
          </p>
        </AlertCard>
      ))}

      {view.insufficientBaseline.length > 0 && (
        <div className="text-label text-muted">
          <button
            type="button"
            className="underline decoration-dotted hover:text-primary"
            aria-expanded={showInsufficient}
            onClick={() => setShowInsufficient((v) => !v)}
          >
            {view.insufficientBaseline.length} athlete
            {view.insufficientBaseline.length === 1 ? '' : 's'} with insufficient baseline (not
            flagged)
          </button>
          {showInsufficient && (
            <ul className="mt-2 flex flex-col gap-1">
              {view.insufficientBaseline.map((a) => (
                <li key={a.athleteId} className="tabular">
                  {a.name} · {a.position} · {a.baselineSize}/{view.minBaseline} baseline sessions
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
