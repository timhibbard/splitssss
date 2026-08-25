import type { Race, Tap } from './types'

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

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}
