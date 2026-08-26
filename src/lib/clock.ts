import type { Stamp } from './types'

/**
 * Identifies this page session. Monotonic times from different sessions do not
 * share a reference frame, so a tap records which session produced it.
 */
export const SESSION_ID = Math.random().toString(36).slice(2, 10)

/**
 * Capture the current moment. Called synchronously inside the tap handler, so
 * both readings reflect the tap and not a later render.
 */
export function stamp(): Stamp {
  return {
    wallMs: Date.now(),
    monoMs: performance.timeOrigin + performance.now(),
  }
}

/**
 * Elapsed ms between two stamps. Prefers monotonic time when both stamps come
 * from the same page session, since it survives a mid race NTP correction.
 */
export function elapsedMs(from: Stamp, to: Stamp, sameSession: boolean): number {
  return sameSession ? to.monoMs - from.monoMs : to.wallMs - from.wallMs
}

/**
 * Format elapsed ms as m:ss.t. Tenths only: the method does not support
 * hundredths and displaying them would imply precision we do not have.
 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--.-'
  const sign = ms < 0 ? '-' : ''
  const total = Math.abs(ms)
  const tenths = Math.floor((total % 1000) / 100)
  const secs = Math.floor(total / 1000) % 60
  const mins = Math.floor(total / 60000)
  return `${sign}${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

/**
 * Format elapsed ms as m:ss, no tenths. For derived numbers like a projected
 * finish, where tenths would imply the projection is that good.
 */
export function formatMinSec(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--'
  const total = Math.round(Math.abs(ms) / 1000)
  const sign = ms < 0 ? '-' : ''
  return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * A best time as a results page prints it: m:ss.hh.
 *
 * Hundredths here, unlike anything this app measures, because a PR is not a
 * measurement this app took. It is a number off a results page that a runner
 * knows to the hundredth, and rounding somebody's 18:39.82 to 18:40 in the one
 * place it appears would be this app inventing a time nobody ran.
 */
export function formatPr(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const total = Math.round(ms / 10)
  const hundredths = total % 100
  const secs = Math.floor(total / 100) % 60
  const mins = Math.floor(total / 6000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

/**
 * A best time with the hundredths dropped, for a button that has room for one
 * number. Truncated rather than rounded: 18:39.82 reads as 18:39, because 18:40
 * is a time that runner has never run and this is the number they know.
 */
export function formatPrShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Reads a best time out of text, as m:ss or m:ss.hh. Undefined for anything
 * else, so a bib number, a note, or a half typed time is not mistaken for a PR:
 * a wrong best time is worse than none, since every comparison on the screen
 * would be measured against it.
 */
export function parsePr(text: string): number | undefined {
  const m = /^(\d{1,3}):([0-5]\d)(?:\.(\d{1,2}))?$/.exec(text.trim())
  if (!m) return undefined
  const hundredths = m[3] ? Number(m[3].padEnd(2, '0')) : 0
  return Number(m[1]) * 60_000 + Number(m[2]) * 1000 + hundredths * 10
}

/**
 * A gap against a best time, signed, as +m:ss or -m:ss. Behind the best carries
 * the plus, because the projection is the bigger number and the sign is just the
 * sign of the subtraction.
 *
 * To the second, and no sign at all when it rounds to zero, because "0:00" with
 * a plus in front of it reads as behind when it means dead even.
 */
export function formatDelta(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  const total = Math.round(Math.abs(ms) / 1000)
  const body = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  if (total === 0) return body
  return `${ms < 0 ? '-' : '+'}${body}`
}

/** Format a wall clock time as h:mm:ss.t in the device's local timezone. */
export function formatWallClock(wallMs: number): string {
  const d = new Date(wallMs)
  const tenths = Math.floor(d.getMilliseconds() / 100)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}.${tenths}`
}

/** Full precision ISO timestamp, for the CSV. */
export function isoStamp(wallMs: number): string {
  return new Date(wallMs).toISOString()
}

/**
 * A stored date the way a coach says it: "Sat, Aug 15". Parsed at local noon
 * rather than by Date's ISO path, which reads a bare date as UTC midnight and
 * would show the day before to everybody west of Greenwich. Anything that is not
 * a date comes back untouched, because a label is not worth throwing over.
 */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function todayIsoDate(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
