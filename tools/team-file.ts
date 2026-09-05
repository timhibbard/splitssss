/**
 * Builds the team list that ships with the app, so a phone opens with the names
 * already on it.
 *
 *   npm run team-file -- roster.txt
 *
 * One runner per line, with that runner's 5K best after the name if there is one
 * and the race they are in this week after that, under a heading per team:
 *
 *   # Girls
 *   Rowan Hayes     21:34.60   Varsity
 *   Avery Langston  22:40.25   JV
 *
 *   # Boys
 *   Jordan Blake    17:12.40
 *
 * One file and one command for both teams, because one person keeps the times.
 * A file with no headings in it still works and ships everyone untagged, and a
 * team with no races on its lines falls back to the old rule of the fastest seven.
 *
 * The race ships because the lineup is the thing that changes every week and it is
 * the thing nobody at the course can look up. A phone that opens on Varsity Girls
 * with the eight the coach picked on Thursday needs no taps at all; one that opens
 * on the seven fastest names needs a coach standing next to it.
 *
 * Bib numbers optional and stripped. Writes public/team.dat, which **is** meant to
 * be committed. The names file is not: roster*.txt is gitignored.
 *
 * What gets written is the short form the buttons already say, "Rowan H.", not
 * the full names, and it is scrambled rather than encrypted. The app reads it with
 * nothing from a human, so the way to read it ships in the JavaScript, so anyone
 * who wants the list can have it. See src/lib/teamfile.ts for the whole argument.
 * The tradeoff was chosen on purpose: automatic beats secret for a list a meet
 * program prints anyway, and full names still need a link somebody sends.
 *
 * The best times ride along for the same reason the names do: a PR on the button
 * is no use if it only arrives with something somebody has to be sent. A 5K best
 * is already public next to a full name on the meet's own results page, so next
 * to a first name and an initial it says less than the results already do.
 *
 * Two names that would abbreviate the same way grow a letter until they do not,
 * because two identical buttons is a split on the wrong runner. That is the same
 * function the app uses, so what this writes is what a volunteer will read.
 *
 * Within a team, not across both. The two teams never race at once, so a girls
 * "Avery L." and a boys "Avery L." can never be two buttons on one screen, and
 * making each grow a letter would cost both of them a label the team actually
 * says out loud to resolve a clash nobody can see.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { formatPr } from '../src/lib/clock.ts'
import { varsitySize } from '../src/lib/lineup.ts'
import { shortNames } from '../src/lib/names.ts'
import { byTeam, parseRoster, rosterText } from '../src/lib/roster.ts'
import { scrambleTeam, TEAM_FILE, unscrambleTeam } from '../src/lib/teamfile.ts'
import type { Squad } from '../src/lib/types.ts'

const OUT = `public/${TEAM_FILE}`

/** How a race reads in the printout. */
const SAYS: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run team-file -- roster.txt')
  process.exit(1)
}

const athletes = parseRoster(readFileSync(file, 'utf8'))
if (athletes.length === 0) {
  console.error(`No names found in ${file}. One runner per line.`)
  process.exit(1)
}

const groups = byTeam(athletes)

// Per team, since two labels that read the same are only a problem on one screen
// and the two teams never share one. Uniqueness within a team is what shortNames
// promises, so a clash there is a bug in it rather than something to paper over
// at the last moment.
const labels = new Map<string, string>()
for (const group of groups) {
  const short = shortNames(group.athletes.map((a) => a.name))
  const clash = short.find((label, i) => short.indexOf(label) !== i)
  if (clash) {
    console.error(`Two runners would both read "${clash}". Nothing was written.`)
    process.exit(1)
  }
  group.athletes.forEach((a, i) => labels.set(a.id, short[i]))
}

// The label instead of the name, and the best time as it was given. Same format
// the app parses everywhere else, so this file needs no rules of its own.
const shipped = athletes.map((a) => ({ ...a, name: labels.get(a.id) ?? a.name }))
const lines = rosterText(shipped).split('\n')

const body = scrambleTeam(lines)
writeFileSync(OUT, `${body}\n`)

// Read it back through the same path the app uses, so a bad write is caught here
// rather than by a volunteer at the starting line.
const back = unscrambleTeam(readFileSync(OUT, 'utf8'))
if (back == null || rosterText(back) !== rosterText(shipped)) {
  console.error(`${OUT} did not read back as the same list. Do not publish it.`)
  process.exit(1)
}

const plural = shipped.length === 1 ? 'runner' : 'runners'
const missing = shipped.filter((a) => a.pr == null).length
console.error(`${shipped.length} ${plural}, in the order they will appear:`)
// A team at a time, because each team's races are drawn in its own list and a rule
// after the seventh name of the combined list would be a lie about one of them.
for (const group of byTeam(shipped)) {
  if (group.team != null) console.error(`\n  ${group.team}, ${group.athletes.length}:`)
  // The race per runner when the list says, so what is echoed back is the coach's
  // own assignment and a line typed into the wrong column is visible here rather
  // than at the starting line. A list that says nothing gets the fallback rule
  // drawn instead, at that team's varsity number: the girls' seven, or all of the
  // boys, since their list is the varsity squad.
  const said = group.athletes.some((a) => a.squad != null)
  const line = varsitySize(group.athletes, group.team)
  const wide = Math.max(...group.athletes.map((a) => a.name.length))
  console.error(
    group.athletes
      .map((a, i) => {
        const pr = a.pr == null ? 'no best time' : formatPr(a.pr)
        const mark = said
          ? `  ${a.squad == null ? 'no race, so in neither' : SAYS[a.squad]}`
          : i === line - 1 && line < group.athletes.length
            ? `   <- varsity ends here, ${line} of ${group.athletes.length}`
            : ''
        return `  ${`${i + 1}.`.padStart(4)} ${a.name.padEnd(wide)}  ${pr}${mark}`
      })
      .join('\n'),
  )
  if (said) {
    const count = (squad: Squad) => group.athletes.filter((a) => a.squad === squad).length
    const neither = group.athletes.length - count('varsity') - count('jv')
    console.error(
      `       ${count('varsity')} varsity, ${count('jv')} JV${
        neither > 0 ? `, ${neither} in neither race` : ''
      }`,
    )
  }
}
if (missing > 0) {
  console.error('')
  console.error(`${missing} with no best time. Those buttons show a name and nothing else,`)
  console.error('and their splits get no comparison. Add "  21:34.60" after a name to fix that.')
}
console.error('')
console.error(`Wrote ${OUT}. Read it back and the list matches.`)
console.error('Every phone that loads the app gets these names, with nothing to type.')
console.error('')
console.error('This file is scrambled, not encrypted. Anyone who wants the list can')
console.error('decode it, which is why it holds first names and an initial and not')
console.error('full names. Full names travel only in a link you send yourself.')
console.error('')
console.error(`Commit ${OUT}. Do not commit ${file}.`)
