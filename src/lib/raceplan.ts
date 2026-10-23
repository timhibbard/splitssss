// Explicit extensions: see the note in link.ts.
import { sniffSquad } from './lineup.ts'
import type { Meet } from './meet.ts'
import { type Published, PUBLISHED } from './pages.ts'
import type { Race } from './types.ts'

/**
 * How far a phone's marker can be from a plan's and still be the same place.
 * Both say "0.5 mi" and are read the same way, so they agree to the meter; this
 * is room for a phone set up with "800m" against a sheet that says 0.5 mi.
 */
const SAME_PLACE_METERS = 10

/**
 * The published meet a race on this phone is part of, for the same team: the
 * one run that day, or else the one with the name the phone was set up with, so
 * long as it has not been run yet. The name is what lets a coach try the phones
 * out the week before. Nothing for a race with no team, which is a race from
 * before the phone knew, and nothing for a meet already run, so last Saturday's
 * plan can never turn up on this Saturday's buttons.
 */
export function publishedFor(
  race: Pick<Race, 'date' | 'team' | 'meet'>,
  list: Published[] = PUBLISHED,
): Published | undefined {
  if (!race.team) return undefined
  const ours = list.filter((m) => m.team === race.team)
  const name = race.meet.trim().toLowerCase()
  return (
    ours.find((m) => m.date === race.date) ??
    ours.find((m) => m.date > race.date && m.name.toLowerCase() === name)
  )
}

/**
 * Each runner's planned time at the marker this phone is standing at, by label,
 * exactly as the coach's sheet gave it. The finish when the phone is at the
 * finish. Empty when the race is not one of the meet's events, when the phone
 * is somewhere the plan has no time for, or when the phone does not know where
 * it is.
 */
export function plannedHere(
  meet: Meet,
  race: Pick<Race, 'race' | 'station' | 'raceMeters'>,
): Map<string, number> {
  const out = new Map<string, number>()
  const meters = race.station.meters
  const squad = sniffSquad(race.race)
  const event = meet.events.find((e) => e.squad === squad)
  if (meters == null || !event) return out
  const index = event.markers.findIndex((m) => Math.abs(m.meters - meters) <= SAME_PLACE_METERS)
  const atFinish = index < 0 && Math.abs(race.raceMeters - meters) <= SAME_PLACE_METERS
  for (const runner of event.runners) {
    const at = index >= 0 ? runner.plan?.times[index] : atFinish ? runner.plan?.finish : undefined
    if (at != null) out.set(runner.label, at)
  }
  return out
}
