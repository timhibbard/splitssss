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
 * Reconciles the runners in a race with an edited team list, mid race.
 *
 * The race holds a lineup, not the whole team, so an edit to the team list must
 * not quietly put back somebody who was left out of this race. The rules, in the
 * order they matter:
 *
 * - A runner added to the team joins the race, because adding a name at the
 *   starting line is how a late entry gets a button.
 * - A runner taken off the team leaves the race, unless a crossing is already
 *   recorded under that name, in which case the name stays at the end of the
 *   list. A recorded time must never lose the name attached to it.
 * - Everyone else keeps whatever the lineup said, with the team's spelling.
 */
export function mergeLineup(
  raceAthletes: Athlete[],
  wasOnTeam: Athlete[],
  team: Athlete[],
  namedIds: Set<string>,
): Athlete[] {
  const before = new Set(wasOnTeam.map((a) => a.id))
  const inRace = new Set(raceAthletes.map((a) => a.id))
  const onTeam = new Set(team.map((a) => a.id))
  const fromTeam = team.filter((a) => inRace.has(a.id) || !before.has(a.id))
  // Names the race has of its own: typed in during the race, or taken off the
  // team since. Only the ones holding a time are worth a button.
  const own = raceAthletes.filter((a) => !onTeam.has(a.id) && namedIds.has(a.id))
  return [...fromTeam, ...own]
}
