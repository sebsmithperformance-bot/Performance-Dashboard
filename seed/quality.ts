/**
 * Synthetic-data quality report (spec §8.12). Hard checks are invariants —
 * the generator fails loudly when one breaks. Soft checks are realism targets
 * reported for review. ACWR behavior is evaluated with the production
 * calculation layer, not a reimplementation.
 */
import { acwr, addDays, windowEndingAt, type DayLoad } from '../src/lib/calculations/index.ts'
import { GPS_HARD_BOUND_GK, GPS_HARD_BOUND_OUTFIELD } from './config.v1.ts'
import type { SimDataset } from './types.ts'

export interface QualityCheck {
  name: string
  level: 'hard' | 'soft'
  pass: boolean
  detail: string
}

export interface QualityReport {
  checks: QualityCheck[]
  hardFailures: string[]
  summary: Record<string, unknown>
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 3) return 0
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i += 1) {
    const a = (xs[i] as number) - mx
    const b = (ys[i] as number) - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy)
}

export function evaluateQuality(ds: SimDataset): QualityReport {
  const checks: QualityCheck[] = []
  const hard = (name: string, pass: boolean, detail: string) =>
    checks.push({ name, level: 'hard', pass, detail })
  const soft = (name: string, pass: boolean, detail: string) =>
    checks.push({ name, level: 'soft', pass, detail })

  const athleteById = new Map(ds.athletes.map((a) => [a.id, a]))
  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]))
  const partByKey = new Map(ds.participation.map((p) => [`${p.athleteId}|${p.sessionId}`, p]))

  // 1 — roster composition (§8.3)
  const positionCounts = new Map<string, number>()
  for (const a of ds.athletes) {
    positionCounts.set(a.position, (positionCounts.get(a.position) ?? 0) + 1)
  }
  hard(
    'roster is exactly 25: GK 3 / DEF 7 / MID 8 / FWD 7',
    ds.athletes.length === 25 &&
      positionCounts.get('Goalkeeper') === 3 &&
      positionCounts.get('Defender') === 7 &&
      positionCounts.get('Midfielder') === 8 &&
      positionCounts.get('Forward') === 7,
    JSON.stringify([...positionCounts.entries()]),
  )

  // 2 — per-row GPS invariants (§8.7 logical constraints, hard bounds)
  let gpsViolations: string[] = []
  for (const g of ds.gps) {
    const athlete = athleteById.get(g.athleteId)!
    const bound = athlete.position === 'Goalkeeper' ? GPS_HARD_BOUND_GK : GPS_HARD_BOUND_OUTFIELD
    const problems: string[] = []
    if (g.highSpeedDistanceYd > g.distanceYd) problems.push('hsd>distance')
    if (g.sprintDistanceYd > g.highSpeedDistanceYd) problems.push('sprintDist>hsd')
    if (g.distanceYd > bound.distance) problems.push('distance>hard')
    if (g.highSpeedDistanceYd > bound.hsd) problems.push('hsd>hard')
    if (g.playerLoadAu > bound.load) problems.push('load>hard')
    if (g.topSpeedMph > bound.top) problems.push('top>hard')
    if (g.sprints > bound.sprints) problems.push('sprints>hard')
    if (g.accelerations > bound.acc) problems.push('acc>hard')
    if (g.decelerations > bound.dec) problems.push('dec>hard')
    if (g.workload < 1 || g.workload > 10) problems.push('workload-range')
    if (g.topSpeedMph > athlete.traits.topSpeedCapacityMph * 1.01) problems.push('top>capacity')
    for (const [k, v] of Object.entries(g)) {
      if (typeof v === 'number' && (!Number.isFinite(v) || v < 0)) problems.push(`${k}-invalid`)
    }
    for (const k of ['sprints', 'accelerations', 'decelerations', 'highIntensityEvents'] as const) {
      if (!Number.isInteger(g[k])) problems.push(`${k}-not-integer`)
    }
    if (problems.length > 0)
      gpsViolations.push(`${g.athleteId}@${g.sessionId}: ${problems.join(',')}`)
  }
  hard(
    'every GPS row satisfies logical constraints and hard bounds',
    gpsViolations.length === 0,
    gpsViolations.slice(0, 5).join(' | ') || 'clean',
  )

  // 3 — zero exposure ⇒ no GPS row
  const zeroExposureRows = ds.gps.filter(
    (g) => (partByKey.get(`${g.athleteId}|${g.sessionId}`)?.exposureMin ?? 0) <= 0,
  )
  hard(
    'no GPS row exists for zero-minute exposures',
    zeroExposureRows.length === 0,
    `${zeroExposureRows.length} offending rows`,
  )

  // 4 — correlations (§8.12)
  const fieldRows = ds.gps.map((g) => ({
    g,
    exposure: partByKey.get(`${g.athleteId}|${g.sessionId}`)!.exposureMin,
    session: sessionById.get(g.sessionId)!,
    athlete: athleteById.get(g.athleteId)!,
  }))
  const outfield = fieldRows.filter((r) => r.athlete.position !== 'Goalkeeper')

  const rDistExp = pearson(
    outfield.map((r) => r.g.distanceYd),
    outfield.map((r) => r.exposure),
  )
  hard(
    `distance↔exposure correlation strong (r=${rDistExp.toFixed(3)})`,
    rDistExp > 0.6,
    'threshold 0.6',
  )

  const rSprHsd = pearson(
    outfield.map((r) => r.g.sprints),
    outfield.map((r) => r.g.highSpeedDistanceYd),
  )
  hard(
    `sprints↔high-speed-distance correlation (r=${rSprHsd.toFixed(3)})`,
    rSprHsd > 0.5,
    'threshold 0.5',
  )

  const gameRows = outfield.filter((r) => r.session.type === 'game')
  const rGameDist = pearson(
    gameRows.map((r) => r.g.distanceYd),
    gameRows.map((r) => r.exposure),
  )
  const rGameLoad = pearson(
    gameRows.map((r) => r.g.playerLoadAu),
    gameRows.map((r) => r.exposure),
  )
  hard(`game distance↔minutes (r=${rGameDist.toFixed(3)})`, rGameDist > 0.6, 'threshold 0.6')
  hard(`game player-load↔minutes (r=${rGameLoad.toFixed(3)})`, rGameLoad > 0.55, 'threshold 0.55')

  // 5 — top speed more stable within athlete than between (§8.12).
  // Only speed-exposing sessions with adequate exposure count: short cameos
  // legitimately under-expose maximal speed (§8.7) and are excluded by the
  // same rule the speed-flag UI will use.
  const speedExposing = outfield.filter(
    (r) => (r.session.type === 'game' || r.session.plannedIntensity >= 0.86) && r.exposure >= 25,
  )
  const byAthlete = new Map<string, number[]>()
  for (const r of speedExposing) {
    byAthlete.set(r.athlete.id, [...(byAthlete.get(r.athlete.id) ?? []), r.g.topSpeedMph])
  }
  const withinSds: number[] = []
  const athleteMeans: number[] = []
  for (const speeds of byAthlete.values()) {
    if (speeds.length >= 5) {
      withinSds.push(sd(speeds))
      athleteMeans.push(mean(speeds))
    }
  }
  const stabilityRatio = sd(athleteMeans) === 0 ? 1 : mean(withinSds) / sd(athleteMeans)
  hard(
    `top speed within-athlete sd ≪ between-athlete sd (ratio=${stabilityRatio.toFixed(3)})`,
    stabilityRatio < 0.7,
    'threshold 0.7',
  )

  // 6 — position behavior without caricature (§8.7/§8.12)
  const practiceGame = outfield.filter((r) => r.session.type !== 'recovery')
  const meanBy = (pos: string, f: (r: (typeof practiceGame)[number]) => number) =>
    mean(practiceGame.filter((r) => r.athlete.position === pos).map(f))
  const distByPos = {
    Midfielder: meanBy('Midfielder', (r) => r.g.distanceYd),
    Forward: meanBy('Forward', (r) => r.g.distanceYd),
    Defender: meanBy('Defender', (r) => r.g.distanceYd),
  }
  hard(
    `midfielders have highest team-average distance (${JSON.stringify(distByPos)})`,
    distByPos.Midfielder > distByPos.Forward && distByPos.Midfielder > distByPos.Defender,
    'MID > FWD && MID > DEF',
  )
  const athleteMeanDist = (pos: string): number[] => {
    const per = new Map<string, number[]>()
    for (const r of practiceGame.filter((x) => x.athlete.position === pos)) {
      per.set(r.athlete.id, [...(per.get(r.athlete.id) ?? []), r.g.distanceYd])
    }
    return [...per.values()].map(mean)
  }
  const midMeans = athleteMeanDist('Midfielder')
  const nonMidMax = Math.max(...athleteMeanDist('Forward'), ...athleteMeanDist('Defender'))
  hard(
    'not every midfielder outranks every other outfield athlete on distance',
    Math.min(...midMeans) < nonMidMax,
    `min MID mean ${Math.min(...midMeans).toFixed(0)} vs max non-MID ${nonMidMax.toFixed(0)}`,
  )
  const sprintRateBy = (pos: string) =>
    mean(
      practiceGame
        .filter((r) => r.athlete.position === pos && r.exposure > 0)
        .map((r) => r.g.sprints / r.exposure),
    )
  const fwdRate = sprintRateBy('Forward')
  hard(
    `forwards have highest sprint rate (FWD ${fwdRate.toFixed(4)}/min)`,
    fwdRate > sprintRateBy('Midfielder') && fwdRate > sprintRateBy('Defender'),
    'per-minute sprint rate',
  )
  const gkRows = fieldRows.filter((r) => r.athlete.position === 'Goalkeeper')
  const gkMeanDist = mean(gkRows.map((r) => r.g.distanceYd))
  const outfieldMeanDist = mean(outfield.map((r) => r.g.distanceYd))
  hard(
    `goalkeepers form a clearly lower GPS distribution (GK ${gkMeanDist.toFixed(0)} vs outfield ${outfieldMeanDist.toFixed(0)} yd)`,
    gkMeanDist < 0.55 * outfieldMeanDist,
    'GK mean < 55% of outfield mean',
  )

  // 7 — modified participation reduces exposure (§8.12)
  const practices = ds.participation.filter((p) => {
    const s = sessionById.get(p.sessionId)!
    return s.kind === 'field' && s.type === 'practice'
  })
  const fullExp = mean(practices.filter((p) => p.level === 'full').map((p) => p.exposureMin))
  const modExp = mean(practices.filter((p) => p.level === 'modified').map((p) => p.exposureMin))
  hard(
    `modified participation reduces exposure (${modExp.toFixed(0)} vs ${fullExp.toFixed(0)} min)`,
    modExp < fullExp * 0.85,
    'modified < 85% of full',
  )

  // 8 — availability coheres with participation (§8.12)
  const availByKey = new Map(ds.availability.map((a) => [`${a.athleteId}|${a.date}`, a.status]))
  const fieldParts = ds.participation.filter((p) => sessionById.get(p.sessionId)!.kind === 'field')
  const outParts = fieldParts.filter(
    (p) => availByKey.get(`${p.athleteId}|${sessionById.get(p.sessionId)!.date}`) === 'out',
  )
  const outAbsentShare =
    outParts.length === 0
      ? 1
      : outParts.filter((p) => p.level === 'absent').length / outParts.length
  hard(
    `'out' status reflected in participation (${(outAbsentShare * 100).toFixed(0)}% absent)`,
    outAbsentShare >= 0.85,
    'threshold 85%',
  )

  // 9 — strength stability (§8.8/§8.12): implied e1RM per athlete-exercise
  const liftProblems: string[] = []
  const liftSeries = new Map<string, { date: string; implied: number }[]>()
  for (const l of ds.lifts) {
    const part = partByKey.get(`${l.athleteId}|${l.sessionId}`)!
    if (part.level === 'modified') continue
    const session = sessionById.get(l.sessionId)!
    const pct = session.exercises?.find((e) => e.exercise === l.exercise)?.pctOf1rm
    if (!pct) continue
    const key = `${l.athleteId}|${l.exercise}`
    liftSeries.set(key, [
      ...(liftSeries.get(key) ?? []),
      { date: session.date, implied: l.topWorkingLoadLb / pct },
    ])
  }
  for (const [key, series] of liftSeries) {
    series.sort((a, b) => a.date.localeCompare(b.date))
    const first = series[0]!.implied
    for (let i = 1; i < series.length; i += 1) {
      const jump = series[i]!.implied / series[i - 1]!.implied
      if (jump > 1.09) liftProblems.push(`${key} +${((jump - 1) * 100).toFixed(1)}%`)
      const total = series[i]!.implied / first
      if (total < 0.8 || total > 1.15)
        liftProblems.push(`${key} drift ${(total * 100).toFixed(0)}%`)
    }
  }
  hard(
    'strength progresses gradually — no unexplained jumps',
    liftProblems.length === 0,
    liftProblems.slice(0, 5).join(' | ') || 'clean',
  )

  // 10 — Perch power tracks power traits with noise (§8.9/§8.12)
  const perchByAthlete = new Map<string, number[]>()
  for (const p of ds.perch) {
    if (p.exercise === 'Trap Bar Deadlift' || p.exercise === 'Power Clean') {
      perchByAthlete.set(p.athleteId, [...(perchByAthlete.get(p.athleteId) ?? []), p.powerW])
    }
  }
  const perchAthletes = [...perchByAthlete.entries()]
  const rPerch = pearson(
    perchAthletes.map(([, v]) => mean(v)),
    perchAthletes.map(([id]) => athleteById.get(id)!.traits.lowerBodyPower),
  )
  hard(
    `Perch power correlates with power trait (r=${rPerch.toFixed(3)})`,
    rPerch > 0.3,
    'threshold 0.3',
  )

  // 11 — missingness rates within §8.11 bands
  const expectedGps = fieldParts.filter((p) => p.exposureMin > 0).length
  const gpsMissRate = 1 - ds.gps.length / expectedGps
  hard(
    `GPS device-missing rate in band (${(gpsMissRate * 100).toFixed(1)}%)`,
    gpsMissRate >= 0.015 && gpsMissRate <= 0.055,
    'band 1.5–5.5%',
  )
  const eligibleLifts = ds.participation.filter((p) => {
    const s = sessionById.get(p.sessionId)!
    return s.kind === 'lift' && p.level !== 'absent'
  })
  const eligibleExerciseCount = eligibleLifts.reduce(
    (acc, p) => acc + (sessionById.get(p.sessionId)!.exercises?.length ?? 0),
    0,
  )
  const perchMissRate = 1 - ds.perch.length / eligibleExerciseCount
  hard(
    `Perch missing rate in band (${(perchMissRate * 100).toFixed(1)}%)`,
    perchMissRate >= 0.07 && perchMissRate <= 0.17,
    'band 7–17% (§8.9 8–15% + modified-skip effects)',
  )

  // 12 — ACWR behavior via the production calculation layer (§8.10)
  const seasonDates: string[] = []
  for (let d = 0; ; d += 1) {
    const date = addDays(ds.seasonStart, d)
    seasonDates.push(date)
    if (date === ds.seasonEnd) break
  }
  const fieldSessionDates = new Set(
    ds.sessions.filter((s) => s.kind === 'field').map((s) => s.date),
  )
  const gpsBySessionAthlete = new Map<string, number>()
  for (const g of ds.gps) {
    gpsBySessionAthlete.set(`${g.athleteId}|${g.sessionId}`, g.playerLoadAu)
  }

  let matureValues: number[] = []
  const athletesWithIncomplete = new Set<string>()
  for (const athlete of ds.athletes) {
    const byDate = new Map<string, DayLoad>()
    for (const date of seasonDates) {
      if (!fieldSessionDates.has(date)) {
        byDate.set(date, { kind: 'rest' })
        continue
      }
      const todaysSessions = ds.sessions.filter((s) => s.kind === 'field' && s.date === date)
      let total = 0
      let missing = false
      let participatedAny = false
      for (const s of todaysSessions) {
        const part = partByKey.get(`${athlete.id}|${s.id}`)
        if (!part || part.exposureMin <= 0) continue
        participatedAny = true
        const load = gpsBySessionAthlete.get(`${athlete.id}|${s.id}`)
        if (load === undefined)
          missing = true // participated but device failed
        else total += load
      }
      if (!participatedAny) byDate.set(date, { kind: 'rest' })
      else if (missing) byDate.set(date, { kind: 'missing' })
      else byDate.set(date, { kind: 'observed', load: total })
    }

    for (let d = 28; d < seasonDates.length; d += 7) {
      const result = acwr(windowEndingAt(byDate, seasonDates[d] as string, 28))
      if (result.computable) matureValues.push(result.value)
      else if (result.reason === 'incomplete_window') athletesWithIncomplete.add(athlete.id)
    }
  }
  const inBand =
    matureValues.filter((v) => v >= 0.8 && v <= 1.3).length / (matureValues.length || 1)
  const spikes = matureValues.filter((v) => v > 1.31).length
  const low = matureValues.filter((v) => v < 0.8).length
  const extreme = matureValues.filter((v) => v > 1.55).length / (matureValues.length || 1)
  hard(
    `mature ACWR mostly 0.80–1.30 (${(inBand * 100).toFixed(0)}% in band, n=${matureValues.length})`,
    inBand >= 0.5,
    'threshold ≥50% (§8.10 "most")',
  )
  soft(`occasional legitimate ACWR spikes exist (${spikes})`, spikes > 0, '>1.31 present')
  soft(`some low-load periods fall below 0.80 (${low})`, low > 0, '<0.80 present')
  hard(
    `very few ACWR observations exceed 1.55 (${(extreme * 100).toFixed(1)}%)`,
    extreme <= 0.04,
    'threshold ≤4%',
  )
  hard(
    `≥3 athletes show an incomplete rolling window (${athletesWithIncomplete.size})`,
    athletesWithIncomplete.size >= 3,
    '§8.11 missing-data rolling windows',
  )

  // 13 — nothing NaN/Infinity/negative anywhere (§8.12)
  let invalidNumbers = 0
  const scan = (rows: object[]) => {
    for (const row of rows) {
      for (const v of Object.values(row)) {
        if (typeof v === 'number' && (!Number.isFinite(v) || v < 0)) invalidNumbers += 1
      }
    }
  }
  scan(ds.gps)
  scan(ds.lifts)
  scan(ds.perch)
  hard('no negative/NaN/Infinity numeric fields', invalidNumbers === 0, `${invalidNumbers} invalid`)

  // summary distributions (§8.12)
  const summary = {
    athletes: ds.athletes.length,
    sessions: ds.sessions.length,
    fieldSessions: ds.sessions.filter((s) => s.kind === 'field').length,
    liftSessions: ds.sessions.filter((s) => s.kind === 'lift').length,
    gpsRows: ds.gps.length,
    liftRows: ds.lifts.length,
    perchRows: ds.perch.length,
    availabilityDays: ds.availability.length,
    meanDistanceByPosition: {
      Midfielder: Math.round(distByPos.Midfielder),
      Forward: Math.round(distByPos.Forward),
      Defender: Math.round(distByPos.Defender),
      Goalkeeper: Math.round(gkMeanDist),
    },
    acwr: {
      n: matureValues.length,
      inBandPct: Math.round(inBand * 100),
      spikesOver131: spikes,
      below080: low,
      athletesWithIncompleteWindows: athletesWithIncomplete.size,
    },
    missingness: {
      gpsPct: Math.round(gpsMissRate * 1000) / 10,
      perchPct: Math.round(perchMissRate * 1000) / 10,
    },
  }

  return {
    checks,
    hardFailures: checks.filter((c) => c.level === 'hard' && !c.pass).map((c) => c.name),
    summary,
  }
}

export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = ['Synthetic data quality report', '='.repeat(60)]
  for (const c of report.checks) {
    lines.push(
      `${c.pass ? 'PASS' : 'FAIL'} [${c.level}] ${c.name}${c.pass ? '' : ` — ${c.detail}`}`,
    )
  }
  lines.push('', 'Summary: ' + JSON.stringify(report.summary, null, 2))
  return lines.join('\n')
}
