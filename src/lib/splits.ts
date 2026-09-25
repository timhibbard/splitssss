// Explicit extensions: see the note in link.ts.
import { elapsedMs } from './clock.ts'
import { PR_METERS, projectedFinish } from './distance.ts'
import type { Athlete, Race, Station, Tap } from './types'

/**
 * One crossing, ready to read off a phone: place, split, who it was, and what
 * that pace projects to at the finish.
 *
 * Named and unnamed crossings are the same kind of row. A volunteer who cannot
 * identify a runner still recorded a place and a time, and the row exists to be
 * filled in later, so hiding it or listing it separately would lose the one thing
 * that makes it fixable.
 */
export type SplitRow = {
  tap: Tap
  /** Crossing order at this row's spot, which is the runner's place there. */
  place: number
  /** Which spot the crossing was taken at. See stationsOf. */
  leg: number
  station: Station
  /** Absent when the crossing has not been named yet. */
  athlete?: Athlete
  /** ms since the gun. Absent when no gun time has been set. */
  elapsed?: number
  /** ms. Absent without an elapsed time or a station distance. */
  projected?: number
  /**
   * How this pace projects against that runner's best, in ms. Positive is behind
   * the PR, since the projection is the bigger number. Absent when the runner has
   * no best, when there is no projection, or when the race is not the distance a
   * PR is a best at.
   */
  vsPr?: number
}

/**
 * The gap between what this pace projects to and the runner's best.
 *
 * Only over the distance the PR was run at. A projection is what a pace works out
 * to at *this* race's finish, and comparing a 4K projection to a 5K best would
 * hand a coach a twenty second lie in the one place they would believe it.
 */
export function prGap(
  projected: number | undefined,
  pr: number | undefined,
  raceMeters: number | undefined,
): number | undefined {
  if (projected == null || pr == null || raceMeters !== PR_METERS) return undefined
  return projected - pr
}

/**
 * Every spot this phone has stood at in the race, first spot first. The last one
 * is where it is now. A race that never moved has one.
 */
export function stationsOf(race: Race): Station[] {
  return [...(race.earlierStations ?? []), race.station]
}

/** The index of the spot the phone is at now, which is where new crossings go. */
export function currentLeg(race: Race): number {
  return race.earlierStations?.length ?? 0
}

/** Which spot a crossing was taken at. Crossings from before a phone could move were all at the first. */
export function legOf(tap: Tap): number {
  return tap.leg ?? 0
}

/** The crossings taken at one spot, in the order they passed. */
export function tapsAt(taps: Tap[], leg: number): Tap[] {
  return taps.filter((tap) => legOf(tap) === leg)
}

/**
 * Each crossing's place, counted from 1 at each spot. A runner who was 4th past
 * Mile 1 and 6th past Mile 2 is both, so the count cannot be the race-wide seq.
 */
export function placesOf(taps: Tap[]): Map<string, number> {
  const counts = new Map<number, number>()
  const places = new Map<string, number>()
  for (const tap of [...taps].sort((a, b) => a.seq - b.seq)) {
    const place = (counts.get(legOf(tap)) ?? 0) + 1
    counts.set(legOf(tap), place)
    places.set(tap.id, place)
  }
  return places
}

/**
 * Builds the running list, in crossing order.
 *
 * `sessionId` is passed in rather than read from the clock module so this stays
 * pure: monotonic readings are only comparable inside the page session that took
 * them, and across a reload the wall clock is the only honest answer.
 */
export function splitRows(race: Race, taps: Tap[], sessionId: string): SplitRow[] {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  const gunSameSession = race.gunSessionId === sessionId
  const stations = stationsOf(race)
  const places = placesOf(taps)
  return taps.map((tap) => {
    const leg = legOf(tap)
    // A leg past the end would be a crossing from a spot that was taken back,
    // which Back to only allows when there are none. Read it as where the
    // phone is now rather than lose the row.
    const station = stations[leg] ?? race.station
    const elapsed = race.gun
      ? elapsedMs(race.gun, tap, gunSameSession && tap.sessionId === sessionId)
      : undefined
    // A missing athlete reads as unnamed rather than throwing. The list is what
    // a volunteer uses to fix things, so it has to render whatever is stored.
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const projected =
      elapsed == null
        ? undefined
        : projectedFinish(station.meters, race.raceMeters, elapsed)
    return {
      tap,
      place: places.get(tap.id) ?? tap.seq,
      leg,
      station,
      athlete,
      elapsed,
      projected,
      vsPr: prGap(projected, athlete?.pr, race.raceMeters),
    }
  })
}

/**
 * Attaches an athlete to one crossing and off any other at the same spot, because
 * a runner passes a point once. Crossings at other spots are left alone: the
 * same runner passing Mile 1 and then Mile 2 is two real splits. Returns only the
 * taps that changed, so the caller writes exactly what it has to.
 *
 * That invariant is what makes a mis-tap fixable: naming #12 as Rowan when Rowan
 * is already on #7 leaves #7 unnamed and waiting, rather than counting one runner
 * in two places and quietly breaking the count.
 */
export function assignAthlete(taps: Tap[], tapId: string, athleteId: string): Tap[] {
  const target = taps.find((tap) => tap.id === tapId)
  if (!target) return []
  const changed: Tap[] = []
  for (const tap of taps) {
    if (tap.id === tapId) {
      if (tap.athleteId !== athleteId) changed.push({ ...tap, athleteId })
    } else if (tap.athleteId === athleteId && legOf(tap) === legOf(target)) {
      const freed = { ...tap }
      delete freed.athleteId
      changed.push(freed)
    }
  }
  return changed
}

/**
 * Takes the name back off a crossing, keeping the time. For a name picked in
 * error, where the crossing itself was real. Returns the taps that changed.
 */
export function clearName(taps: Tap[], tapId: string): Tap[] {
  const found = taps.find((tap) => tap.id === tapId)
  if (!found?.athleteId) return []
  const bare = { ...found }
  delete bare.athleteId
  return [bare]
}

/** Who has a crossing here, in the order they passed. */
export function namedInOrder(taps: Tap[]): string[] {
  return taps.map((tap) => tap.athleteId).filter((id): id is string => !!id)
}

/**
 * The name grid's order: the runners still out on the course first, in roster
 * order, and the ones already recorded behind them in the order they passed.
 *
 * Which runners have moved is passed in rather than read off the taps, because
 * the grid is deliberately behind the data. A chip that moved the instant its
 * name was tapped would rearrange the grid under a thumb already travelling
 * towards the next runner, which is the same reason a recorded name is struck
 * through rather than removed. The screen decides when they move. This decides
 * where they go.
 */
export function gridOrder(athletes: Athlete[], moved: string[]): Athlete[] {
  // A Set keeps insertion order and drops any id given twice, so the same runner
  // can never come back as two buttons.
  const back = new Set(moved)
  const byId = new Map(athletes.map((a) => [a.id, a]))
  return [
    ...athletes.filter((a) => !back.has(a.id)),
    ...[...back].map((id) => byId.get(id)).filter((a): a is Athlete => a != null),
  ]
}

/** Runners with no crossing here yet, which is who a waiting crossing can be. */
export function stillOut(athletes: Athlete[], taps: Tap[]): Athlete[] {
  const taken = new Set(taps.map((tap) => tap.athleteId).filter(Boolean))
  return athletes.filter((a) => !taken.has(a.id))
}
