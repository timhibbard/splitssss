/**
 * Builds a season's PRs and season bests for the coach page.
 *
 *   npm run bests-file -- bests.txt girls 2026
 *
 * The coach's list as it comes out of the spreadsheet, one runner per line, full
 * name, PR and season best, tab separated. A header row, or any line without a
 * time on it, is skipped:
 *
 *   Athlete       PR        SB
 *   Rowan Hayes   21:34.60  21:46.00
 *
 * The times are shipped as given. Each name becomes the label the team list
 * gives it, and a name the team list does not have stops the build, because a
 * line under a label nobody else uses is a number the coach page cannot put
 * beside anything.
 *
 * Writes public/meets/<year>/<team>/bests.dat, which is meant to be committed.
 * The list itself is not: bests*.txt is gitignored, like the roster.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { formatPr, parsePr } from '../src/lib/clock.ts'
import { type Best, bestsFilePath, bestsText, scrambleBests, unscrambleBests } from '../src/lib/bestsfile.ts'
import { shortNames } from '../src/lib/names.ts'
import { unscrambleTeam } from '../src/lib/teamfile.ts'
import type { Team } from '../src/lib/types.ts'

const [file, team, year] = process.argv.slice(2)
if (!file || (team !== 'girls' && team !== 'boys') || !/^\d{4}$/.test(year ?? '')) {
  console.error('Usage: npm run bests-file -- bests.txt girls 2026')
  process.exit(1)
}

const TIME = /^\d{1,3}:[0-5]\d(?:\.\d{1,2})?$/
const rows = readFileSync(file, 'utf8')
  .split('\n')
  .map((line) => line.split('\t').map((c) => c.trim()))
  .filter((cells) => cells.length >= 3 && cells[0] !== '' && (TIME.test(cells[1]) || TIME.test(cells[2])))
if (rows.length === 0) {
  console.error(`No runners found in ${file}. Name, PR and season best, tab separated.`)
  process.exit(1)
}

const labels = shortNames(rows.map((r) => r[0]))
// The label has to be one the shipped team list already says, so the coach page
// and every other page are talking about the same runner.
const shipped = new Set(
  (unscrambleTeam(readFileSync('public/team.dat', 'utf8')) ?? [])
    .filter((a) => a.team == null || a.team === (team as Team))
    .map((a) => a.name),
)
const unknown = labels.filter((l) => !shipped.has(l))
if (unknown.length > 0) {
  console.error(`Not on the team list as ${unknown.join(', ')}. Nothing was written.`)
  console.error('Rebuild the team list first, or fix the name, and run this again.')
  process.exit(1)
}

const bests: Best[] = rows.map((cells, i) => {
  const best: Best = { label: labels[i] }
  const pr = TIME.test(cells[1]) ? parsePr(cells[1]) : undefined
  const sb = TIME.test(cells[2]) ? parsePr(cells[2]) : undefined
  if (pr != null) best.pr = pr
  if (sb != null) best.sb = sb
  return best
})

const out = `public/${bestsFilePath({ year: Number(year), team: team as Team })}`
writeFileSync(out, `${scrambleBests(bests)}\n`)

const back = unscrambleBests(readFileSync(out, 'utf8'))
if (back == null || bestsText(back) !== bestsText(bests)) {
  console.error(`${out} did not read back as the same list. Do not publish it.`)
  process.exit(1)
}

const wide = Math.max(...bests.map((b) => b.label.length))
console.error(`${bests.length} runners, ${team} ${year}:`)
for (const b of bests) {
  const cell = (ms?: number) => (ms == null ? '-' : formatPr(ms)).padStart(9)
  // Flagged and not refused: a season best faster than a PR is a typo in one of
  // the two columns, but which one is the coach's to say.
  const odd = b.pr != null && b.sb != null && b.sb < b.pr ? '   season best is faster than the PR' : ''
  console.error(`  ${b.label.padEnd(wide)}  ${cell(b.pr)}  ${cell(b.sb)}${odd}`)
}
console.error('')
console.error(`Wrote ${out}. Read it back and the list matches.`)
console.error(`Commit ${out}. Do not commit ${file}.`)
