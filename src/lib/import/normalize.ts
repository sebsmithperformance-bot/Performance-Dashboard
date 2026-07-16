/**
 * Normalization helpers shared across adapters and resolution. The name
 * normalization MUST match the SQL generated column on
 * athlete_source_identity/kpi_source_mapping (lower + trim + collapse spaces)
 * so client-side matching and database uniqueness agree.
 */
import type { SessionType } from './types.ts'

export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const pad = (n: number): string => String(n).padStart(2, '0')

function isRealDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * Accepts ISO (2026-08-14), US (8/14/2026), and PlayerData filename style
 * (14 Aug 26). Returns ISO or null — never a guessed date.
 */
export function parseDateFlexible(input: string): string | null {
  const s = input.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    const [, y, m, d] = iso
    return isRealDate(Number(y), Number(m), Number(d)) ? `${y}-${m}-${d}` : null
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (us) {
    const [, m, d, y] = us
    return isRealDate(Number(y), Number(m), Number(d))
      ? `${y}-${pad(Number(m))}-${pad(Number(d))}`
      : null
  }

  const dmy = /^(\d{1,2}) ([A-Za-z]{3}) (\d{2}|\d{4})$/.exec(s)
  if (dmy) {
    const [, d, mon, y] = dmy
    const m = MONTHS[mon!.toLowerCase()]
    if (!m) return null
    const year = y!.length === 2 ? 2000 + Number(y) : Number(y)
    return isRealDate(year, m, Number(d)) ? `${year}-${pad(m)}-${pad(Number(d))}` : null
  }

  return null
}

/** Session type inferred from a label; explicit source types would win if present. */
export function inferSessionType(label: string): SessionType {
  const l = label.toLowerCase()
  if (l.includes('game') || l.includes('match')) return 'game'
  if (l.includes('recovery')) return 'recovery'
  if (l.includes('lift') || l.includes('weight')) return 'lift'
  if (l.includes('test')) return 'testing'
  return 'practice'
}

/** Parses a decimal cell strictly: '' and non-numeric are null, never 0 (§4.3). */
export function parseNumericCell(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const value = Number(s)
  return Number.isFinite(value) ? value : null
}
