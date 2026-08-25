// Explicit extension: see the note in link.ts.
import { newId } from './storage.ts'
import type { Athlete } from './types'

/**
 * Parses a list of runners, one per line. Accepts "Name", "12 Name", "Name, 12"
 * and "Name 12", so a coach can paste whatever the meet entry list gave them
 * without reformatting. Also the decoder for a shared roster link, so both paths
 * agree on what a line means.
 */
export function parseRoster(text: string): Athlete[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const leadingBib = /^(\d{1,4})\s+(.*)$/.exec(line)
      if (leadingBib) return { id: newId(), name: leadingBib[2].trim(), bib: leadingBib[1] }

      const trailingBib = /^(.*?)[,\s]+(\d{1,4})$/.exec(line)
      if (trailingBib) return { id: newId(), name: trailingBib[1].trim(), bib: trailingBib[2] }

      return { id: newId(), name: line }
    })
    .filter((a) => a.name.length > 0)
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
