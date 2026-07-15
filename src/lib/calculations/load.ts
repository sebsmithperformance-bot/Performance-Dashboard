/**
 * Rolling-load calculations (spec §3.1, ADR-005). Windows are arrays of
 * consecutive calendar days ending at the evaluation date: index 0 is the
 * oldest day, the last element is "today". Window lengths are structural
 * invariants — a wrong length is a programming error and throws; bad *data*
 * (missing days, zero denominators) returns { computable: false }.
 */
import type { CalcResult, DayLoad, WindowCompleteness } from './types.ts'

export const ACUTE_WINDOW_DAYS = 7
export const CHRONIC_WINDOW_DAYS = 28

export function windowCompleteness(window: readonly DayLoad[]): WindowCompleteness {
  let observedDays = 0
  let restDays = 0
  let missingDays = 0
  for (const day of window) {
    if (day.kind === 'observed') observedDays += 1
    else if (day.kind === 'rest') restDays += 1
    else missingDays += 1
  }
  return {
    expectedDays: window.length,
    observedDays,
    restDays,
    missingDays,
    complete: missingDays === 0,
  }
}

function assertWindowLength(window: readonly DayLoad[], expected: number, name: string): void {
  if (window.length !== expected) {
    throw new RangeError(`${name} requires exactly ${expected} days, got ${window.length}`)
  }
}

function sumLoads(window: readonly DayLoad[]): number {
  let total = 0
  for (const day of window) {
    if (day.kind === 'observed') {
      if (!Number.isFinite(day.load) || day.load < 0) return Number.NaN // caught by caller guard
      total += day.load
    }
    // rest contributes 0; missing must be excluded by completeness checks first
  }
  return total
}

function incomplete(completeness: WindowCompleteness): CalcResult {
  return { computable: false, reason: 'incomplete_window', completeness }
}

function invalid(completeness: WindowCompleteness): CalcResult {
  return { computable: false, reason: 'invalid_input', completeness }
}

/** Sum of the selected load KPI over the current date and previous 6 days. */
export function acute7d(window7: readonly DayLoad[]): CalcResult {
  assertWindowLength(window7, ACUTE_WINDOW_DAYS, 'acute7d')
  const completeness = windowCompleteness(window7)
  if (!completeness.complete) return incomplete(completeness)
  const total = sumLoads(window7)
  if (!Number.isFinite(total)) return invalid(completeness)
  return { computable: true, value: total, completeness }
}

/** Sum over the current date and previous 27 days, divided by 4. */
export function chronic28dWeeklyEquivalent(window28: readonly DayLoad[]): CalcResult {
  assertWindowLength(window28, CHRONIC_WINDOW_DAYS, 'chronic28dWeeklyEquivalent')
  const completeness = windowCompleteness(window28)
  if (!completeness.complete) return incomplete(completeness)
  const total = sumLoads(window28)
  if (!Number.isFinite(total)) return invalid(completeness)
  return { computable: true, value: total / 4, completeness }
}

/**
 * ACWR = acute_7d / chronic_28d_weekly_equivalent, only when the 28-day window
 * is complete and the chronic value is greater than zero (§3.1).
 * The acute window is the trailing 7 days of the same 28-day window.
 */
export function acwr(window28: readonly DayLoad[]): CalcResult {
  assertWindowLength(window28, CHRONIC_WINDOW_DAYS, 'acwr')
  const completeness = windowCompleteness(window28)
  if (!completeness.complete) return incomplete(completeness)

  const chronic = chronic28dWeeklyEquivalent(window28)
  if (!chronic.computable) return { ...chronic, completeness }
  if (chronic.value <= 0) return { computable: false, reason: 'zero_chronic', completeness }

  const acute = acute7d(window28.slice(-ACUTE_WINDOW_DAYS))
  if (!acute.computable) return { ...acute, completeness }

  const value = acute.value / chronic.value
  if (!Number.isFinite(value)) return invalid(completeness)
  return { computable: true, value, completeness }
}

/**
 * Monotony = mean daily load / population stdev of daily load over 7 days,
 * only when the stdev is greater than zero (§3.1). Confirmed rest days count
 * as 0-load days in both mean and stdev (ADR-005).
 */
export function monotony7d(window7: readonly DayLoad[]): CalcResult {
  assertWindowLength(window7, ACUTE_WINDOW_DAYS, 'monotony7d')
  const completeness = windowCompleteness(window7)
  if (!completeness.complete) return incomplete(completeness)

  const loads = window7.map((d) => (d.kind === 'observed' ? d.load : 0))
  if (loads.some((v) => !Number.isFinite(v) || v < 0)) return invalid(completeness)

  const mean = loads.reduce((a, b) => a + b, 0) / loads.length
  const variance = loads.reduce((acc, v) => acc + (v - mean) ** 2, 0) / loads.length
  const stdev = Math.sqrt(variance)

  if (stdev === 0) return { computable: false, reason: 'zero_variance', completeness }

  const value = mean / stdev
  if (!Number.isFinite(value)) return invalid(completeness)
  return { computable: true, value, completeness }
}

/** Strain = 7-day total load × monotony (§3.1); inherits monotony's computability. */
export function strain7d(window7: readonly DayLoad[]): CalcResult {
  assertWindowLength(window7, ACUTE_WINDOW_DAYS, 'strain7d')
  const monotony = monotony7d(window7)
  if (!monotony.computable) return monotony

  const total = sumLoads(window7)
  const value = total * monotony.value
  if (!Number.isFinite(value)) return invalid(monotony.completeness)
  return { computable: true, value, completeness: monotony.completeness }
}
