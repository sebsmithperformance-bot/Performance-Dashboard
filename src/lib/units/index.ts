/**
 * Unit registry and conversion (ADR-006). Conversion happens exactly twice in
 * the app: inbound during import normalization (source unit → canonical) and
 * outbound at render (canonical → display). Nothing else does unit math.
 *
 * Canonical units for v1 KPIs: yd, mph, lb, AU, W, count, min, yd_per_min,
 * scale_1_10. Conversions are exact factors; round-trip precision is tested
 * (§9.1). Unknown conversions are an explicit error — never a silent pass-through.
 */

export type Unit =
  | 'yd'
  | 'm'
  | 'mph'
  | 'km_h'
  | 'm_s'
  | 'lb'
  | 'kg'
  | 'AU'
  | 'W'
  | 'count'
  | 'min'
  | 'yd_per_min'
  | 'm_per_min'
  | 'scale_1_10'

/** factor: value_in_canonical = value_in_source × factor */
const CONVERSIONS: Record<string, number> = {
  'm->yd': 1.0936132983377078, // 1 m = 1/0.9144 yd (exact definition)
  'yd->m': 0.9144,
  'km_h->mph': 0.6213711922373339, // 1 km/h = 1/1.609344 mph (exact)
  'mph->km_h': 1.609344,
  'm_s->mph': 2.2369362920544025, // 1 m/s = 3600/1609.344 mph
  'kg->lb': 2.2046226218487757, // 1 kg = 1/0.45359237 lb (exact definition)
  'lb->kg': 0.45359237,
  'm_per_min->yd_per_min': 1.0936132983377078,
  'yd_per_min->m_per_min': 0.9144,
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot convert non-finite value ${value}`)
  }
  if (from === to) return value
  const factor = CONVERSIONS[`${from}->${to}`]
  if (factor === undefined) {
    throw new RangeError(`No conversion defined from ${from} to ${to}`)
  }
  return value * factor
}

export function canConvert(from: Unit, to: Unit): boolean {
  return from === to || CONVERSIONS[`${from}->${to}`] !== undefined
}
