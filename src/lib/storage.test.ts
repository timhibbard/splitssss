import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * Minimal synchronous localStorage, installed before importing storage.ts. The
 * real durability claim depends on setItem being synchronous, so a Map is a
 * faithful stand in.
 */
class MemoryStorage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
  /** Test-only: corrupt a value the way a partial write would. */
  poison(k: string, v: string) {
    this.map.set(k, v)
  }
}

const mem = new MemoryStorage()
;(globalThis as { localStorage?: unknown }).localStorage = mem

const store = await import('./storage.ts')
const { SESSION_ID } = await import('./clock.ts')
import type { Race, Tap } from './types.ts'

function race(id = 'r1'): Race {
  return {
    id,
    meet: 'Eye Opener',
    race: 'JV Girls',
    station: { label: 'Mile 2', meters: 3219 },
    raceMeters: 5000,
    timer: 'A Parent',
    date: '2026-08-24',
    createdWallMs: 1_756_000_000_000,
    athletes: [{ id: 'a1', name: 'Avery Collins' }],
  }
}

function tap(seq: number, athleteId?: string): Tap {
  return {
    id: `t${seq}`,
    seq,
    wallMs: 1_756_000_000_000 + seq * 1000,
    monoMs: 500_000 + seq * 1000,
    sessionId: SESSION_ID,
    ...(athleteId ? { athleteId } : {}),
  }
}

test('a refresh restores the race and every tap, in crossing order', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  store.setActiveRaceId(r.id)
  for (const seq of [1, 2, 3, 4, 5]) store.saveTap(r.id, tap(seq))

  // Simulate the reload: the module has no in-memory state to lean on, so this
  // is exactly what App.restore() does on a fresh page.
  const activeId = store.getActiveRaceId()
  assert.equal(activeId, 'r1')
  const restoredRace = store.loadRace(activeId!)
  const restoredTaps = store.loadTaps(activeId!)

  assert.equal(restoredRace?.station.label, 'Mile 2')
  assert.equal(restoredRace?.raceMeters, 5000)
  assert.deepEqual(
    restoredTaps.map((t) => t.seq),
    [1, 2, 3, 4, 5],
  )
})

test('taps sort by crossing order past ten, not lexically', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  // Written out of order on purpose.
  for (const seq of [11, 2, 10, 1, 9]) store.saveTap(r.id, tap(seq))
  assert.deepEqual(
    store.loadTaps(r.id).map((t) => t.seq),
    [1, 2, 9, 10, 11],
  )
})

test('one tap per key: deleting one leaves the rest intact', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  for (const seq of [1, 2, 3]) store.saveTap(r.id, tap(seq))
  store.deleteTap(r.id, 3)
  assert.deepEqual(
    store.loadTaps(r.id).map((t) => t.seq),
    [1, 2],
  )
})

test('a corrupt tap loses that tap, not the race', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  for (const seq of [1, 2, 3]) store.saveTap(r.id, tap(seq))
  mem.poison('ss.v2.tap.r1.0002', '{"seq":2,,,truncated')

  const survivors = store.loadTaps(r.id)
  assert.deepEqual(
    survivors.map((t) => t.seq),
    [1, 3],
    'the readable taps still load',
  )
  assert.equal(store.loadRace(r.id)?.race, 'JV Girls', 'race metadata is untouched')
})

test('a corrupt race record does not throw', () => {
  mem.clear()
  mem.poison('ss.v2.race.r1', 'not json')
  assert.equal(store.loadRace('r1'), null)
  assert.deepEqual(store.loadAllRaces(), [])
})

test('taps from one race never leak into another', () => {
  mem.clear()
  store.saveRace(race('r1'))
  store.saveRace(race('r2'))
  store.saveTap('r1', tap(1))
  store.saveTap('r2', tap(1))
  store.saveTap('r2', tap(2))
  assert.equal(store.loadTaps('r1').length, 1)
  assert.equal(store.loadTaps('r2').length, 2)
})

test('assigning a name overwrites the tap in place, keeping its time', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  store.saveTap(r.id, tap(1))
  const original = store.loadTaps(r.id)[0]

  store.saveTap(r.id, { ...original, athleteId: 'a1' })

  const after = store.loadTaps(r.id)
  assert.equal(after.length, 1, 'naming does not create a second crossing')
  assert.equal(after[0].athleteId, 'a1')
  assert.equal(after[0].wallMs, original.wallMs, 'the recorded time is unchanged')
  assert.equal(after[0].monoMs, original.monoMs)
})

test('the roster survives a refresh and is independent of any race', () => {
  mem.clear()
  store.saveRoster([
    { id: 'a1', name: 'Avery Collins' },
    { id: 'a2', name: 'Rowan Hayes' },
  ])
  const back = store.loadRoster()
  assert.equal(back.length, 2)
  assert.equal(back[1].name, 'Rowan Hayes')
  assert.deepEqual(store.loadAllRaces(), [], 'roster is not stored as a race')
})

test('an absent or corrupt roster reads as empty rather than throwing', () => {
  mem.clear()
  assert.deepEqual(store.loadRoster(), [])
  mem.poison('ss.v2.roster', '{not an array}')
  assert.deepEqual(store.loadRoster(), [])
  mem.poison('ss.v2.roster', '"a string"')
  assert.deepEqual(store.loadRoster(), [], 'valid JSON of the wrong shape is rejected')
})

test('a lineup nobody has chosen is not an empty lineup', () => {
  mem.clear()
  assert.equal(store.loadLineup('Varsity Girls'), null, 'null, not []')
  store.saveLineup('Varsity Girls', [])
  assert.deepEqual(store.loadLineup('Varsity Girls'), [], 'choosing nobody is a choice')
})

test('a lineup is remembered by race name, not by race', () => {
  mem.clear()
  store.saveLineup('Varsity Girls', ['a1', 'a2', 'a3'])
  store.saveLineup('JV Girls', ['a4', 'a5'])
  assert.deepEqual(store.loadLineup('Varsity Girls'), ['a1', 'a2', 'a3'])
  assert.deepEqual(store.loadLineup('JV Girls'), ['a4', 'a5'])
})

test('a race name typed a little differently finds the same lineup', () => {
  mem.clear()
  store.saveLineup('Varsity Girls', ['a1'])
  assert.deepEqual(store.loadLineup(' varsity girls '), ['a1'])
})

test('a corrupt lineup reads as never chosen', () => {
  mem.clear()
  mem.poison('ss.v2.lineup.varsity-girls', '{ not json')
  assert.equal(store.loadLineup('Varsity Girls'), null)
})

test('the shipped list this phone has seen is remembered', () => {
  mem.clear()
  assert.equal(store.loadShippedSeen(), null, 'a fresh phone has seen nothing')
  store.saveShippedSeen('Avery C.\nRowan H.')
  assert.equal(store.loadShippedSeen(), 'Avery C.\nRowan H.')
})

test('clearing the races wipes races, taps and the active pointer', () => {
  mem.clear()
  store.saveRace(race('r1'))
  store.saveRace(race('r2'))
  store.setActiveRaceId('r1')
  for (const seq of [1, 2, 3]) store.saveTap('r1', tap(seq))

  const removed = store.clearRaces()

  assert.equal(removed, 6, '2 races, 3 taps and the active pointer')
  assert.deepEqual(store.loadAllRaces(), [])
  assert.deepEqual(store.loadTaps('r1'), [])
  assert.equal(store.getActiveRaceId(), null)
  assert.equal(mem.length, 0)
})

test('clearing the races keeps the team, the lineups and the shipped list', () => {
  mem.clear()
  store.saveRace(race('r1'))
  store.saveTap('r1', tap(1))
  store.saveRoster([{ id: 'a1', name: 'Avery Collins' }])
  store.saveLineup('JV Girls', ['a1'])
  store.saveShippedSeen('Avery C.')

  store.clearRaces()

  // The names are the part with no copy on the phone to rebuild from, and
  // clearing last week's meet is not a request to retype the team.
  assert.deepEqual(store.loadRoster(), [{ id: 'a1', name: 'Avery Collins' }])
  assert.deepEqual(store.loadLineup('JV Girls'), ['a1'])
  assert.equal(store.loadShippedSeen(), 'Avery C.')
})

test('clearing the races takes an older schema version of a race with it', () => {
  mem.clear()
  mem.poison('ss.v1.race.old', '{}')
  mem.poison('ss.v1.tap.old.0001', '{}')
  mem.poison('ss.v1.active', 'old')
  assert.equal(store.clearRaces(), 3)
  assert.equal(mem.length, 0)
})

test('clearing the races leaves keys that are not ours alone', () => {
  mem.clear()
  mem.poison('theme', 'dark')
  mem.poison('ss.v2.roster', '[]')
  mem.poison('ssomething.v2.race.x', '{}')
  store.saveRace(race('r1'))
  const removed = store.clearRaces()
  assert.equal(removed, 1, 'only the race')
  assert.equal(mem.getItem('theme'), 'dark')
  assert.equal(mem.getItem('ssomething.v2.race.x'), '{}')
})

test('counts describe what a clear would destroy, and what it would keep', () => {
  mem.clear()
  store.saveRace(race('r1'))
  for (const seq of [1, 2]) store.saveTap('r1', tap(seq))
  store.saveRoster([
    { id: 'a1', name: 'Avery Collins' },
    { id: 'a2', name: 'Rowan Hayes' },
  ])
  assert.deepEqual(store.storedCounts(), { races: 1, taps: 2, roster: 2 })
})

test('clearing the active race leaves the data recoverable', () => {
  mem.clear()
  const r = race()
  store.saveRace(r)
  store.setActiveRaceId(r.id)
  store.saveTap(r.id, tap(1))

  store.setActiveRaceId(null)

  assert.equal(store.getActiveRaceId(), null, 'nothing is being timed')
  assert.equal(store.loadRace(r.id)?.id, 'r1', 'but the race is still there')
  assert.equal(store.loadTaps(r.id).length, 1, 'and so are its taps')
})
