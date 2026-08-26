// Explicit extensions: see the note in link.ts.
import { formatPr, parsePr } from './clock.ts'
import { newId } from './storage.ts'
import type { Athlete } from './types'

/**
 * A best time at the end of a line, after the name: "Rowan Hayes  21:34.60".
 *
 * A colon is what tells this from a bib number, and it is required. A time is
 * the only thing on a roster line that has one, and a line that ends in a bare
 * number is an entry list, not a PR.
 */
const PR_AT_END = /[\t ,]+(\d{1,3}:[0-5]\d(?:\.\d{1,2})?)$/

/**
 * Parses a list of runners, one per line, each optionally followed by that
 * runner's best time. Also the decoder for a shared roster link, the encrypted
 * roster and the list that ships with the build, so a paste, a link, a vault and
 * a team file cannot disagree about what a line means.
 *
 * Runners are known by name and face, so there are no bib numbers to keep. A
 * pasted meet entry list often carries them anyway, so a leading or trailing
 * number is stripped rather than stored. That is the difference between pasting
 * a list unmodified and hand editing 28 lines.
 *
 * The PR is read off the end of the line before the trailing number is stripped,
 * so a time is never mistaken for a bib and a bib is never mistaken for a time.
 */
export function parseRoster(text: string): Athlete[] {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^\d{1,4}[,\s]+/, ''))
    .map((line) => {
      const found = PR_AT_END.exec(line)
      const name = (found ? line.slice(0, found.index) : line)
        .replace(/[,\s]+\d{1,4}$/, '')
        .trim()
      return { name, pr: found ? parsePr(found[1]) : undefined }
    })
    // A line with no letters in it is a leftover number or a stray comma, not a
    // runner. A name chip you cannot read is worse than a missing one.
    .filter(({ name }) => /\p{L}/u.test(name))
    .map(({ name, pr }) => ({ id: newId(), name, ...(pr == null ? {} : { pr }) }))
}

/**
 * The list as text, one runner per line, which is what every channel carries:
 * the fragment of a shared link, the encrypted roster, the file that ships with
 * the build, and the box a coach pastes into. parseRoster reads this back, so the
 * two are one format with one set of rules rather than four that drift.
 *
 * A tab before the time, because a name can hold a space and never a tab.
 */
export function rosterText(athletes: Athlete[]): string {
  return athletes
    .map((a) => (a.pr == null ? a.name : `${a.name}\t${formatPr(a.pr)}`))
    .join('\n')
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
