import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  elapsedMs,
  formatElapsed,
  formatIsoDate,
  formatMinSec,
  formatWallClock,
  todayIsoDate,
} from './clock.ts'
import type { Stamp } from './types.ts'

const gun: Stamp = { wallMs: 1_756_000_000_000, monoMs: 500_000 }

test('within one session, elapsed uses monotonic time', () => {
  // The wall clock jumped back two seconds mid race, as an NTP correction does.
  const tap: Stamp = { wallMs: gun.wallMs + 10_000 - 2000, monoMs: gun.monoMs + 10_000 }
  assert.equal(elapsedMs(gun, tap, true), 10_000, 'the clock correction is ignored')
})

test('across a refresh, elapsed falls back to wall clock', () => {
  // performance.timeOrigin resets on reload, so monotonic values from the new
  // session share no reference frame with the gun's.
  const tap: Stamp = { wallMs: gun.wallMs + 10_000, monoMs: 12 }
  assert.equal(elapsedMs(gun, tap, false), 10_000, 'wall clock still gives the right answer')
})

test('a tap before the gun reads negative rather than wrapping', () => {
  const tap: Stamp = { wallMs: gun.wallMs - 1500, monoMs: gun.monoMs - 1500 }
  assert.equal(elapsedMs(gun, tap, true), -1500)
  assert.equal(formatElapsed(-1500), '-0:01.5')
})

test('elapsed formats to tenths, never hundredths', () => {
  assert.equal(formatElapsed(0), '0:00.0')
  assert.equal(formatElapsed(999), '0:00.9', 'tenths truncate, so a time never rounds up')
  assert.equal(formatElapsed(1000), '0:01.0')
  assert.equal(formatElapsed(61_400), '1:01.4')
  assert.equal(formatElapsed(12 * 60_000), '12:00.0')
  assert.equal(formatElapsed(63 * 60_000), '63:00.0', 'past an hour it keeps counting minutes')
})

test('elapsed formatting survives a missing clock', () => {
  assert.equal(formatElapsed(Number.NaN), '--:--.-')
  assert.equal(formatElapsed(Number.POSITIVE_INFINITY), '--:--.-')
  assert.equal(formatMinSec(Number.NaN), '--:--')
})

test('derived times format without tenths', () => {
  assert.equal(formatMinSec(12 * 60_000), '12:00')
  assert.equal(formatMinSec(1_121_400), '18:41')
  assert.equal(formatMinSec(59_600), '1:00', 'rounds to the nearest second')
})

test('wall clock formats to tenths in local time', () => {
  const d = new Date(2026, 7, 24, 9, 4, 17, 340)
  assert.equal(formatWallClock(d.getTime()), '9:04:17.3')
})

test('a stored date reads as a day, in the timezone the phone is in', () => {
  // The bug this guards: new Date('2026-08-15') is UTC midnight, which is the
  // 14th anywhere in the Americas, so a race would be filed under the day before.
  const label = formatIsoDate('2026-08-15')
  assert.match(label, /Aug/, 'the month is spelled short')
  assert.match(label, /15/, 'the day is the stored day, not the one before it')
  assert.match(label, /Sat/, 'August 15 2026 is a Saturday, which is when meets are')
})

test('a date label never throws on something that is not a date', () => {
  assert.equal(formatIsoDate(''), '')
  assert.equal(formatIsoDate('whenever'), 'whenever')
  assert.equal(formatIsoDate('2026-08'), '2026-08')
})

test("today's date round trips through the label", () => {
  assert.match(todayIsoDate(), /^\d{4}-\d{2}-\d{2}$/)
  assert.notEqual(formatIsoDate(todayIsoDate()), todayIsoDate(), 'formatted, not passed through')
})
