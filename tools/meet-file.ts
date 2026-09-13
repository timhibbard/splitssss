/**
 * Builds the meet results that ship with the app, so the coach page and the
 * athlete page open with no signal and nothing to fetch from anywhere.
 *
 *   npm run meet-file -- meets/yellow-jacket.txt
 *
 * The input is one runner per line, tab separated, full names, with the marks in
 * course order and that runner's 5K best from *before* this meet at the end:
 *
 *   # meet Yellow Jacket Invitational
 *   # date 2026-09-12
 *   Rowan Hayes   Varsity  2:53.3  5:52.9  12:04.6  15:58.2  19:08.66  18:42.53
 *   Marlowe Holloway  JV   -       7:54.4  16:54.8  -        27:04.84  27:31.02
 *
 * A dash is no volunteer at that marker. A trailing `~` marks a value worked out
 * from the marks either side of it rather than timed, which is the one thing a
 * results table must never lose track of.
 *
 * Writes `public/<name>.dat`, which **is** meant to be committed. The input is
 * not: /meets/ is gitignored, exactly like roster*.txt.
 *
 * What gets written is the short form the tap buttons already say, "Rowan H.",
 * and it is scrambled rather than encrypted. Same tradeoff as the team file and
 * the same reasoning, which is written out in full in src/lib/teamfile.ts:
 * automatic beats secret for a page that has to open from a texted link, and
 * finish times are already published next to full names on the meet's own
 * results page. The splits are not published anywhere, which is why they travel
 * attached to a first name and an initial.
 *
 * Everything derived — mile splits, nets, the 3 mile mark, fastest and slowest,
 * the Delta — is computed by the app from these marks and never stored. One
 * source of truth, so a hand-edited spreadsheet cell cannot disagree with the
 * page. The whole derived table gets printed here for exactly that reason: it is
 * the only chance to compare it against the sheet before it ships.
 */
import { basename, extname } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { formatElapsed, formatPr, formatSignedElapsed } from '../src/lib/clock.ts'
import { kickAllowance, type Mark, meetRows, meetText, parseMeet } from '../src/lib/meet.ts'
import { scrambleMeet, unscrambleMeet } from '../src/lib/meetfile.ts'
import { shortNames } from '../src/lib/names.ts'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run meet-file -- meets/yellow-jacket.txt')
  process.exit(1)
}

const source = parseMeet(readFileSync(file, 'utf8'))
if (source.runners.length === 0) {
  console.error(`No runners found in ${file}. One per line, tab separated.`)
  process.exit(1)
}
if (source.name === '' || source.date === '') {
  console.error(`${file} needs a "# meet <name>" line and a "# date <yyyy-mm-dd>" line.`)
  process.exit(1)
}

// Two labels that read the same would be two rows in a dropdown a runner cannot
// tell apart, and she would read somebody else's race as her own. shortNames
// grows a letter until they differ, so a clash surviving it is a bug in it rather
// than something to paper over here.
const labels = shortNames(source.runners.map((r) => r.label))
const clash = labels.find((label, i) => labels.indexOf(label) !== i)
if (clash) {
  console.error(`Two runners would both read "${clash}". Nothing was written.`)
  process.exit(1)
}

const missingFinish = source.runners.filter((r) => r.finish == null).map((r) => r.label)
if (missingFinish.length > 0) {
  console.error(`No finish time for ${missingFinish.join(', ')}.`)
  console.error('Every derived number is anchored on the finish, so a row without one is blank.')
  process.exit(1)
}

const meet = { ...source, runners: source.runners.map((r, i) => ({ ...r, label: labels[i] })) }

const OUT = `public/${basename(file, extname(file))}.dat`
writeFileSync(OUT, `${scrambleMeet(meet)}\n`)

// Read it back through the same path the app uses, so a bad write is caught here
// rather than by an athlete who cannot find her name.
const back = unscrambleMeet(readFileSync(OUT, 'utf8'))
if (back == null || meetText(back) !== meetText(meet)) {
  console.error(`${OUT} did not read back as the same meet. Do not publish it.`)
  process.exit(1)
}

/* ---------- what shipped, for checking against the sheet ---------- */

const rows = meetRows(meet)
const allowance = kickAllowance(meet.runners)

const soft = (mark: Mark, i: number) => (rows[i].observed.derived.includes(mark) ? '~' : ' ')
const cell = (ms: number | undefined, wide = 8) => (ms == null ? '' : formatElapsed(ms)).padStart(wide)
const signed = (ms: number | undefined) => (ms == null ? '' : formatSignedElapsed(ms)).padStart(8)

console.error(`${meet.name}, ${meet.date}: ${rows.length} runners`)
console.error('')
console.error(
  ['runner'.padEnd(14), '  0.5mi', '  mile1', '   2mi', ' mile2', '   net', '  2.6mi', '  3mi*', ' mile3', '   net', ' last800', '  finish', '  vs best']
    .join(''),
)
rows.forEach((r, i) => {
  console.error(
    [
      r.observed.label.padEnd(14),
      cell(r.observed.half),
      cell(r.observed.mile1) + soft('mile1', i),
      cell(r.observed.twoMile),
      cell(r.mile2Split),
      signed(r.net1),
      cell(r.observed.mile26),
      cell(r.threeMile),
      cell(r.mile3Split),
      signed(r.net2),
      cell(r.last800),
      (r.observed.finish == null ? '' : formatPr(r.observed.finish)).padStart(10),
      (r.vsBest == null ? '' : formatSignedElapsed(r.vsBest)).padStart(10),
      r.best ? '  best' : '',
    ].join(''),
  )
})

const bests = rows.filter((r) => r.best).length
const estimates = rows.filter((r) => r.observed.derived.length > 0)
console.error('')
console.error(`* 3 mile is interpolated for everyone. Nobody stood at 3 miles.`)
console.error(
  `  ${rows.filter((r) => r.anchor === 'mile26').length} anchored on 2.6 mi, ` +
    `${rows.filter((r) => r.anchor === 'twoMile').length} on 2 mi.`,
)
// The number this run measured, printed because it is the one derived quantity
// that depends on the field as a whole rather than on one runner, so a course
// where it comes out wildly different is worth noticing here.
console.error(
  `  Closing kick allowance, measured from the ${
    meet.runners.filter((r) => r.mile26 != null && r.twoMile != null).length
  } runners with both anchors: ${formatSignedElapsed(allowance)}`,
)
if (estimates.length > 0) {
  console.error('')
  for (const r of estimates) {
    console.error(`  ${r.observed.label}: ${r.observed.derived.join(', ')} worked out, not timed.`)
  }
}
console.error('')
console.error(`${bests} new best time${bests === 1 ? '' : 's'}.`)
console.error('')
console.error(`Wrote ${OUT}. Read it back and the meet matches.`)
console.error('Check the table above against the sheet before committing it.')
console.error('')
console.error('This file is scrambled, not encrypted. Anyone who wants it can decode')
console.error('it, which is why it holds first names and an initial and no full names.')
console.error('')
console.error(`Commit ${OUT}. Do not commit ${file}.`)
