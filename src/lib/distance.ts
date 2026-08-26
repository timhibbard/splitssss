export type Unit = 'm' | 'km' | 'mi'

export const METERS_PER_MILE = 1609.344

/**
 * What a personal best is a best at. High school cross country is a 5K, so a PR
 * on this team is a 5K PR, and a projection is only worth comparing to it when
 * the race is over the same ground. A 4K projection against a 5K best is not a
 * gap, it is two different numbers subtracted, so nothing is shown instead.
 */
export const PR_METERS = 5000

export function toMeters(value: number, unit: Unit): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  switch (unit) {
    case 'm':
      return Math.round(value)
    case 'km':
      return Math.round(value * 1000)
    case 'mi':
      return Math.round(value * METERS_PER_MILE)
  }
}

/**
 * Names a split point the way a coach would say it out loud. Whole miles read as
 * "Mile 2", kilometers use the cross country "2K" convention.
 */
export function distanceLabel(value: number, unit: Unit): string {
  const n = Number.isInteger(value) ? String(value) : String(value)
  switch (unit) {
    case 'm':
      return `${n}m`
    case 'km':
      return `${n}K`
    case 'mi':
      return Number.isInteger(value) ? `Mile ${n}` : `${n} mi`
  }
}

/**
 * Even pace projection: the finish time a runner is on for at the pace run so
 * far.
 *
 * Deliberately linear rather than Riegel's endurance formula. Riegel would
 * predict a slower finish, and probably a more accurate one, but this number is
 * read off a phone mid race and then said out loud to a teenager. "If you hold
 * this pace" is a thing a coach can explain and an athlete can act on. A decay
 * exponent is not.
 */
export function projectedFinish(
  stationMeters: number | undefined,
  raceMeters: number | undefined,
  elapsed: number,
): number | undefined {
  if (!stationMeters || !raceMeters) return undefined
  if (stationMeters <= 0 || raceMeters <= 0) return undefined
  if (!Number.isFinite(elapsed) || elapsed <= 0) return undefined
  return elapsed * (raceMeters / stationMeters)
}

/**
 * Pace per mile as m:ss. No tenths: pace is derived from a hand timed split over
 * a course marker that was probably paced off by a volunteer, so the precision
 * is not there and showing it would be a lie.
 */
export function pacePerMile(meters: number, elapsed: number): string {
  if (!meters || !Number.isFinite(elapsed) || elapsed <= 0) return ''
  const msPerMile = elapsed / (meters / METERS_PER_MILE)
  const totalSec = Math.round(msPerMile / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
