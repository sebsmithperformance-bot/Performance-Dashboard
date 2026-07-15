/**
 * Hand-checked fixture tests (spec §9.1). Expected values are computed by hand
 * in the comments — if an implementation change breaks one of these, the
 * formula changed, and that requires ADR-005 review (spec §15).
 */
import { describe, expect, it } from 'vitest'
import {
  acute7d,
  acwr,
  chronic28dWeeklyEquivalent,
  monotony7d,
  strain7d,
  percentChange,
  speedPercentOfBest,
  addDays,
  windowEndingAt,
  type DayLoad,
} from './index.ts'

const obs = (load: number): DayLoad => ({ kind: 'observed', load })
const rest: DayLoad = { kind: 'rest' }
const missing: DayLoad = { kind: 'missing' }

/** 7 varied training days: 400+500+300+600+200+450+350 = 2800 */
const acuteWeek = [obs(400), obs(500), obs(300), obs(600), obs(200), obs(450), obs(350)]
/** 21 steady days at 300 (=6300) followed by the acute week → 28-day total 9100 */
const chronicWindow = [...Array.from({ length: 21 }, () => obs(300)), ...acuteWeek]

describe('acute7d', () => {
  it('sums 7 observed days: 2800', () => {
    const r = acute7d(acuteWeek)
    expect(r).toMatchObject({ computable: true, value: 2800 })
  })

  it('counts confirmed rest days as zero: 100+0+200+0+0+100+0 = 400', () => {
    const r = acute7d([obs(100), rest, obs(200), rest, rest, obs(100), rest])
    expect(r).toMatchObject({
      computable: true,
      value: 400,
      completeness: { observedDays: 3, restDays: 4, missingDays: 0, complete: true },
    })
  })

  it('refuses a window containing a missing day — missing is never zero', () => {
    const r = acute7d([obs(100), missing, obs(200), rest, rest, obs(100), rest])
    expect(r).toMatchObject({ computable: false, reason: 'incomplete_window' })
    expect(r.completeness.missingDays).toBe(1)
  })

  it('throws on a wrong window length (programming error, not a data state)', () => {
    expect(() => acute7d([obs(1), obs(2)])).toThrow(RangeError)
  })

  it('rejects negative loads as invalid input', () => {
    const r = acute7d([obs(-5), obs(0), obs(0), obs(0), obs(0), obs(0), obs(0)])
    expect(r).toMatchObject({ computable: false, reason: 'invalid_input' })
  })
})

describe('chronic28dWeeklyEquivalent', () => {
  it('(6300 + 2800) / 4 = 2275', () => {
    const r = chronic28dWeeklyEquivalent(chronicWindow)
    expect(r).toMatchObject({ computable: true, value: 2275 })
  })
})

describe('acwr', () => {
  it('2800 / 2275 = 1.230769…', () => {
    const r = acwr(chronicWindow)
    expect(r.computable).toBe(true)
    if (r.computable) expect(r.value).toBeCloseTo(1.230769, 5)
  })

  it('is not computable when chronic load is zero (all rest)', () => {
    const r = acwr(Array.from({ length: 28 }, () => rest))
    expect(r).toMatchObject({ computable: false, reason: 'zero_chronic' })
  })

  it('is not computable with any missing day anywhere in the 28-day window', () => {
    const withGap = [missing, ...chronicWindow.slice(1)]
    const r = acwr(withGap)
    expect(r).toMatchObject({ computable: false, reason: 'incomplete_window' })
  })
})

describe('monotony7d', () => {
  it('mean 400 / population stdev √15000 (=122.474487…) = 3.265986…', () => {
    // deviations 0,100,−100,200,−200,50,−50 → squares sum 105000 → var 15000
    const r = monotony7d(acuteWeek)
    expect(r.computable).toBe(true)
    if (r.computable) expect(r.value).toBeCloseTo(3.265986, 5)
  })

  it('is not computable when every day has identical load (stdev 0)', () => {
    const r = monotony7d(Array.from({ length: 7 }, () => obs(300)))
    expect(r).toMatchObject({ computable: false, reason: 'zero_variance' })
  })

  it('an all-rest week has stdev 0, not a divide-by-zero artifact', () => {
    const r = monotony7d(Array.from({ length: 7 }, () => rest))
    expect(r).toMatchObject({ computable: false, reason: 'zero_variance' })
  })
})

describe('strain7d', () => {
  it('2800 × 3.265986… = 9144.7617…', () => {
    const r = strain7d(acuteWeek)
    expect(r.computable).toBe(true)
    if (r.computable) expect(r.value).toBeCloseTo(9144.7617, 3)
  })

  it('propagates monotony non-computability', () => {
    const r = strain7d(Array.from({ length: 7 }, () => obs(300)))
    expect(r).toMatchObject({ computable: false, reason: 'zero_variance' })
  })
})

describe('speedPercentOfBest', () => {
  it('17.1 mph against best-of [18.0, 17.5, 16.9] = 95%', () => {
    const r = speedPercentOfBest(17.1, [18.0, 17.5, 16.9])
    expect(r.computable).toBe(true)
    if (r.computable) expect(r.value).toBeCloseTo(95, 6)
  })

  it('needs at least 3 prior valid observations — otherwise insufficient baseline, never a flag', () => {
    const r = speedPercentOfBest(17.1, [18.0, 17.5])
    expect(r).toMatchObject({ computable: false, reason: 'insufficient_baseline' })
  })

  it('rejects zero/negative/non-finite speeds as invalid input', () => {
    expect(speedPercentOfBest(0, [18, 17, 16])).toMatchObject({ reason: 'invalid_input' })
    expect(speedPercentOfBest(17, [18, -1, 16])).toMatchObject({ reason: 'invalid_input' })
    expect(speedPercentOfBest(Number.NaN, [18, 17, 16])).toMatchObject({
      reason: 'invalid_input',
    })
  })
})

describe('percentChange', () => {
  it('(105 − 100)/|100| × 100 = 5', () => {
    expect(percentChange(105, 100)).toMatchObject({ computable: true, value: 5 })
  })

  it('(95 − 100)/|100| × 100 = −5', () => {
    expect(percentChange(95, 100)).toMatchObject({ computable: true, value: -5 })
  })

  it('negative baseline uses absolute denominator: (100 − (−50))/50 × 100 = 300', () => {
    expect(percentChange(100, -50)).toMatchObject({ computable: true, value: 300 })
  })

  it('zero baseline is not computable — never Infinity', () => {
    expect(percentChange(42, 0)).toMatchObject({ computable: false, reason: 'zero_baseline' })
  })
})

describe('series helpers', () => {
  it('addDays crosses month boundaries on pure calendar math', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-09-01', -27)).toBe('2026-08-05')
  })

  it('windowEndingAt fills unknown dates as missing, preserving day order', () => {
    const byDate = new Map<string, DayLoad>([
      ['2026-09-01', obs(100)],
      ['2026-08-31', rest],
    ])
    expect(windowEndingAt(byDate, '2026-09-01', 3)).toEqual([
      { kind: 'missing' }, // 2026-08-30
      { kind: 'rest' }, // 2026-08-31
      { kind: 'observed', load: 100 }, // 2026-09-01
    ])
  })

  it('rejects malformed dates and non-positive lengths', () => {
    expect(() => addDays('2026-9-1', 1)).toThrow(RangeError)
    expect(() => windowEndingAt(new Map(), '2026-09-01', 0)).toThrow(RangeError)
  })
})
