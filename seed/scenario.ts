/**
 * §8.13 scenario assignment: named simulation events bound to deterministic
 * athlete selections. Downstream generators consult these assignments —
 * scenarios emerge from simulation behavior, not from editing final rows.
 */
import { SCENARIO_RULES } from './config.v1.ts'
import type { SimAthlete } from './types.ts'

function bySelector(athletes: SimAthlete[], selector: string): SimAthlete {
  const of = (position: SimAthlete['position'], role?: SimAthlete['role']) =>
    athletes.filter((a) => a.position === position && (role === undefined || a.role === role))

  switch (selector) {
    case 'forward_starter_0':
      return of('Forward', 'starter')[0]!
    case 'forward_rotation_0':
      return of('Forward', 'rotation')[0]!
    case 'midfielder_rotation_0':
      return of('Midfielder', 'rotation')[0]!
    case 'midfielder_starter_1':
      return of('Midfielder', 'starter')[1]!
    case 'defender_youngest':
      return [...of('Defender')].sort((a, b) => a.traits.trainingAgeYr - b.traits.trainingAgeYr)[0]!
    case 'defender_oldest':
      return [...of('Defender')].sort((a, b) => b.traits.trainingAgeYr - a.traits.trainingAgeYr)[0]!
    case 'developmental_lowest_minutes':
      // resolved before participation exists: the developmental GK is the
      // structurally lowest-exposure athlete (§8.5 third GK rarely plays)
      return athletes.find((a) => a.position === 'Goalkeeper' && a.role === 'developmental')!
    default:
      throw new Error(`Unknown scenario selector: ${selector}`)
  }
}

export function assignScenarios(athletes: SimAthlete[]): Record<string, string[]> {
  const assignments: Record<string, string[]> = {}
  for (const rule of SCENARIO_RULES) {
    const athlete = bySelector(athletes, rule.selector)
    assignments[athlete.id] = [...(assignments[athlete.id] ?? []), rule.scenario]
  }
  return assignments
}

export function hasScenario(
  assignments: Record<string, string[]>,
  athleteId: string,
  scenario: string,
): boolean {
  return (assignments[athleteId] ?? []).includes(scenario)
}
