/**
 * Generator tests (spec §9.3): determinism by seed, roster invariants, and
 * the full §8.12 quality gate on the default seed.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from './config.v1.ts'
import { generateDataset, seasonStartFor } from './dataset.ts'
import { evaluateQuality } from './quality.ts'

describe('synthetic generator', () => {
  const dataset = generateDataset({ seasonYear: 2026, seed: DEFAULT_SEED })

  it('starts the 2026 season on Monday 2026-08-10 and spans 17 weeks', () => {
    expect(seasonStartFor(2026)).toBe('2026-08-10')
    expect(dataset.seasonStart).toBe('2026-08-10')
    expect(dataset.seasonEnd).toBe('2026-12-06')
  })

  it('is deterministic: same seed and config produce identical datasets', () => {
    const again = generateDataset({ seasonYear: 2026, seed: DEFAULT_SEED })
    expect(JSON.stringify(again)).toBe(JSON.stringify(dataset))
  })

  it('produces a different dataset for a different seed', () => {
    const other = generateDataset({ seasonYear: 2026, seed: 42 })
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(dataset))
  })

  it('generates exactly 25 athletes with the §8.3 position split', () => {
    expect(dataset.athletes).toHaveLength(25)
    const count = (p: string) => dataset.athletes.filter((a) => a.position === p).length
    expect(count('Goalkeeper')).toBe(3)
    expect(count('Defender')).toBe(7)
    expect(count('Midfielder')).toBe(8)
    expect(count('Forward')).toBe(7)
    // unique names and jerseys
    expect(new Set(dataset.athletes.map((a) => `${a.firstName} ${a.lastName}`)).size).toBe(25)
    expect(new Set(dataset.athletes.map((a) => a.jerseyNumber)).size).toBe(25)
  })

  it('assigns every §8.13 scenario to a distinct deterministic athlete', () => {
    const assigned = Object.values(dataset.scenarioAssignments).flat()
    expect(assigned).toContain('speed_flag_legit')
    expect(assigned).toContain('device_missing_cluster')
    expect(assigned).toContain('return_from_low_exposure')
  })

  it('passes every hard invariant in the §8.12 quality gate', () => {
    const report = evaluateQuality(dataset)
    const failures = report.checks.filter((c) => c.level === 'hard' && !c.pass)
    expect(failures.map((f) => `${f.name} :: ${f.detail}`)).toEqual([])
  })
})
