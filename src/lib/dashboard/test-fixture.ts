/**
 * Shared hand-built dashboard fixture for selector and page tests: 3 athletes,
 * one week, same-date sessions, a device-missing case, a zero baseline, a
 * speed-flag dip, and an insufficient-baseline athlete.
 */
import { buildDataset } from './dataset.ts'
import type { DashKpi, DashboardDataset } from './types.ts'

const KPI = (
  key: string,
  unit: string,
  decimals: number,
  interp: DashKpi['interpretation'],
  category: DashKpi['category'],
): DashKpi => ({
  key,
  displayName: key,
  category,
  unit,
  decimalPlaces: decimals,
  interpretation: interp,
  inLeaderboards: true,
  inMonitoring: true,
  inProfile: true,
})

export function dashboardFixture(): DashboardDataset {
  const sessions = [
    {
      id: 'S1',
      date: '2026-09-01',
      startTime: '15:30',
      label: 'Practice',
      type: 'practice' as const,
      kind: 'field' as const,
    },
    {
      id: 'S2',
      date: '2026-09-02',
      startTime: '18:00',
      label: 'Game W1',
      type: 'game' as const,
      kind: 'field' as const,
    },
    {
      id: 'S3',
      date: '2026-09-03',
      startTime: '10:00',
      label: 'Recovery',
      type: 'recovery' as const,
      kind: 'field' as const,
    },
    {
      id: 'S4',
      date: '2026-09-04',
      startTime: '07:30',
      label: 'AM Practice',
      type: 'practice' as const,
      kind: 'field' as const,
    },
    {
      id: 'S5',
      date: '2026-09-04',
      startTime: '15:30',
      label: 'PM Practice',
      type: 'practice' as const,
      kind: 'field' as const,
    },
    {
      id: 'L3',
      date: '2026-09-04',
      startTime: '16:30',
      label: 'Lift',
      type: 'lift' as const,
      kind: 'lift' as const,
    },
    {
      id: 'S7',
      date: '2026-09-05',
      startTime: '18:00',
      label: 'Game W2',
      type: 'game' as const,
      kind: 'field' as const,
    },
    {
      id: 'L1',
      date: '2026-08-20',
      startTime: '16:00',
      label: 'Lift',
      type: 'lift' as const,
      kind: 'lift' as const,
    },
    {
      id: 'L2',
      date: '2026-08-27',
      startTime: '16:00',
      label: 'Lift',
      type: 'lift' as const,
      kind: 'lift' as const,
    },
  ]
  const full = (athleteId: string, sessionId: string, min = 60) => ({
    athleteId,
    sessionId,
    level: 'full' as const,
    exposureMin: min,
  })
  const obs = (athleteId: string, sessionId: string, kpiKey: string, value: number) => ({
    athleteId,
    sessionId,
    kpiKey,
    value,
  })
  return buildDataset({
    seasonLabel: 'Test Season',
    seasonStart: '2026-08-18',
    seasonEnd: '2026-09-06',
    athletes: [
      {
        id: 'A1',
        firstName: 'Ada',
        lastName: 'Fast',
        fullName: 'Ada Fast',
        position: 'Forward',
        jerseyNumber: 9,
        yearsOnTeam: 2,
      },
      {
        id: 'A2',
        firstName: 'Bea',
        lastName: 'Steady',
        fullName: 'Bea Steady',
        position: 'Midfielder',
        jerseyNumber: 4,
        yearsOnTeam: 3,
      },
      {
        id: 'A3',
        firstName: 'Gia',
        lastName: 'Keeper',
        fullName: 'Gia Keeper',
        position: 'Goalkeeper',
        jerseyNumber: 1,
        yearsOnTeam: 1,
      },
    ],
    sessions,
    availability: [
      { athleteId: 'A1', date: '2026-09-05', status: 'full_go' },
      { athleteId: 'A2', date: '2026-09-05', status: 'limited', note: 'Lift only' },
      { athleteId: 'A3', date: '2026-09-05', status: 'out', note: 'Unavailable today' },
    ],
    participation: [
      full('A1', 'S1', 80),
      full('A2', 'S1', 80),
      full('A1', 'S2', 55),
      full('A2', 'S2', 50),
      full('A1', 'S3', 40),
      full('A2', 'S3', 40),
      full('A3', 'S3', 40),
      full('A1', 'S4', 70),
      full('A2', 'S4', 70),
      full('A1', 'S5', 45),
      full('A1', 'S7', 58),
      full('A2', 'S7', 52),
      full('A1', 'L1'),
      full('A1', 'L2'),
      full('A1', 'L3'),
      full('A2', 'L3'),
      full('A3', 'L2'),
      full('A3', 'L3'),
    ],
    observations: [
      obs('A1', 'S1', 'top_speed', 17.0),
      obs('A1', 'S2', 'top_speed', 18.0),
      obs('A1', 'S4', 'top_speed', 17.5),
      obs('A1', 'S7', 'top_speed', 15.5), // 86.1% of 18.0 → flag
      obs('A2', 'S1', 'top_speed', 16.0),
      obs('A2', 'S7', 'top_speed', 15.8), // 1 prior → insufficient baseline
      obs('A1', 'S1', 'player_load', 420),
      obs('A1', 'S1', 'total_distance', 4400),
      obs('A2', 'S1', 'player_load', 380),
      obs('A2', 'S1', 'total_distance', 4100),
      obs('A1', 'S2', 'player_load', 500),
      obs('A1', 'S2', 'total_distance', 3600),
      // A2 participated in S2 but produced NO observations → device missing
      obs('A1', 'S3', 'player_load', 120),
      obs('A2', 'S3', 'player_load', 110),
      obs('A3', 'S3', 'player_load', 90),
      obs('A1', 'S4', 'player_load', 400),
      obs('A2', 'S4', 'player_load', 390),
      obs('A1', 'S5', 'player_load', 210),
      obs('A1', 'S7', 'player_load', 480),
      obs('A1', 'S7', 'total_distance', 3500),
      obs('A2', 'S7', 'player_load', 450),
      obs('A2', 'S7', 'total_distance', 3300),
      obs('A1', 'L1', 'back_squat_top_load', 180),
      obs('A1', 'L2', 'back_squat_top_load', 185),
      obs('A1', 'L3', 'back_squat_top_load', 190),
      obs('A2', 'L3', 'back_squat_top_load', 165),
      obs('A3', 'L2', 'power_clean_top_load', 0), // zero-baseline case
      obs('A3', 'L3', 'power_clean_top_load', 80),
    ],
    kpis: [
      KPI('total_distance', 'yd', 0, 'neutral', 'GPS'),
      KPI('player_load', 'AU', 0, 'neutral', 'Load'),
      KPI('top_speed', 'mph', 1, 'higher_is_better', 'GPS'),
      KPI('back_squat_top_load', 'lb', 0, 'higher_is_better', 'Strength'),
      KPI('power_clean_top_load', 'lb', 0, 'higher_is_better', 'Strength'),
      KPI('workload', 'scale_1_10', 1, 'neutral', 'Load'),
    ],
  })
}
