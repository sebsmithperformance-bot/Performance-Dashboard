import { createContext, useContext, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { Trophy } from 'lucide-react'
import { CONTROL_CLASS, LabeledControl } from '../../components/controls/controls.tsx'
import { SavedRangeControl, useSavedRanges } from '../../components/controls/SavedRangeControl.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { InfoHint } from '../../components/ui/InfoHint.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { formatDayLabel, sessionTypeLabel } from '../../lib/dashboard/format.ts'
import {
  competitionResult,
  type CompetitionRange,
  type CompetitionResult,
} from '../../lib/dashboard/selectors/competition.ts'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'

interface CompetitionValue {
  result: CompetitionResult
}

const Ctx = createContext<CompetitionValue | null>(null)

export function useCompetition(): CompetitionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCompetition must be used inside CompetitionLayout')
  return v
}

type RangeKind = 'all' | 'session' | 'range'

/**
 * §10: Competition owns its OWN shared time range. Changing it updates only
 * the three Competition pages — never the date/session state elsewhere. The
 * range picker + accumulated result live here and flow to the pages via
 * context. The Date range mode reuses the shared saved-range control (scope
 * 'competition'), independent of the Performance Dashboard ranges (§6).
 */
export function CompetitionLayout() {
  const { status, dataset } = useDashboardData()
  const { settings } = useSettings()
  const competition = settings.competition

  const { defaultRange } = useSavedRanges('competition')
  const [kind, setKind] = useState<RangeKind>('all')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [custom, setCustom] = useState(() =>
    defaultRange
      ? { from: defaultRange.from, to: defaultRange.to }
      : { from: dataset?.seasonStart ?? '', to: dataset?.seasonEnd ?? '' },
  )

  const scoredSessions = useMemo(
    () =>
      dataset
        ? dataset.sessions.filter((s) => s.kind === 'lift' || s.kind === 'field').slice().reverse()
        : [],
    [dataset],
  )

  const range: CompetitionRange = useMemo(() => {
    if (kind === 'session' && (sessionId ?? scoredSessions[0]?.id))
      return { kind: 'session', sessionId: sessionId ?? scoredSessions[0]!.id }
    if (kind === 'range' && custom.from && custom.to)
      return { kind: 'custom', from: custom.from, to: custom.to }
    return { kind: 'all' }
  }, [kind, sessionId, custom, scoredSessions])

  const result = useMemo(
    () => (dataset ? competitionResult(dataset, competition, range) : null),
    [dataset, competition, range],
  )

  if (status === 'loading' || !dataset || !result) {
    return <Skeleton className="h-96 w-full" />
  }

  const anyEligible = Object.values(competition.eligibleKpis).some((e) => e.absolute || e.relative)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-subtle bg-surface p-3">
        <LabeledControl label="Competition range">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as RangeKind)}
            className={CONTROL_CLASS}
          >
            <option value="all">All time</option>
            <option value="session">Single session</option>
            <option value="range">Date range</option>
          </select>
        </LabeledControl>

        {kind === 'session' && (
          <LabeledControl label="Session">
            <select
              value={sessionId ?? scoredSessions[0]?.id ?? ''}
              onChange={(e) => setSessionId(e.target.value)}
              className={CONTROL_CLASS}
            >
              {scoredSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDayLabel(s.date)} · {sessionTypeLabel(s.type)} · {s.label}
                </option>
              ))}
            </select>
          </LabeledControl>
        )}
        {kind === 'range' && (
          <SavedRangeControl scope="competition" value={custom} onChange={setCustom} />
        )}

        <span className="ml-auto flex items-center gap-1 text-label text-muted">
          {result.scoredSessions} sessions · {result.scoredEvents} scored events
          <InfoHint label="About competition scoring" align="end">
            For each scored session × eligible KPI × scoring mode, valid athletes are ranked
            (direction-aware), each place converts to points via the dated scoring profile, and
            points accumulate over the selected range. Standings are the accumulation — never one
            best session. Only Competition-eligible KPIs score.
          </InfoHint>
        </span>
      </div>

      {!anyEligible ? (
        <EmptyState
          icon={Trophy}
          title="No Competition KPIs enabled"
          message="Enable Competition-eligible KPIs and scoring in Admin → Competition Settings."
        />
      ) : (
        <Ctx.Provider value={{ result }}>
          <Outlet />
        </Ctx.Provider>
      )}
    </div>
  )
}
