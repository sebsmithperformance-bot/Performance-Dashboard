/**
 * Local reference/master data bootstrap: positions, active season, roster,
 * KPI registry, and source→KPI mappings. Observations are deliberately NOT
 * seeded — the demo season enters through the real import pipeline (§8, §13).
 * In dev/production AWS environments this data is managed through admin
 * surfaces; this module exists so the local database has a coherent registry.
 */
import type { SqlExecutor } from '../../../../db/migration-core.ts'

interface KpiSeed {
  key: string
  name: string
  source: 'TeamBuildr' | 'PlayerData' | 'Perch'
  category: 'Strength' | 'Power' | 'GPS' | 'Load'
  unit: string
  interpretation: 'higher_is_better' | 'lower_is_better' | 'target_range' | 'neutral'
  aggregation: 'max' | 'mean' | 'sum' | 'last' | 'best_set' | 'source_value'
  min: number
  max: number
  decimals: number
  /** raw headers / exercise names mapped to this KPI, per source */
  mapped: string[]
}

/** Valid ranges are supersets of the §8.7–8.9 hard bounds. */
const KPIS: KpiSeed[] = [
  // PlayerData — headers per docs/import-sources/playerdata.md (real export)
  {
    key: 'total_distance',
    name: 'Total Distance',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'yd',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 12000,
    decimals: 0,
    mapped: ['Distance'],
  },
  {
    key: 'player_load',
    name: 'Player Load',
    source: 'PlayerData',
    category: 'Load',
    unit: 'AU',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 1000,
    decimals: 0,
    mapped: ['Session Load'],
  },
  {
    key: 'workload',
    name: 'Workload (1–10)',
    source: 'PlayerData',
    category: 'Load',
    unit: 'scale_1_10',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 1,
    max: 10,
    decimals: 1,
    mapped: ['Workload'],
  },
  {
    key: 'sprint_distance',
    name: 'Sprint Distance',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'yd',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 2000,
    decimals: 0,
    mapped: ['Sprint Distance'],
  },
  {
    key: 'high_speed_distance',
    name: 'High Intensity Running',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'yd',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 1600,
    decimals: 0,
    mapped: ['High Intensity Running'],
  },
  {
    key: 'high_intensity_events',
    name: 'High Intensity Events',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'count',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 100,
    decimals: 0,
    mapped: ['No. of High Intensity Events'],
  },
  {
    key: 'yards_per_minute',
    name: 'Yards per Minute',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'yd_per_min',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 120,
    decimals: 0,
    mapped: ['Yards per Minute'],
  },
  {
    key: 'sprints',
    name: 'Sprints',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'count',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 50,
    decimals: 0,
    mapped: ['No. of Sprints'],
  },
  {
    key: 'top_speed',
    name: 'Top Speed',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'mph',
    interpretation: 'higher_is_better',
    aggregation: 'source_value',
    min: 0,
    max: 25,
    decimals: 1,
    mapped: ['Top Speed'],
  },
  {
    key: 'accelerations',
    name: 'Accelerations',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'count',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 120,
    decimals: 0,
    mapped: ['Accelerations'],
  },
  {
    key: 'decelerations',
    name: 'Decelerations',
    source: 'PlayerData',
    category: 'GPS',
    unit: 'count',
    interpretation: 'neutral',
    aggregation: 'source_value',
    min: 0,
    max: 120,
    decimals: 0,
    mapped: ['Decelerations'],
  },
  // TeamBuildr — exercise names act as raw headers (provisional format)
  {
    key: 'back_squat_top_load',
    name: 'Back Squat — Top Load',
    source: 'TeamBuildr',
    category: 'Strength',
    unit: 'lb',
    interpretation: 'higher_is_better',
    aggregation: 'max',
    min: 45,
    max: 400,
    decimals: 0,
    mapped: ['Back Squat'],
  },
  {
    key: 'bench_press_top_load',
    name: 'Bench Press — Top Load',
    source: 'TeamBuildr',
    category: 'Strength',
    unit: 'lb',
    interpretation: 'higher_is_better',
    aggregation: 'max',
    min: 45,
    max: 250,
    decimals: 0,
    mapped: ['Bench Press'],
  },
  {
    key: 'trap_bar_deadlift_top_load',
    name: 'Trap Bar Deadlift — Top Load',
    source: 'TeamBuildr',
    category: 'Strength',
    unit: 'lb',
    interpretation: 'higher_is_better',
    aggregation: 'max',
    min: 45,
    max: 500,
    decimals: 0,
    mapped: ['Trap Bar Deadlift'],
  },
  {
    key: 'power_clean_top_load',
    name: 'Power Clean — Top Load',
    source: 'TeamBuildr',
    category: 'Strength',
    unit: 'lb',
    interpretation: 'higher_is_better',
    aggregation: 'max',
    min: 45,
    max: 250,
    decimals: 0,
    mapped: ['Power Clean'],
  },
  // Perch — exercise names act as raw headers (provisional format)
  {
    key: 'back_squat_mean_power',
    name: 'Back Squat — Mean Power',
    source: 'Perch',
    category: 'Power',
    unit: 'W',
    interpretation: 'higher_is_better',
    aggregation: 'mean',
    min: 100,
    max: 1300,
    decimals: 0,
    mapped: ['Back Squat'],
  },
  {
    key: 'bench_press_mean_power',
    name: 'Bench Press — Mean Power',
    source: 'Perch',
    category: 'Power',
    unit: 'W',
    interpretation: 'higher_is_better',
    aggregation: 'mean',
    min: 50,
    max: 700,
    decimals: 0,
    mapped: ['Bench Press'],
  },
  {
    key: 'trap_bar_deadlift_mean_power',
    name: 'Trap Bar Deadlift — Mean Power',
    source: 'Perch',
    category: 'Power',
    unit: 'W',
    interpretation: 'higher_is_better',
    aggregation: 'mean',
    min: 150,
    max: 1800,
    decimals: 0,
    mapped: ['Trap Bar Deadlift'],
  },
  {
    key: 'power_clean_peak_power',
    name: 'Power Clean — Peak Power',
    source: 'Perch',
    category: 'Power',
    unit: 'W',
    interpretation: 'higher_is_better',
    aggregation: 'mean',
    min: 250,
    max: 2300,
    decimals: 0,
    mapped: ['Power Clean'],
  },
]

/** In-memory KpiConfig map (same shape context.ts loads from SQL) — for stub contexts in tests. */
export function referenceKpiConfigs(): Map<string, import('../types.ts').KpiConfig> {
  return new Map(
    KPIS.map((k) => [
      k.key,
      {
        key: k.key,
        displayName: k.name,
        canonicalUnit: k.unit as import('../../units/index.ts').Unit,
        validMin: k.min,
        validMax: k.max,
        aggregationMethod: k.aggregation,
        primarySource: k.source,
        category: k.category,
        decimalPlaces: k.decimals,
      },
    ]),
  )
}

/** normalized raw header → kpi_key for one source — for stub contexts in tests. */
export function referenceMappings(source: KpiSeed['source']): Map<string, string> {
  const map = new Map<string, string>()
  for (const kpi of KPIS.filter((k) => k.source === source)) {
    for (const header of kpi.mapped) {
      map.set(header.trim().replace(/\s+/g, ' ').toLowerCase(), kpi.key)
    }
  }
  return map
}

export interface RosterSeedAthlete {
  firstName: string
  lastName: string
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'
  jerseyNumber?: number
}

export interface ReferenceSeed {
  season: { name: string; startDate: string; endDate: string }
  athletes: RosterSeedAthlete[]
}

/** True when the registry already exists (bootstrap is one-shot). */
export async function isReferenceSeeded(db: SqlExecutor): Promise<boolean> {
  const [row] = await db.query<{ n: number }>('select count(*)::int as n from kpi_registry')
  return (row?.n ?? 0) > 0
}

export async function seedReferenceData(db: SqlExecutor, seed: ReferenceSeed): Promise<void> {
  if (await isReferenceSeeded(db)) return

  await db.exec('begin')
  try {
    await db.query(
      `insert into seasons (name, start_date, end_date, status) values ($1, $2, $3, 'active')`,
      [seed.season.name, seed.season.startDate, seed.season.endDate],
    )

    const positionIds = new Map<string, string>()
    for (const [i, name] of ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].entries()) {
      const [row] = await db.query<{ id: string }>(
        `insert into positions (name, sort_order) values ($1, $2) returning id`,
        [name, i],
      )
      positionIds.set(name, row!.id)
    }

    for (const athlete of seed.athletes) {
      await db.query(
        `insert into athletes (first_name, last_name, current_position_id, jersey_number)
         values ($1, $2, $3, $4)`,
        [
          athlete.firstName,
          athlete.lastName,
          positionIds.get(athlete.position) ?? null,
          athlete.jerseyNumber ?? null,
        ],
      )
    }

    for (const kpi of KPIS) {
      await db.query(
        `insert into kpi_registry
           (key, display_name, primary_source, category, canonical_unit, display_unit,
            interpretation, aggregation_method, valid_min, valid_max, decimal_places,
            in_leaderboards, in_monitoring, in_profile)
         values ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          kpi.key,
          kpi.name,
          kpi.source,
          kpi.category,
          kpi.unit,
          kpi.interpretation,
          kpi.aggregation,
          kpi.min,
          kpi.max,
          kpi.decimals,
          kpi.category === 'Strength' || kpi.category === 'Power',
          kpi.category === 'Load' || kpi.category === 'GPS',
          kpi.category !== 'Load',
        ],
      )
      for (const header of kpi.mapped) {
        await db.query(
          `insert into kpi_source_mapping (kpi_key, source, raw_header) values ($1, $2, $3)`,
          [kpi.key, kpi.source, header],
        )
      }
    }
    await db.exec('commit')
  } catch (err) {
    await db.exec('rollback')
    throw err
  }
}
