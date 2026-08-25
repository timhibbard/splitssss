import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignAthlete, oldestUnnamed, splitRows } from './splits.ts'
import type { Race, Tap } from './types.ts'

const SESSION = 'here'
const GUN_WALL = 1_700_000_000_000
const GUN_MONO = 5_000

function tap(seq: number, secs: number, athleteId?: string, sessionId = SESSION): Tap {
  return {
    id: `t${seq}`,
    seq,
    wallMs: GUN_WALL + secs * 1000,
    monoMs: GUN_MONO + secs * 1000,
    sessionId,
    ...(athleteId ? { athleteId } : {}),
  }
}

function race(over: Partial<Race> = {}): Race {
  return {
    id: 'r1',
    meet: 'Eye Opener',
    race: 'Varsity Girls',
    station: { label: '2K', meters: 2000 },
    raceMeters: 5000,
    timer: 'Coach',
    date: '2026-08-24',
    gun: { wallMs: GUN_WALL, monoMs: GUN_MONO },
    gunSessionId: SESSION,
    createdWallMs: GUN_WALL,
    athletes: [
      { id: 'a1', name: 'Caroline King' },
      { id: 'a2', name: 'Emma Richard' },
    ],
    ...over,
  }
}

test('named and unnamed crossings come back interlaced, in crossing order', () => {
  const taps = [tap(1, 400, 'a1'), tap(2, 410), tap(3, 420, 'a2')]
  const rows = splitRows(race(), taps, SESSION)

  assert.deepEqual(
    rows.map((r) => [r.place, r.athlete?.name]),
    [
      [1, 'Caroline King'],
      [2, undefined],
      [3, 'Emma Richard'],
    ],
  )
})

test('each row carries its split and its projected finish', () => {
  // 8:00 at 2000m of a 5000m race projects to 20:00.
  const rows = splitRows(race(), [tap(1, 480, 'a1')], SESSION)
  assert.equal(rows[0].elapsed, 480_000)
  assert.equal(rows[0].projected, 1_200_000)
})

test('a station with no distance still gives a split, just no projection', () => {
  const rows = splitRows(race({ station: { label: 'Finish' } }), [tap(1, 480)], SESSION)
  assert.equal(rows[0].elapsed, 480_000)
  assert.equal(rows[0].projected, undefined)
})

test('with no gun set there is no elapsed time and no projection', () => {
  const rows = splitRows(race({ gun: undefined, gunSessionId: undefined }), [tap(1, 480)], SESSION)
  assert.equal(rows[0].elapsed, undefined)
  assert.equal(rows[0].projected, undefined)
})

test('a tap from another page session is measured on the wall clock', () => {
  // Same wall clock offset, a monotonic reading from a different reference frame.
  const stale: Tap = { ...tap(1, 300), monoMs: 999_999_999, sessionId: 'other' }
  const rows = splitRows(race(), [stale], SESSION)
  assert.equal(rows[0].elapsed, 300_000)
})

test('a gun from a reloaded session is measured on the wall clock', () => {
  const rows = splitRows(race({ gunSessionId: 'before-the-reload' }), [tap(1, 300)], SESSION)
  assert.equal(rows[0].elapsed, 300_000)
})

test('a crossing naming an athlete who is gone reads as unnamed, not as a crash', () => {
  const rows = splitRows(race(), [tap(1, 400, 'deleted')], SESSION)
  assert.equal(rows[0].athlete, undefined)
  assert.equal(rows[0].place, 1)
})

test('naming a crossing takes the athlete off any other crossing', () => {
  const taps = [tap(1, 400, 'a1'), tap(2, 410), tap(3, 420)]
  const changed = assignAthlete(taps, 't3', 'a1')

  assert.equal(changed.length, 2)
  assert.deepEqual(
    changed.map((t) => [t.seq, t.athleteId]),
    [
      [1, undefined],
      [3, 'a1'],
    ],
  )
  // The freed crossing keeps its time, which is the whole point of freeing it.
  assert.equal(changed[0].wallMs, taps[0].wallMs)
})

test('naming a crossing with the athlete already on it changes nothing', () => {
  assert.deepEqual(assignAthlete([tap(1, 400, 'a1')], 't1', 'a1'), [])
})

test('naming an unnamed crossing touches only that crossing', () => {
  const taps = [tap(1, 400, 'a1'), tap(2, 410)]
  const changed = assignAthlete(taps, 't2', 'a2')
  assert.deepEqual(
    changed.map((t) => [t.seq, t.athleteId]),
    [[2, 'a2']],
  )
})

test('a name tap with nothing chosen lands on the oldest unnamed crossing', () => {
  const taps = [tap(1, 400, 'a1'), tap(2, 410), tap(3, 420)]
  assert.equal(oldestUnnamed(taps)?.seq, 2)
  assert.equal(oldestUnnamed([tap(1, 400, 'a1')]), undefined)
  assert.equal(oldestUnnamed([]), undefined)
})
