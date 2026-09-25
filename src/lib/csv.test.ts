import assert from 'node:assert/strict'
import { test } from 'node:test'
import { csvFilename, stationNames, toCsv, toTextSummary } from './csv.ts'
import type { Race, Tap } from './types.ts'

const SESSION = 'here'
const GUN_WALL = 1_700_000_000_000

function tap(seq: number, secs: number, athleteId?: string, leg?: number): Tap {
  return {
    id: `t${seq}`,
    seq,
    ...(leg == null ? {} : { leg }),
    wallMs: GUN_WALL + secs * 1000,
    monoMs: 5_000 + secs * 1000,
    sessionId: SESSION,
    ...(athleteId ? { athleteId } : {}),
  }
}

function race(over: Partial<Race> = {}): Race {
  return {
    id: 'r1',
    meet: 'Low Country',
    race: 'Varsity Girls',
    station: { label: 'Mile 1', meters: 1609 },
    raceMeters: 5000,
    timer: 'Sam',
    date: '2026-09-27',
    gun: { wallMs: GUN_WALL, monoMs: 5_000 },
    gunSessionId: SESSION,
    createdWallMs: GUN_WALL,
    athletes: [
      { id: 'a1', name: 'Marlowe Holloway' },
      { id: 'a2', name: 'Rowan Hayes' },
    ],
    ...over,
  }
}

const MOVED = {
  earlierStations: [{ label: '0.5 mi', meters: 805 }],
  station: { label: 'Mile 2', meters: 3219 },
}

/** The CSV as rows of named cells, for reading one column without counting commas. */
function table(csv: string): Record<string, string>[] {
  const [head, ...rows] = csv.split('\n').map((line) => line.split(','))
  return rows.map((row) => Object.fromEntries(head.map((col, i) => [col, row[i]])))
}

test('a race that never moved exports the way it always has', () => {
  const taps = [tap(1, 480, 'a1'), tap(2, 490)]
  const rows = table(toCsv(race(), taps))
  assert.deepEqual(
    rows.map((r) => [r.station, r.station_meters, r.place, r.athlete]),
    [
      ['Mile 1', '1609', '1', 'Marlowe Holloway'],
      ['Mile 1', '1609', '2', ''],
    ],
  )
  assert.equal(csvFilename(race(), taps), '2026-09-27-varsity-girls-mile-1.csv')
  assert.match(toTextSummary(race(), taps), /Varsity Girls at Mile 1\n/)
  assert.match(toTextSummary(race(), taps), /2 crossings/)
})

test('a race that moved has a row per crossing, each with its own spot and place there', () => {
  const taps = [tap(1, 240, 'a1'), tap(2, 250, 'a2'), tap(3, 960, 'a2', 1), tap(4, 970, 'a1', 1)]
  const rows = table(toCsv(race(MOVED), taps))
  assert.deepEqual(
    rows.map((r) => [r.station, r.station_meters, r.place, r.athlete]),
    [
      ['0.5 mi', '805', '1', 'Marlowe Holloway'],
      ['0.5 mi', '805', '2', 'Rowan Hayes'],
      ['Mile 2', '3219', '1', 'Rowan Hayes'],
      ['Mile 2', '3219', '2', 'Marlowe Holloway'],
    ],
  )
  // Pace is over each row's own distance: 4:00 at 805m and 16:00 at 3219m.
  assert.equal(rows[0].pace_per_mile, '8:00')
  assert.equal(rows[2].pace_per_mile, '8:00')
})

test('the file and the text name every spot that has crossings', () => {
  const taps = [tap(1, 240, 'a1'), tap(2, 960, 'a1', 1)]
  assert.equal(csvFilename(race(MOVED), taps), '2026-09-27-varsity-girls-0-5-mi-mile-2.csv')
  const text = toTextSummary(race(MOVED), taps)
  assert.match(text, /Varsity Girls at 0\.5 mi and Mile 2\n/)
  assert.match(text, /At 0\.5 mi, 1 crossing\n1\. /)
  assert.match(text, /At Mile 2, 1 crossing\n1\. /)
})

test('a spot moved on from with nothing tapped there is left out of the name', () => {
  const taps = [tap(1, 960, 'a1', 1)]
  assert.equal(stationNames(race(MOVED), taps), 'Mile 2')
  assert.equal(stationNames(race(MOVED)), '0.5 mi and Mile 2')
})
