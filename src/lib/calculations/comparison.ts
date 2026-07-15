/**
 * Non-windowed comparisons (spec §3.1, ADR-005): speed-percent-of-best and
 * percent-change. Unit compatibility is the caller's contract — both inputs
 * must already be in the same canonical unit (ADR-006).
 */
import type { ComparisonResult } from './types.ts'

/** Minimum prior valid top-speed observations before a baseline exists (§3.1). */
export const SPEED_BASELINE_MIN_OBSERVATIONS = 3

function isValidSpeed(v: number): boolean {
  return Number.isFinite(v) && v > 0
}

/**
 * Selected-session top speed as a percentage of the athlete's best valid top
 * speed in the comparison window. With fewer than three prior valid
 * observations the result is "insufficient baseline" — never a flag (§3.1).
 */
export function speedPercentOfBest(
  currentTopSpeed: number,
  priorValidTopSpeeds: readonly number[],
): ComparisonResult {
  if (!isValidSpeed(currentTopSpeed) || priorValidTopSpeeds.some((v) => !isValidSpeed(v))) {
    return { computable: false, reason: 'invalid_input' }
  }
  if (priorValidTopSpeeds.length < SPEED_BASELINE_MIN_OBSERVATIONS) {
    return { computable: false, reason: 'insufficient_baseline' }
  }
  const best = Math.max(...priorValidTopSpeeds)
  const value = (currentTopSpeed / best) * 100
  if (!Number.isFinite(value)) return { computable: false, reason: 'invalid_input' }
  return { computable: true, value }
}

/**
 * percent_change = (current − baseline) / |baseline| × 100, only when the
 * baseline is non-zero (§3.1).
 */
export function percentChange(current: number, baseline: number): ComparisonResult {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return { computable: false, reason: 'invalid_input' }
  }
  if (baseline === 0) {
    return { computable: false, reason: 'zero_baseline' }
  }
  const value = ((current - baseline) / Math.abs(baseline)) * 100
  if (!Number.isFinite(value)) return { computable: false, reason: 'invalid_input' }
  return { computable: true, value }
}
