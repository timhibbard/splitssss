// Explicit extensions: see the note in link.ts.
import { distanceLabel, toMeters, type Unit } from './distance.ts'
import type { Station } from './types.ts'

/**
 * The four points this team actually stands at, ordered by distance. No finish
 * line: the meet's own timing provides that, so putting a volunteer there would
 * duplicate work we already get for free.
 *
 * Miles all the way down, because that is the unit the coach and the athletes
 * say out loud. The metric points these replace were never anybody's marker; they
 * were a picker offering every distance a race could have, and the cost of that
 * was four extra chips between a volunteer and the one they came for.
 *
 * 2.6 is the last one because it is roughly 800 to go, and 800 to go is where the
 * athlete is told to start speeding up. That makes it the split worth reading out
 * on a course rather than after: a projection there is a number a runner can still
 * do something about.
 *
 * Exactly 800 left would be 4200m, sixteen metres further on. The chip says the
 * distance the flag says, and sixteen metres is well inside how accurately a
 * course marker paced off by a volunteer sits anyway. See pacePerMile.
 *
 * A course that marks something else gets the custom entry, which takes
 * meters, kilometers or miles.
 */
export const STATIONS: Station[] = [
  { label: '0.5 mi', meters: 805 },
  { label: 'Mile 1', meters: 1609 },
  { label: 'Mile 2', meters: 3219 },
  { label: '2.6 mi', meters: 4184 },
]

export const UNITS: Unit[] = ['m', 'km', 'mi']

/**
 * What the picker has on it: a preset's label, or 'custom' with whatever has been
 * typed so far. Kept as typed rather than as a Station, so a half typed distance
 * survives a re-render.
 */
export type StationChoice = { pick: string; value: string; unit: Unit }

/** Mile 1, which is where most of the phones handed out at a meet stand. */
export const FIRST_CHOICE: StationChoice = { pick: 'Mile 1', value: '', unit: 'm' }

/** The station picked, or null while a custom distance is not a distance yet. */
export function resolveStation(choice: StationChoice): Station | null {
  if (choice.pick !== 'custom') return STATIONS.find((s) => s.label === choice.pick) ?? STATIONS[1]
  const n = Number.parseFloat(choice.value)
  if (!Number.isFinite(n) || n <= 0) return null
  return { label: distanceLabel(n, choice.unit), meters: toMeters(n, choice.unit) }
}

/**
 * The markers to offer a split taker who is moving, the ones further along the
 * course first, since that is the way anybody walks during a race. The spot they
 * are standing at is left off: moving there is not a move.
 */
export function movePresets(from: Station): Station[] {
  const others = STATIONS.filter((s) => s.label !== from.label)
  if (from.meters == null) return others
  const at = from.meters
  return [...others.filter((s) => (s.meters ?? 0) > at), ...others.filter((s) => (s.meters ?? 0) <= at)]
}
