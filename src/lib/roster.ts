// Explicit extensions: see the note in link.ts.
import { formatPr, parsePr } from './clock.ts'
import { sniffSquad, sniffTeam } from './lineup.ts'
import { newId } from './storage.ts'
import type { Athlete, Squad, Team } from './types'

/**
 * A best time at the end of a line, after the name: "Rowan Hayes  21:34.60".
 *
 * A colon is what tells this from a bib number, and it is required. A time is
 * the only thing on a roster line that has one, and a line that ends in a bare
 * number is an entry list, not a PR.
 */
const PR_AT_END = /[\t ,]+(\d{1,3}:[0-5]\d(?:\.\d{1,2})?)$/

/**
 * Which race this runner is in, at the end of a line: "Rowan Hayes  21:34.60  JV".
 *
 * A word, so it cannot be confused with a time or a bib, and one of three
 * spellings, so it cannot be confused with a surname. No runner is named Varsity.
 *
 * A line that is nothing else matches too, which leaves no name behind and so
 * drops out: that is the header row of a spreadsheet, and "Varsity" is a button
 * nobody can tap.
 */
const SQUAD_AT_END = /(?:^|[\t ,]+)(jv|junior\s+varsity|varsity)$/i

/** How a team is written as a header, and how it is read back. */
const HEADING: Record<Team, string> = { girls: 'Girls', boys: 'Boys' }

/** How a race is written at the end of a line, and how it is read back. */
const SQUAD_LABEL: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }

/**
 * Takes the best time and the race off the end of a line, leaving the name.
 *
 * Either order, because a list is kept in a spreadsheet and a spreadsheet's
 * columns come out in whatever order they sit in. "20:17.75  Varsity" and
 * "Varsity  20:17.75" say the same thing, and the alternative is a tag ending up
 * inside a name and "Varsity" appearing on a button.
 *
 * The time is read before the trailing bib is stripped, so a time is never
 * mistaken for a bib and a bib is never mistaken for a time.
 */
function trailing(line: string): { rest: string; pr?: number; squad?: Squad } {
  let rest = line
  let pr: number | undefined
  let squad: Squad | undefined
  // At most one of each, so two passes settle it whichever order they came in.
  for (let pass = 0; pass < 2; pass++) {
    const tag = squad == null ? SQUAD_AT_END.exec(rest) : null
    if (tag) {
      squad = sniffSquad(tag[1])
      rest = rest.slice(0, tag.index)
      continue
    }
    const time = pr == null ? PR_AT_END.exec(rest) : null
    if (time) {
      pr = parsePr(time[1])
      rest = rest.slice(0, time.index)
      continue
    }
    break
  }
  return { rest, ...(pr == null ? {} : { pr }), ...(squad == null ? {} : { squad }) }
}

/**
 * Parses a list of runners, one per line, each optionally followed by that
 * runner's best time and which race they are in this week. Also the decoder for a
 * shared roster link and for the list that ships with the build, so a paste, a
 * link and a team file cannot disagree about what a line means.
 *
 * A line beginning with `#` is a heading, not a runner, and it sets the team for
 * the lines under it. "Varsity" or "JV" at the end of a line puts that runner in
 * that race:
 *
 *   # Girls
 *   Marlowe Holloway  21:34.60  Varsity
 *   Rowan Hayes       22:29.15  JV
 *
 *   # Boys
 *   Jordan Blake      17:12.40
 *
 * The race is per runner rather than a second kind of heading, because that is how
 * the coach already keeps it: a column next to the time, reordered every week.
 * Sorting 28 lines into two blocks to satisfy a file format is work the coach
 * would be doing for the app's benefit.
 *
 * Text with no headings and no races in it parses exactly as it always did, so a
 * link texted last week and a phone holding last season's paste both still work. A
 * heading naming neither team leaves the lines under it untagged rather than
 * dropping them, and an untagged runner matches any race. A runner with no race on
 * a list that gives everyone else one is on the team and in neither race, which is
 * what a scratch looks like.
 *
 * Runners are known by name and face, so there are no bib numbers to keep. A
 * pasted meet entry list often carries them anyway, so a leading or trailing
 * number is stripped rather than stored. That is the difference between pasting
 * a list unmodified and hand editing 28 lines.
 */
export function parseRoster(text: string): Athlete[] {
  const out: Athlete[] = []
  let team: Team | undefined
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim()
    if (trimmed.startsWith('#')) {
      team = sniffTeam(trimmed.slice(1))
      continue
    }
    const { rest, pr, squad } = trailing(trimmed.replace(/^\d{1,4}[,\s]+/, ''))
    const name = rest.replace(/[,\s]+\d{1,4}$/, '').trim()
    // A line with no letters in it is a leftover number or a stray comma, not a
    // runner. A name chip you cannot read is worse than a missing one.
    if (!/\p{L}/u.test(name)) continue
    out.push({
      id: newId(),
      name,
      ...(pr == null ? {} : { pr }),
      ...(team == null ? {} : { team }),
      ...(squad == null ? {} : { squad }),
    })
  }
  return out
}

/**
 * The list in groups: untagged runners first with no heading over them, then
 * each team in the order it first appears.
 *
 * One function so the text format and the roster screen group identically. The
 * untagged group leads because a list with nothing but untagged runners has to
 * come out as the plain list it went in as.
 */
export function byTeam(athletes: Athlete[]): { team?: Team; athletes: Athlete[] }[] {
  const loose = athletes.filter((a) => a.team == null)
  const groups: { team?: Team; athletes: Athlete[] }[] =
    loose.length > 0 ? [{ athletes: loose }] : []
  const seen = new Set<Team>()
  for (const a of athletes) {
    if (a.team == null || seen.has(a.team)) continue
    seen.add(a.team)
    groups.push({ team: a.team, athletes: athletes.filter((b) => b.team === a.team) })
  }
  return groups
}

/**
 * The list as text, one runner per line under a heading per team, which is what
 * every channel carries: the fragment of a shared link, the file that ships with
 * the build, and the box a coach pastes into. parseRoster reads this back, so the
 * two are one format with one set of rules rather than three that drift.
 *
 * A tab before the time and before the race, because a name can hold a space and
 * never a tab. Time then race, which is the order the parser writes back, so a
 * round trip through a file is byte for byte.
 *
 * Grouping is the one thing this does not preserve: two teams interleaved come
 * out gathered. Nothing produces that order, and the round trip through a
 * grouped list is exact.
 */
export function rosterText(athletes: Athlete[]): string {
  const line = (a: Athlete) =>
    [a.name, a.pr == null ? null : formatPr(a.pr), a.squad == null ? null : SQUAD_LABEL[a.squad]]
      .filter((part) => part != null)
      .join('\t')
  return byTeam(athletes)
    .map((group) =>
      (group.team == null ? group.athletes.map(line) : [`# ${HEADING[group.team]}`, ...group.athletes.map(line)]).join(
        '\n',
      ),
    )
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
