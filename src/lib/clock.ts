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

export function todayIsoDate(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
