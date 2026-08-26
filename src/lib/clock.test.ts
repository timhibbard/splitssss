import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  elapsedMs,
  formatDelta,
  formatElapsed,
  formatIsoDate,
  formatMinSec,
  formatPr,
  formatPrShort,
  formatWallClock,
  parsePr,
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

test('a best time reads and prints as it is written on a results page', () => {
  assert.equal(parsePr('21:34.60'), 21 * 60_000 + 34_600)
  assert.equal(formatPr(21 * 60_000 + 34_600), '21:34.60')
  // A whole second best comes back with the hundredths spelled out, so the text
  // every channel carries has one shape rather than two.
  assert.equal(parsePr('24:00'), 24 * 60_000)
  assert.equal(formatPr(24 * 60_000), '24:00.00')
  assert.equal(parsePr('18:42.5'), 18 * 60_000 + 42_500, 'one decimal is tenths, not hundredths')
  assert.equal(formatPr(41 * 60_000), '41:00.00')
})

test('a best time is only a best time if it looks like one', () => {
  // A wrong PR is worse than none: every comparison on the screen would be
  // measured against it.
  assert.equal(parsePr('101'), undefined, 'a bib number is not a time')
  assert.equal(parsePr('21:6'), undefined, 'seconds are always two digits')
  assert.equal(parsePr('21:60'), undefined, 'sixty seconds is not a time')
  assert.equal(parsePr('21:34.607'), undefined, 'hundredths, not thousandths')
  assert.equal(parsePr(''), undefined)
  assert.equal(parsePr('  20:03.41  '), 20 * 60_000 + 3410, 'stray spaces are not a problem')
})

test('a button drops the hundredths and never rounds up', () => {
  // 18:40 is a time that runner has not run.
  assert.equal(formatPrShort(18 * 60_000 + 39_820), '18:39')
  assert.equal(formatPrShort(29 * 60_000 + 3440), '29:03')
  assert.equal(formatPrShort(24 * 60_000), '24:00')
})

test('a gap against a best time carries its sign, and level carries none', () => {
  assert.equal(formatDelta(12_000), '+0:12', 'behind the best is the plus')
  assert.equal(formatDelta(-8000), '-0:08')
  assert.equal(formatDelta(64_000), '+1:04')
  assert.equal(formatDelta(0), '0:00', 'dead even is not behind')
  assert.equal(formatDelta(400), '0:00', 'and neither is four tenths of a second')
  assert.equal(formatDelta(Number.NaN), '')
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
