/**
 * Deterministic seeded PRNG (spec §8.2): same seed + config ⇒ identical
 * datasets on every machine. mulberry32 — small, fast, well-distributed,
 * and dependency-free. All stochastic generator code draws through this;
 * Math.random is banned in seed/.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
  /** Normal via Box–Muller. */
  normal(mean: number, sd: number): number
  /** Normal, resampled (then clamped) into [min, max]. */
  truncNormal(mean: number, sd: number, min: number, max: number): number
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T
  /** Deterministic Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(items: readonly T[]): T[]
  /** Independent child stream — isolates subsystems so adding draws in one
   *  doesn't reshuffle every downstream value. */
  fork(label: string): Rng
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash so fork labels map to stable child seeds. */
function hashLabel(label: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < label.length; i += 1) {
    h ^= label.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRng(seed: number): Rng {
  const nextRaw = mulberry32(seed)

  const rng: Rng = {
    next: () => nextRaw(),
    int: (min, max) => {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Bad int range [${min}, ${max}]`)
      }
      return min + Math.floor(nextRaw() * (max - min + 1))
    },
    chance: (p) => nextRaw() < p,
    normal: (mean, sd) => {
      const u1 = 1 - nextRaw() // avoid log(0)
      const u2 = nextRaw()
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },
    truncNormal: (mean, sd, min, max) => {
      if (max < min) throw new RangeError(`Bad truncNormal range [${min}, ${max}]`)
      for (let i = 0; i < 20; i += 1) {
        const v = rng.normal(mean, sd)
        if (v >= min && v <= max) return v
      }
      return Math.min(max, Math.max(min, mean))
    },
    pick: (items) => {
      if (items.length === 0) throw new RangeError('pick() from empty array')
      return items[rng.int(0, items.length - 1)] as (typeof items)[number]
    },
    shuffle: (items) => {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = rng.int(0, i)
        const tmp = copy[i] as (typeof copy)[number]
        copy[i] = copy[j] as (typeof copy)[number]
        copy[j] = tmp
      }
      return copy
    },
    fork: (label) => createRng((seed ^ hashLabel(label)) >>> 0),
  }
  return rng
}
