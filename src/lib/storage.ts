import type { Athlete, Race, Tap } from './types'

/**
 * localStorage, deliberately, not IndexedDB.
 *
 * A tap must survive iOS discarding the page one frame after the tap.
 * localStorage writes are synchronous, so the data is durable before the event
 * handler returns. IndexedDB's advantages do not apply at ~60 taps per meet.
 *
 * Each tap gets its own key so a write never rewrites another tap's data.
 */

const RACE_PREFIX = 'ss.v2.race.'
const TAP_PREFIX = 'ss.v2.tap.'
const ACTIVE_KEY = 'ss.v2.active'
const ROSTER_KEY = 'ss.v2.roster'
const LINEUP_PREFIX = 'ss.v2.lineup.'
const SHIPPED_KEY = 'ss.v2.shipped'

function tapKey(raceId: string, seq: number): string {
  // Zero padded so the natural key sort matches crossing order.
  return `${TAP_PREFIX}${raceId}.${String(seq).padStart(4, '0')}`
}

/**
 * The hot path. Synchronous and durable on return. Never batched, never
 * debounced, never deferred to an effect.
 */
export function saveTap(raceId: string, tap: Tap): void {
  localStorage.setItem(tapKey(raceId, tap.seq), JSON.stringify(tap))
}

export function deleteTap(raceId: string, seq: number): void {
  localStorage.removeItem(tapKey(raceId, seq))
}

export function loadTaps(raceId: string): Tap[] {
  const prefix = `${TAP_PREFIX}${raceId}.`
  const taps: Tap[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      taps.push(JSON.parse(raw) as Tap)
    } catch {
      // One unreadable tap must not take down the rest of the race.
      console.warn('splitssss: could not parse', key)
    }
  }
  return taps.sort((a, b) => a.seq - b.seq)
}

export function saveRace(race: Race): void {
  localStorage.setItem(`${RACE_PREFIX}${race.id}`, JSON.stringify(race))
}

export function loadRace(raceId: string): Race | null {
  const raw = localStorage.getItem(`${RACE_PREFIX}${raceId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Race
  } catch {
    return null
  }
}

export function loadAllRaces(): Race[] {
  const races: Race[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(RACE_PREFIX)) continue
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      races.push(JSON.parse(raw) as Race)
    } catch {
      console.warn('splitssss: could not parse', key)
    }
  }
  return races.sort((a, b) => b.createdWallMs - a.createdWallMs)
}

export function setActiveRaceId(raceId: string | null): void {
  if (raceId) localStorage.setItem(ACTIVE_KEY, raceId)
  else localStorage.removeItem(ACTIVE_KEY)
}

export function getActiveRaceId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

/**
 * The team list lives on the device, not on a race, because it is the same
 * twenty eight runners all season. Each race takes a snapshot of its lineup at
 * start, so editing the list later cannot rewrite the names on a race already
 * run.
 */
export function loadRoster(): Athlete[] {
  const raw = localStorage.getItem(ROSTER_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Athlete[]) : []
  } catch {
    return []
  }
}

export function saveRoster(athletes: Athlete[]): void {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(athletes))
}

function lineupKey(raceName: string): string {
  const slug = raceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${LINEUP_PREFIX}${slug || 'race'}`
}

/**
 * Who ran the last race by this name, remembered by name rather than by race, so
 * the varsity seven the coach picked on Tuesday are still the varsity seven at
 * Saturday's meet. Null means nobody has chosen yet, which is not the same as
 * choosing nobody.
 */
export function loadLineup(raceName: string): string[] | null {
  const raw = localStorage.getItem(lineupKey(raceName))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

export function saveLineup(raceName: string, ids: string[]): void {
  localStorage.setItem(lineupKey(raceName), JSON.stringify(ids))
}

/**
 * The shipped team list this phone has already seen, as its own names joined by
 * newlines. Not the roster: this is only how the app tells "the build brought a
 * new list" from "the build brought the same list again", so a rebuild does not
 * pester somebody who has already loaded it or edited it by hand.
 */
export function loadShippedSeen(): string | null {
  return localStorage.getItem(SHIPPED_KEY)
}

export function saveShippedSeen(text: string): void {
  localStorage.setItem(SHIPPED_KEY, text)
}

/**
 * A race, a crossing, and the pointer at the race being timed, in any schema
 * version this app has ever written. Matched by shape rather than by the current
 * version so an older build's races are erased too, and narrowly enough that a
 * key belonging to something else on the origin is never touched.
 */
const RACE_KEY = /^ss\.[^.]+\.(?:race|tap)\./
const ACTIVE_ANY = /^ss\.[^.]+\.active$/

export function storedCounts(): { races: number; taps: number; roster: number } {
  let races = 0
  let taps = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(RACE_PREFIX)) races += 1
    else if (key?.startsWith(TAP_PREFIX)) taps += 1
  }
  return { races, taps, roster: loadRoster().length }
}

/**
 * Erases the races and every crossing in them, and nothing else.
 *
 * The team list stays, along with the lineups remembered under each race name
 * and the record of which shipped list this phone has seen. Clearing last week's
 * meet is not a request to retype the team, and the runners are the part with no
 * copy on the device to rebuild from. A runner leaves the list one at a time,
 * from the roster screen, which is where a change to the team belongs.
 *
 * Keys are collected before any removal, because removing while walking the
 * index shifts the keys that have not been visited yet.
 */
export function clearRaces(): number {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (RACE_KEY.test(key) || ACTIVE_ANY.test(key))) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
  return keys.length
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}
