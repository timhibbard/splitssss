import type { Athlete } from './types'

/**
 * Reconciles the race's athlete list with an edited roster, mid race.
 *
 * The roster wins, so a girl added at the starting line appears on the grid and
 * a scratch disappears from it. The one exception is an athlete who already
 * holds a crossing: she stays, at the end of the list, because a recorded time
 * must never lose the name attached to it.
 */
export function mergeRoster(
  raceAthletes: Athlete[],
  roster: Athlete[],
  namedIds: Set<string>,
): Athlete[] {
  const inRoster = new Set(roster.map((a) => a.id))
  const kept = raceAthletes.filter((a) => namedIds.has(a.id) && !inRoster.has(a.id))
  return [...roster, ...kept]
}
