/**
 * Calculation-layer contracts (ADR-005). Every rolling-window result carries
 * completeness so the UI can show whether underlying dates are complete
 * (spec §6.7); nothing here can emit NaN/Infinity (spec §6.5) — impossible
 * results come back as { computable: false } with a machine-readable reason.
 */

/** One calendar day's load state. Missing is NOT zero — it poisons windows. */
export type DayLoad =
  | { kind: 'observed'; load: number }
  | { kind: 'rest' } // confirmed no-session/rest day → counts as 0 load
  | { kind: 'missing' } // expected data absent → window incomplete

export interface WindowCompleteness {
  expectedDays: number
  observedDays: number
  restDays: number
  missingDays: number
  /** True when every expected day is observed or confirmed rest. */
  complete: boolean
}

export type NotComputableReason =
  | 'incomplete_window' // one or more missing days in the window
  | 'zero_chronic' // ACWR denominator is zero
  | 'zero_variance' // monotony denominator (stdev) is zero
  | 'zero_baseline' // percent-change baseline is zero
  | 'insufficient_baseline' // fewer than the required prior observations
  | 'invalid_input' // non-finite or out-of-domain values reached the calculation

export type CalcResult =
  | { computable: true; value: number; completeness: WindowCompleteness }
  | { computable: false; reason: NotComputableReason; completeness: WindowCompleteness }

/** Result shape for comparisons that have no rolling window. */
export type ComparisonResult =
  { computable: true; value: number } | { computable: false; reason: NotComputableReason }
