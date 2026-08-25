// Explicit extensions: see the note in link.ts.
import { elapsedMs } from './clock.ts'
import { projectedFinish } from './distance.ts'
import type { Athlete, Race, Tap } from './types'

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
  /** Crossing order at this station, which is her place. */
  place: number
  /** Absent when the crossing has not been named yet. */
  athlete?: Athlete
  /** ms since the gun. Absent when no gun time has been set. */
  elapsed?: number
  /** ms. Absent without an elapsed time or a station distance. */
  projected?: number
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
  return taps.map((tap) => {
    const elapsed = race.gun
      ? elapsedMs(race.gun, tap, gunSameSession && tap.sessionId === sessionId)
      : undefined
    return {
      tap,
      place: tap.seq,
      // A missing athlete reads as unnamed rather than throwing. The list is what
      // a volunteer uses to fix things, so it has to render whatever is stored.
      athlete: tap.athleteId ? byId.get(tap.athleteId) : undefined,
      elapsed,
      projected:
        elapsed == null
          ? undefined
          : projectedFinish(race.station.meters, race.raceMeters, elapsed),
    }
  })
}

/**
 * Attaches an athlete to one crossing and takes her off any other, because a
 * runner passes a point once. Returns only the taps that changed, so the caller
 * writes exactly what it has to.
 *
 * That invariant is what makes a mis-tap fixable: naming #12 as Emma when Emma is
 * already on #7 leaves #7 unnamed and waiting, rather than putting her in two
 * places and quietly breaking the count.
 */
export function assignAthlete(taps: Tap[], tapId: string, athleteId: string): Tap[] {
  const changed: Tap[] = []
  for (const tap of taps) {
    if (tap.id === tapId) {
      if (tap.athleteId !== athleteId) changed.push({ ...tap, athleteId })
    } else if (tap.athleteId === athleteId) {
      const freed = { ...tap }
      delete freed.athleteId
      changed.push(freed)
    }
  }
  return changed
}

/** The crossing a name tap lands on when nobody picked one: oldest unnamed first. */
export function oldestUnnamed(taps: Tap[]): Tap | undefined {
  return taps.find((tap) => !tap.athleteId)
}
