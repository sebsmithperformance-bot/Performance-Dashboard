/**
 * Overview KPI strip (§ visual redesign 7): the compact top row of team-level
 * numbers, assembled from the existing tested view models. Team GPS values are
 * averages per participating athlete (never hidden totals); counts stay counts.
 * Display-ready strings only — the card is a dumb presenter.
 */
import { formatInt, formatMetricValue } from '../format.ts'
import type { DashboardDataset } from '../types.ts'
import { DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
import type { ThresholdSettings } from '../../settings/types.ts'
import { availabilityView } from './availability.ts'
import { lastSessionGpsView } from './last-session.ts'
import { bandFor, loadHealthView } from './load-health.ts'
import { athleteFlagsView } from './speed-flags.ts'

export type KpiAccent = 'good' | 'warning' | 'danger' | 'neutral' | 'info' | 'brand'

export interface OverviewKpi {
  id: string
  label: string
  value: string
  unit?: string
  sub?: string
  note?: string
  accent?: KpiAccent
}

const STRIP_METRICS = ['player_load', 'high_speed_distance', 'top_speed', 'total_distance']

export function overviewKpiStrip(
  dataset: DashboardDataset,
  date: string,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
): OverviewKpi[] {
  const avail = availabilityView(dataset, date, null)
  const last = lastSessionGpsView(dataset, date, STRIP_METRICS)
  const lh = loadHealthView(dataset, date, null, thresholds)
  const flags = athleteFlagsView(dataset, date, thresholds)

  const gps = (kpiKey: string, label: string): OverviewKpi => {
    const kpi = dataset.kpis.get(kpiKey)
    const metric = last?.metrics.find((m) => m.kpiKey === kpiKey)
    const f = kpi ? formatMetricValue(metric?.value ?? null, kpi) : null
    return {
      id: kpiKey,
      label,
      value: f?.text ?? '—',
      unit: f?.unit ?? undefined,
      sub: last ? `Team Average · ${last.participants} athletes` : undefined,
    }
  }

  const medianBand = lh.teamMedianAcwr !== null ? bandFor(lh.teamMedianAcwr, thresholds) : null
  const completeness =
    last && last.expectedParticipants > 0
      ? Math.round((last.participants / last.expectedParticipants) * 100)
      : null

  return [
    {
      id: 'available',
      label: 'Available',
      value: String(avail.counts.full_go),
      sub: `${avail.counts.limited} limited · ${avail.counts.out} out`,
      note: `${avail.totalActive} active${avail.noEntry ? ` · ${avail.noEntry} unreported` : ''}`,
      accent: 'good',
    },
    gps('player_load', 'Player Load'),
    {
      id: 'acute7',
      label: 'Acute 7-day Load',
      value: lh.avgAcute7dLoad !== null ? formatInt(lh.avgAcute7dLoad) : '—',
      unit: 'AU',
      sub: 'Team avg per athlete',
    },
    {
      id: 'median_acwr',
      label: 'Median ACWR',
      value: lh.teamMedianAcwr !== null ? lh.teamMedianAcwr.toFixed(2) : '—',
      sub: `${lh.validCount} valid athletes`,
      note:
        medianBand === 'elevated' || medianBand === 'high'
          ? 'Elevated acute load'
          : medianBand === 'below'
            ? 'Below recent workload'
            : 'Within range',
      accent: medianBand === 'high' ? 'danger' : medianBand === 'elevated' ? 'warning' : 'good',
    },
    gps('high_speed_distance', 'High-Speed Distance'),
    gps('top_speed', 'Top Speed'),
    {
      id: 'speed_flags',
      label: 'Speed Flags',
      value: String(flags.flags.length),
      sub: `< ${flags.thresholdPct}% of baseline`,
      note: flags.flags.length > 0 ? `${flags.evaluated} evaluated` : 'none flagged',
      accent: flags.flags.length > 0 ? 'warning' : 'good',
    },
    {
      id: 'completeness',
      label: 'Data Completeness',
      value: completeness !== null ? `${completeness}%` : '—',
      sub: last ? `${last.participants}/${last.expectedParticipants} device data` : undefined,
      note: last && last.missingDevice > 0 ? `${last.missingDevice} missing device` : undefined,
      accent: last && last.missingDevice > 0 ? 'warning' : 'good',
    },
  ]
}
