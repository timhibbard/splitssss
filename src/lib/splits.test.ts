import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignAthlete, clearName, gridOrder, namedInOrder, splitRows, stillOut } from './splits.ts'
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
      { id: 'a1', name: 'Marlowe Holloway' },
      { id: 'a2', name: 'Rowan Hayes' },
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
      [1, 'Marlowe Holloway'],
      [2, undefined],
      [3, 'Rowan Hayes'],
    ],
  )
})

test('each row carries its split and its projected finish', () => {
  // 8:00 at 2000m of a 5000m race projects to 20:00.
  const rows = splitRows(race(), [tap(1, 480, 'a1')], SESSION)
  assert.equal(rows[0].elapsed, 480_000)
  assert.equal(rows[0].projected, 1_200_000)
})

test("a row says where that pace stands against the runner's best", () => {
  // 8:00 at 2K projects to 20:00, against a 19:48 best, so twelve seconds behind.
  const team = [{ id: 'a1', name: 'Marlowe Holloway', pr: 19 * 60_000 + 48_000 }]
  const rows = splitRows(race({ athletes: team }), [tap(1, 480, 'a1')], SESSION)
  assert.equal(rows[0].vsPr, 12_000)
})

test('a runner ahead of their best gets a negative gap', () => {
  const team = [{ id: 'a1', name: 'Marlowe Holloway', pr: 20 * 60_000 + 30_000 }]
  const rows = splitRows(race({ athletes: team }), [tap(1, 480, 'a1')], SESSION)
  assert.equal(rows[0].vsPr, -30_000)
})

test('no best time, no projection, or the wrong distance means no gap at all', () => {
  const withPr = [{ id: 'a1', name: 'Marlowe Holloway', pr: 20 * 60_000 }]

  assert.equal(
    splitRows(race(), [tap(1, 480, 'a1')], SESSION)[0].vsPr,
    undefined,
    'a runner with no best has nothing to be compared to',
  )
  const noMeters = race({ athletes: withPr, station: { label: 'Finish' } })
  assert.equal(
    splitRows(noMeters, [tap(1, 480, 'a1')], SESSION)[0].vsPr,
    undefined,
    'and with no station distance there is no projection to compare',
  )
  // A 4K projection against a 5K best is two different numbers subtracted, which
  // would be a twenty second lie in the one place a coach would believe it.
  assert.equal(
    splitRows(race({ athletes: withPr, raceMeters: 4000 }), [tap(1, 480, 'a1')], SESSION)[0].vsPr,
    undefined,
    'a race that is not the PR distance gets no comparison',
  )
})

test('an unnamed crossing has nobody to compare, and says so rather than guessing', () => {
  const team = [{ id: 'a1', name: 'Marlowe Holloway', pr: 20 * 60_000 }]
  const rows = splitRows(race({ athletes: team }), [tap(1, 480)], SESSION)
  assert.equal(rows[0].projected, 1_200_000, 'the time is still a time')
  assert.equal(rows[0].vsPr, undefined)
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

test('a name can come back off a crossing without losing the time', () => {
  const taps = [tap(1, 400, 'a1'), tap(2, 410)]
  const changed = clearName(taps, 't1')
  assert.equal(changed.length, 1)
  assert.equal(changed[0].athleteId, undefined)
  assert.equal(changed[0].wallMs, taps[0].wallMs)
  // Nothing to clear is not an error, and writes nothing.
  assert.deepEqual(clearName(taps, 't2'), [])
  assert.deepEqual(clearName(taps, 'gone'), [])
})

test('a waiting crossing offers the runners who have none here yet', () => {
  const athletes = [
    { id: 'a1', name: 'Marlowe Holloway' },
    { id: 'a2', name: 'Rowan Hayes' },
    { id: 'a3', name: 'Jordan Blake' },
  ]
  const taps = [tap(1, 400, 'a2'), tap(2, 410)]
  assert.deepEqual(
    stillOut(athletes, taps).map((a) => a.name),
    ['Marlowe Holloway', 'Jordan Blake'],
  )
  // Roster order is kept, because it is the order the coach expects them to pass.
  assert.deepEqual(stillOut(athletes, []), athletes)
  assert.deepEqual(stillOut([], taps), [])
})

test('the name grid puts the runners still out on the course first', () => {
  const athletes = [
    { id: 'a1', name: 'Marlowe Holloway' },
    { id: 'a2', name: 'Rowan Hayes' },
    { id: 'a3', name: 'Jordan Blake' },
    { id: 'a4', name: 'Priya Whitaker' },
  ]
  // Second and fourth have crossed, in that order.
  assert.deepEqual(
    gridOrder(athletes, ['a2', 'a4']).map((a) => a.id),
    ['a1', 'a3', 'a2', 'a4'],
  )
  // Roster order for the ones still running, crossing order behind them.
  assert.deepEqual(
    gridOrder(athletes, ['a4', 'a1']).map((a) => a.id),
    ['a2', 'a3', 'a4', 'a1'],
  )
  // Nobody moved yet is the roster untouched, which is what the first three
  // seconds of a race look like.
  assert.deepEqual(gridOrder(athletes, []), athletes)
})

test('the name grid never repeats or invents a runner', () => {
  const athletes = [
    { id: 'a1', name: 'Marlowe Holloway' },
    { id: 'a2', name: 'Rowan Hayes' },
  ]
  // An id twice is still one button, and an id for somebody taken out of the
  // lineup is dropped rather than rendered as a hole.
  assert.deepEqual(
    gridOrder(athletes, ['a2', 'a2', 'gone']).map((a) => a.id),
    ['a1', 'a2'],
  )
  assert.deepEqual(gridOrder([], ['a1']), [])
})

test('who has crossed comes back in the order they passed', () => {
  const taps = [tap(1, 400, 'a3'), tap(2, 410), tap(3, 420, 'a1')]
  assert.deepEqual(namedInOrder(taps), ['a3', 'a1'])
  assert.deepEqual(namedInOrder([]), [])
})
