import { describe, expect, it } from 'vitest'
import { canConvert, convert } from './index.ts'

describe('unit conversion (ADR-006, §9.1)', () => {
  it('converts meters to yards on the exact definition', () => {
    expect(convert(100, 'm', 'yd')).toBeCloseTo(109.36133, 5)
    expect(convert(0.9144, 'm', 'yd')).toBeCloseTo(1, 12)
  })

  it('converts kg to lb and km/h to mph', () => {
    expect(convert(100, 'kg', 'lb')).toBeCloseTo(220.46226, 5)
    expect(convert(25, 'km_h', 'mph')).toBeCloseTo(15.534, 3)
  })

  it('round-trips without material precision loss (§9.1)', () => {
    for (const v of [0, 0.1, 653, 5907.25, 19.9]) {
      expect(convert(convert(v, 'yd', 'm'), 'm', 'yd')).toBeCloseTo(v, 9)
      expect(convert(convert(v, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(v, 9)
      expect(convert(convert(v, 'mph', 'km_h'), 'km_h', 'mph')).toBeCloseTo(v, 9)
    }
  })

  it('identity conversion is exact', () => {
    expect(convert(4.9, 'scale_1_10', 'scale_1_10')).toBe(4.9)
  })

  it('refuses unknown conversions instead of passing values through', () => {
    expect(() => convert(1, 'AU', 'W')).toThrow(/No conversion/)
    expect(canConvert('AU', 'W')).toBe(false)
    expect(canConvert('m', 'yd')).toBe(true)
  })

  it('refuses non-finite values', () => {
    expect(() => convert(Number.NaN, 'm', 'yd')).toThrow(/non-finite/)
  })
})
