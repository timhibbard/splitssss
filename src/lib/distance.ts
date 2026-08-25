export type Unit = 'm' | 'km' | 'mi'

export const METERS_PER_MILE = 1609.344

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
