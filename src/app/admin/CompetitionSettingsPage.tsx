import { useMemo } from 'react'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { InfoHint } from '../../components/ui/InfoHint.tsx'
import { Skeleton } from '../../components/ui/Skeleton.tsx'
import { CONTROL_CLASS } from '../../components/controls/controls.tsx'
import { useDashboardData } from '../../lib/dashboard/DashboardDataContext.tsx'
import { useSettings } from '../../lib/settings/SettingsContext.tsx'
import type { CompetitionKpiEligibility } from '../../lib/settings/types.ts'

function Section({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-subtle bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-1 text-subhead font-semibold">
        {title}
        {info && <InfoHint label={`About ${title}`}>{info}</InfoHint>}
      </h2>
      {children}
    </section>
  )
}

/** Admin → Competition Settings (§10): teams, athlete assignments, body
 *  weight, KPI eligibility, points scale, page visibility, kiosk flags. Kept
 *  in Admin, separate from performance monitoring. */
export function CompetitionSettingsPage() {
  const { status, dataset } = useDashboardData()
  const { settings, updateCompetition } = useSettings()
  const c = settings.competition

  const scoreKpis = useMemo(
    () =>
      dataset
        ? [...dataset.kpis.values()].filter(
            (k) =>
              (k.category === 'Strength' || k.category === 'Power') &&
              (k.interpretation === 'higher_is_better' || k.interpretation === 'lower_is_better'),
          )
        : [],
    [dataset],
  )

  if (status === 'loading' || !dataset) return <Skeleton className="h-96 w-full" />

  const profile = c.scoringProfiles.find((p) => p.id === c.defaultProfileId) ?? c.scoringProfiles[0]

  const setEligibility = (key: string, patch: Partial<CompetitionKpiEligibility>) => {
    const cur = c.eligibleKpis[key] ?? { absolute: false, relative: false }
    const next = { ...cur, ...patch }
    const eligibleKpis = { ...c.eligibleKpis }
    if (!next.absolute && !next.relative) delete eligibleKpis[key]
    else eligibleKpis[key] = next
    updateCompetition({ eligibleKpis })
  }

  const setPlacePoints = (raw: string) => {
    const placePoints = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
    if (!profile) return
    updateCompetition({
      scoringProfiles: c.scoringProfiles.map((p) =>
        p.id === profile.id ? { ...p, placePoints } : p,
      ),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Competition Settings"
        description="Points scoring is isolated to the Competition section."
      />

      <Section
        title="Scoring scale"
        info="Points awarded by finishing place, 1st place first. Places past the end score 0. This is the default dated scoring profile."
      >
        <label className="flex flex-col gap-1 text-label text-muted">
          Place → points (comma separated, 1st first)
          <input
            type="text"
            defaultValue={profile?.placePoints.join(', ') ?? ''}
            onBlur={(e) => setPlacePoints(e.target.value)}
            className={`${CONTROL_CLASS} max-w-md`}
          />
        </label>
      </Section>

      <Section
        title="Eligible KPIs"
        info="Only these KPIs generate competition points. Workload, ACWR, monotony, strain, availability and health metrics can never be scored."
      >
        <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
          {scoreKpis.map((k) => {
            const e = c.eligibleKpis[k.key] ?? { absolute: false, relative: false }
            return (
              <li key={k.key} className="flex flex-wrap items-center gap-4 px-3 py-2">
                <span className="min-w-40 flex-1 text-body font-medium">{k.displayName}</span>
                <label className="flex items-center gap-2 text-label">
                  <input
                    type="checkbox"
                    checked={e.absolute}
                    onChange={(ev) => setEligibility(k.key, { absolute: ev.target.checked })}
                    className="accent-(--accent)"
                  />
                  Absolute
                </label>
                <label className="flex items-center gap-2 text-label">
                  <input
                    type="checkbox"
                    checked={e.relative}
                    onChange={(ev) => setEligibility(k.key, { relative: ev.target.checked })}
                    className="accent-(--accent)"
                  />
                  Per body weight
                </label>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Teams &amp; body weight">
        <div className="mb-3 flex flex-wrap gap-2">
          {c.teams.map((t, i) => (
            <input
              key={t.id}
              type="text"
              defaultValue={t.name}
              onBlur={(e) =>
                updateCompetition({
                  teams: c.teams.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)),
                })
              }
              className={`${CONTROL_CLASS} w-40`}
              aria-label={`Team ${i + 1} name`}
            />
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-subtle rounded-control border border-subtle">
          {dataset.athletes.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-40 flex-1 text-body font-medium">{a.fullName}</span>
              <select
                value={c.athleteTeam[a.id] ?? ''}
                onChange={(e) =>
                  updateCompetition({ athleteTeam: { ...c.athleteTeam, [a.id]: e.target.value } })
                }
                className={CONTROL_CLASS}
                aria-label={`${a.fullName} team`}
              >
                <option value="">Auto</option>
                {c.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-label text-muted">
                Body wt (lb)
                <input
                  type="number"
                  min={0}
                  defaultValue={c.bodyWeightLb[a.id] ?? ''}
                  onBlur={(e) => {
                    const v = Number(e.target.value)
                    const bodyWeightLb = { ...c.bodyWeightLb }
                    if (Number.isFinite(v) && v > 0) bodyWeightLb[a.id] = v
                    else delete bodyWeightLb[a.id]
                    updateCompetition({ bodyWeightLb })
                  }}
                  className={`${CONTROL_CLASS} w-24`}
                  aria-label={`${a.fullName} body weight`}
                />
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Display"
        info="Competition page visibility now lives in Admin → Layout & Navigation."
      >
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={c.tvRotation}
              onChange={(e) => updateCompetition({ tvRotation: e.target.checked })}
              className="accent-(--accent)"
            />
            TV Rotation
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={c.splitScreen}
              onChange={(e) => updateCompetition({ splitScreen: e.target.checked })}
              className="accent-(--accent)"
            />
            Split Screen
          </label>
        </div>
      </Section>
    </div>
  )
}
