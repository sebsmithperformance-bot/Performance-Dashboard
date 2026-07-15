/**
 * Calendar-series helpers: turn sparse per-date load data into the dense,
 * consecutive-day windows the calculations require. Dates are ISO `YYYY-MM-DD`
 * strings treated as calendar days (no timezone math — display-timezone
 * concerns live at the query/UI layer, spec §3.2).
 */
import type { DayLoad } from './types.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function assertIsoDate(date: string): void {
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new RangeError(`Not a valid ISO date: ${date}`)
  }
}

/** date + n days (n may be negative), pure calendar arithmetic in UTC. */
export function addDays(date: string, n: number): string {
  assertIsoDate(date)
  const t = new Date(`${date}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * Builds the dense window of `length` consecutive days ending at `endDate`
 * (inclusive). Dates absent from `byDate` become `{ kind: 'missing' }` —
 * callers that know a date was a confirmed rest day must say so explicitly.
 */
export function windowEndingAt(
  byDate: ReadonlyMap<string, DayLoad>,
  endDate: string,
  length: number,
): DayLoad[] {
  assertIsoDate(endDate)
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`Window length must be a positive integer, got ${length}`)
  }
  const window: DayLoad[] = []
  for (let i = length - 1; i >= 0; i -= 1) {
    const date = addDays(endDate, -i)
    window.push(byDate.get(date) ?? { kind: 'missing' })
  }
  return window
}
