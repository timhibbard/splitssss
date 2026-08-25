// Explicit extension: see the note in link.ts.
import { newId } from './storage.ts'
import type { Athlete } from './types'

/**
 * Parses a list of runners, one per line. Also the decoder for a shared roster
 * link, so a paste and a link cannot disagree about what a line means.
 *
 * Runners are known by name and face, so there are no bib numbers to keep. A
 * pasted meet entry list often carries them anyway, so a leading or trailing
 * number is stripped rather than stored. That is the difference between pasting
 * a list unmodified and hand editing 28 lines.
 */
export function parseRoster(text: string): Athlete[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d{1,4}[,\s]+/, '').replace(/[,\s]+\d{1,4}$/, '').trim())
    // A line with no letters in it is a leftover number or a stray comma, not a
    // runner. A name chip you cannot read is worse than a missing one.
    .filter((name) => /\p{L}/u.test(name))
    .map((name) => ({ id: newId(), name }))
}

/**
 * Reconciles the race's athlete list with an edited roster, mid race.
 *
 * The roster wins, so a girl added at the starting line appears on the grid and
 * a scratch disappears from it. The one exception is an athlete who already
 * holds a crossing: she stays, at the end of the list, because a recorded time
 * must never lose the name attached to it.
 */
export function mergeRoster(
  raceAthletes: Athlete[],
  roster: Athlete[],
  namedIds: Set<string>,
): Athlete[] {
  const inRoster = new Set(roster.map((a) => a.id))
  const kept = raceAthletes.filter((a) => namedIds.has(a.id) && !inRoster.has(a.id))
  return [...roster, ...kept]
}
