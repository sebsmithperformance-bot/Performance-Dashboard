/**
 * §4 Team Snapshot tile summaries — the scannable numbers on each clickable
 * tile. Assembled from the existing tested selectors; the drill-down drawers
 * render the full breakdowns. Display-ready strings only.
 */
import { formatDayLabel, formatMetricValue, formatPercentDelta } from '../../lib/dashboard/format.ts'
import { availabilityView } from '../../lib/dashboard/selectors/availability.ts'
import { lastSessionGpsView } from '../../lib/dashboard/selectors/last-session.ts'
import { bandFor, loadHealthView } from '../../lib/dashboard/selectors/load-health.ts'
import { scChangeView } from '../../lib/dashboard/selectors/sc-change.ts'
import { athleteFlagsView } from '../../lib/dashboard/selectors/speed-flags.ts'
import { DEFAULT_OVERVIEW_GPS_METRICS } from '../../lib/settings/defaults.ts'
import type { DashboardSettings } from '../../lib/settings/types.ts'
import type { DashboardDataset } from '../../lib/dashboard/types.ts'
import type { TileSummary } from './SnapshotTile.tsx'

export function snapshotSummaries(
  dataset: DashboardDataset,
  date: string,
  settings: DashboardSettings,
): Record<string, TileSummary> {
  const thresholds = settings.thresholds
  const avail = availabilityView(dataset, date, null)
  const workload = lastSessionGpsView(dataset, date, ['workload'])
  const lh = loadHealthView(dataset, date, null, thresholds)
  const flags = athleteFlagsView(dataset, date, thresholds)

  const gpsKeys =
    settings.display.overviewGpsMetrics.length > 0
      ? settings.display.overviewGpsMetrics
      : DEFAULT_OVERVIEW_GPS_METRICS
  const lastGps = lastSessionGpsView(dataset, date, gpsKeys)
  const primaryGps = lastGps?.metrics[0]
  const primaryGpsKpi = primaryGps ? dataset.kpis.get(primaryGps.kpiKey) : undefined
  const primaryGpsFmt =
    primaryGps && primaryGpsKpi ? formatMetricValue(primaryGps.value, primaryGpsKpi) : null

  const scKpis = [...dataset.kpis.values()].filter(
    (k) => k.category === 'Strength' || k.category === 'Power',
  )
  const scKey =
    settings.display.defaultScChangeKpi &&
    scKpis.some((k) => k.key === settings.display.defaultScChangeKpi)
      ? settings.display.defaultScChangeKpi
      : scKpis[0]?.key
  const sc = scKey
    ? scChangeView(dataset, scKey, settings.display.defaultComparisonBasis, null, date, undefined, thresholds)
    : null
  const scKpi = scKey ? dataset.kpis.get(scKey) : undefined

  const medianBand = lh.teamMedianAcwr !== null ? bandFor(lh.teamMedianAcwr, thresholds) : null
  const incompleteCount = lh.counts.incomplete + lh.counts.insufficient
  const workloadMetric = workload?.metrics[0]
  const completeness =
    lastGps && lastGps.expectedParticipants > 0
      ? Math.round((lastGps.participants / lastGps.expectedParticipants) * 100)
      : null

  return {
    availability: {
      label: 'Availability',
      value: `${avail.counts.full_go}`,
      unit: 'Full Go',
      sub: `${avail.counts.limited} limited · ${avail.counts.out} out`,
      note: `${avail.totalActive} active roster`,
      accent: 'good',
    },
    workload: {
      label: 'Workload',
      value: workloadMetric?.value != null ? workloadMetric.value.toFixed(1) : '—',
      unit: '/ 10',
      sub: `Team avg · ${workload?.participants ?? 0} athletes`,
      note:
        workloadMetric?.deltaPct != null
          ? `${formatPercentDelta(workloadMetric.deltaPct)} vs prior`
          : undefined,
      accent: 'neutral',
    },
    load_health: {
      label: 'Load Health',
      value: lh.teamMedianAcwr !== null ? lh.teamMedianAcwr.toFixed(2) : '—',
      unit: 'median ACWR',
      sub: `${lh.validCount} valid · ${incompleteCount} incomplete`,
      note:
        medianBand === 'high'
          ? 'Substantially elevated'
          : medianBand === 'elevated'
            ? 'Elevated acute load'
            : medianBand === 'below'
              ? 'Below recent workload'
              : 'Within range',
      accent: medianBand === 'high' ? 'danger' : medianBand === 'elevated' ? 'warning' : 'good',
    },
    speed_flags: {
      label: 'Speed Flags',
      value: String(flags.flags.length),
      unit: flags.flags.length === 1 ? 'flag' : 'flags',
      sub: `< ${flags.thresholdPct}% of baseline`,
      note:
        flags.insufficientBaseline.length > 0
          ? `${flags.insufficientBaseline.length} insufficient baseline`
          : `${flags.evaluated} evaluated`,
      accent: flags.flags.length > 0 ? 'warning' : 'good',
    },
    last_session_gps: {
      label: 'Last Session GPS',
      value: primaryGpsFmt?.text ?? '—',
      unit: primaryGpsFmt?.unit ?? undefined,
      sub: primaryGps ? `${primaryGps.label} · ${lastGps!.participants} athletes` : undefined,
      note: lastGps
        ? `${lastGps.session.label}${primaryGps?.deltaPct != null ? ` · ${formatPercentDelta(primaryGps.deltaPct)}` : ''}`
        : undefined,
      accent: 'info',
    },
    sc_change: {
      label: 'S&C Change',
      value: sc ? (formatPercentDelta(sc.medianDeltaPct) ?? '—') : '—',
      unit: scKpi?.displayName,
      sub: sc ? `team median ${sc.basisLabel}` : undefined,
      note: sc ? `${sc.withData}/${sc.groupSize} comparable` : undefined,
      accent: 'neutral',
    },
    data_completeness: {
      label: 'Data Completeness',
      value: completeness !== null ? `${completeness}%` : '—',
      unit: undefined,
      sub: lastGps ? `${lastGps.participants}/${lastGps.expectedParticipants} complete` : undefined,
      note:
        lastGps && lastGps.session ? `latest valid ${formatDayLabel(lastGps.session.date)}` : undefined,
      accent: lastGps && lastGps.missingDevice > 0 ? 'warning' : 'good',
    },
  }
}
