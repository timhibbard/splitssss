/**
 * Builds the team list that ships with the app, so a phone opens with the names
 * already on it.
 *
 *   npm run team-file -- roster.txt
 *
 * One runner per line, bib numbers optional and stripped. Writes public/team.dat,
 * which **is** meant to be committed. The names file is not: roster*.txt is
 * gitignored.
 *
 * What gets written is the short form the buttons already say, "Caroline K.", not
 * the full names, and it is scrambled rather than encrypted. The app reads it with
 * nothing from a human, so the way to read it ships in the JavaScript, so anyone
 * who wants the list can have it. See src/lib/teamfile.ts for the whole argument.
 * The tradeoff was chosen on purpose: automatic beats secret for a list a meet
 * program prints anyway, and full names still need a link or a passphrase.
 *
 * Two names that would abbreviate the same way grow a letter until they do not,
 * because two identical buttons is a split on the wrong runner. That is the same
 * function the app uses, so what this writes is what a volunteer will read.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { shortNames } from '../src/lib/names.ts'
import { parseRoster } from '../src/lib/roster.ts'
import { scrambleTeam, TEAM_FILE, unscrambleTeam } from '../src/lib/teamfile.ts'

const OUT = `public/${TEAM_FILE}`

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

const labels = shortNames(athletes.map((a) => a.name))

// Uniqueness is what shortNames promises, so a clash here is a bug in it rather
// than something to paper over at the last moment.
const clash = labels.find((label, i) => labels.indexOf(label) !== i)
if (clash) {
  console.error(`Two runners would both read "${clash}". Nothing was written.`)
  process.exit(1)
}

const body = scrambleTeam(labels)
writeFileSync(OUT, `${body}\n`)

// Read it back through the same path the app uses, so a bad write is caught here
// rather than by a volunteer at the starting line.
const back = unscrambleTeam(readFileSync(OUT, 'utf8'))
if (back?.map((a) => a.name).join('\n') !== labels.join('\n')) {
  console.error(`${OUT} did not read back as the same list. Do not publish it.`)
  process.exit(1)
}

const plural = labels.length === 1 ? 'runner' : 'runners'
console.error(`${labels.length} ${plural}, in the order they will appear:`)
console.error(labels.map((label, i) => `  ${i + 1}. ${label}${i === 6 ? '   <- varsity seven end here' : ''}`).join('\n'))
console.error('')
console.error(`Wrote ${OUT}. Read it back and the list matches.`)
console.error('Every phone that loads the app gets these names, with nothing to type.')
console.error('')
console.error('This file is scrambled, not encrypted. Anyone who wants the list can')
console.error('decode it, which is why it holds first names and an initial and not')
console.error('full names. Full names go by link or by roster.enc.')
console.error('')
console.error(`Commit ${OUT}. Do not commit ${file}.`)
