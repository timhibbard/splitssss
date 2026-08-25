import assert from 'node:assert/strict'
import { test } from 'node:test'
import { METERS_PER_MILE, distanceLabel, pacePerMile, projectedFinish, toMeters } from './distance.ts'

test('distances convert to meters', () => {
  assert.equal(toMeters(1200, 'm'), 1200)
  assert.equal(toMeters(2, 'km'), 2000)
  assert.equal(toMeters(1, 'mi'), 1609)
  assert.equal(toMeters(2, 'mi'), 3219)
  assert.equal(toMeters(1.5, 'mi'), 2414)
  assert.equal(METERS_PER_MILE, 1609.344)
})

test('bad distance input resolves to zero, never NaN', () => {
  assert.equal(toMeters(-5, 'm'), 0)
  assert.equal(toMeters(0, 'm'), 0)
  assert.equal(toMeters(Number.NaN, 'mi'), 0)
})

test('split points are labelled the way a coach says them', () => {
  assert.equal(distanceLabel(1200, 'm'), '1200m')
  assert.equal(distanceLabel(2, 'km'), '2K')
  assert.equal(distanceLabel(2.5, 'km'), '2.5K')
  assert.equal(distanceLabel(2, 'mi'), 'Mile 2')
  assert.equal(distanceLabel(1.5, 'mi'), '1.5 mi')
})

test('pace per mile', () => {
  // A 12:00 split at the two mile mark is 6:00 per mile.
  assert.equal(pacePerMile(3219, 12 * 60_000), '6:00')
  assert.equal(pacePerMile(1609, 7.5 * 60_000), '7:30')
  // 2K is 1.243 miles, so 8:00 there is 6:26 per mile.
  assert.equal(pacePerMile(2000, 8 * 60_000), '6:26')
})

test('pace is blank when it cannot be known', () => {
  assert.equal(pacePerMile(0, 60_000), '', 'no distance')
  assert.equal(pacePerMile(1609, 0), '', 'no elapsed time')
  assert.equal(pacePerMile(1609, Number.NaN), '')
})

test('projected 5K finish from a split, at even pace', () => {
  // 12:00 at Mile 2 of a 5K. 3219m of 5000m, so 12:00 * 1.5533 = 18:38.
  const proj = projectedFinish(3219, 5000, 12 * 60_000)
  assert.equal(Math.round(proj! / 1000), 1118)

  // Same 6:00 pace read at Mile 1 instead: 5000/1609 = 3.107, so 18:39.
  const early = projectedFinish(1609, 5000, 6 * 60_000)
  assert.equal(Math.round(early! / 1000), 1119)

  // The two markers disagree by under a second, which is the rounding in
  // "Mile 1 is 1609m" and not anything a coach would notice.
  assert.ok(Math.abs(proj! - early!) < 1000, 'even pace agrees from either marker')
})

test('a split at the finish distance projects to itself', () => {
  assert.equal(projectedFinish(5000, 5000, 20 * 60_000), 20 * 60_000)
})

test('projection is undefined rather than wrong when inputs are missing', () => {
  assert.equal(projectedFinish(undefined, 5000, 60_000), undefined, 'custom station with no distance')
  assert.equal(projectedFinish(3219, undefined, 60_000), undefined)
  assert.equal(projectedFinish(0, 5000, 60_000), undefined)
  assert.equal(projectedFinish(3219, 5000, 0), undefined, 'no gun time yet')
  assert.equal(projectedFinish(3219, 5000, Number.NaN), undefined)
})
