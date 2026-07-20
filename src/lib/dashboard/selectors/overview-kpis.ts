/**
 * Overview KPI strip (§ visual redesign 7): the compact top row of team-level
 * numbers, assembled from the existing tested view models. Team GPS values are
 * averages per participating athlete (never hidden totals); counts stay counts.
 * Display-ready strings only — the card is a dumb presenter.
 */
import { formatDayLabel, formatInt, formatMetricValue, formatPercentDelta } from '../format.ts'
import type { DashboardDataset } from '../types.ts'
import { DEFAULT_OVERVIEW_GPS_METRICS, DEFAULT_THRESHOLDS } from '../../settings/defaults.ts'
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

export interface OverviewStrip {
  cards: OverviewKpi[]
  /** which session the GPS averages come from, e.g. "Game W17 · Sun, Dec 6 · game" */
  sessionCaption: string | null
}

/**
 * The Team Snapshot strip owns the Overview's GPS summary — there is no
 * separate Last Session GPS panel, so the coach's chosen GPS metrics render as
 * cards here (Player Load leads by default).
 */
export function overviewKpiStrip(
  dataset: DashboardDataset,
  date: string,
  thresholds: ThresholdSettings = DEFAULT_THRESHOLDS,
  gpsMetricKeys: string[] = [],
): OverviewStrip {
  const keys = gpsMetricKeys.length > 0 ? gpsMetricKeys : DEFAULT_OVERVIEW_GPS_METRICS
  const avail = availabilityView(dataset, date, null)
  const last = lastSessionGpsView(dataset, date, keys)
  const lh = loadHealthView(dataset, date, null, thresholds)
  const flags = athleteFlagsView(dataset, date, thresholds)

  const gpsCards: OverviewKpi[] = (last?.metrics ?? []).map((metric) => {
    const kpi = dataset.kpis.get(metric.kpiKey)
    const f = kpi ? formatMetricValue(metric.value, kpi) : null
    const delta = formatPercentDelta(metric.deltaPct)
    return {
      id: metric.kpiKey,
      label: metric.label,
      value: f?.text ?? '—',
      unit: f?.unit ?? undefined,
      sub: `Team Average · ${last!.participants} athletes`,
      note: delta ? `${delta} vs prior session` : undefined,
    }
  })

  const medianBand = lh.teamMedianAcwr !== null ? bandFor(lh.teamMedianAcwr, thresholds) : null
  const completeness =
    last && last.expectedParticipants > 0
      ? Math.round((last.participants / last.expectedParticipants) * 100)
      : null

  return {
    sessionCaption: last
      ? `${last.session.label} · ${formatDayLabel(last.session.date)} · ${last.session.type}`
      : null,
    cards: [
      {
        id: 'available',
        label: 'Available',
        value: String(avail.counts.full_go),
        sub: `${avail.counts.limited} limited · ${avail.counts.out} out`,
        note: `${avail.totalActive} active${avail.noEntry ? ` · ${avail.noEntry} unreported` : ''}`,
        accent: 'good',
      },
      ...gpsCards,
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
    ],
  }
}
