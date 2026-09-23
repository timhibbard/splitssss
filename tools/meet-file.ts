/**
 * Builds the meet results that ship with the app, so the coach page and the
 * athlete page open with no signal and nothing to fetch from anywhere.
 *
 *   npm run meet-file -- meets/yellow-jacket.txt
 *
 * The input is the format parseMeet reads, in src/lib/meet.ts, with full names:
 * the meet's headings, then one block per event declaring its own markers, then
 * one runner per line with a cell per marker, the finish, and that runner's 5K PR
 * from *before* this meet:
 *
 *   # meet Yellow Jacket Invitational
 *   # date 2026-09-12
 *   # team girls
 *
 *   # event Varsity
 *   # marks 0.5mi 1mi 2mi 2.6mi
 *   Rowan Hayes       2:53.3  5:52.9  12:04.6  15:58.2  19:08.66  18:42.53
 *
 *   # event JV
 *   # marks 1mi 2mi
 *   Marlowe Holloway  7:54.4  16:54.8  27:04.84  27:31.02
 *
 * A dash is the volunteer at that marker missing that runner, and a dash for the
 * finish is a runner with no finish time: her marks ship, nothing is derived for
 * her, and this says whose it was rather than refusing twenty reconciled races
 * over one DNF. A trailing `~` marks a value calculated from the marks either side
 * of it rather than timed, which is the one thing a results table must never lose
 * track of. A row of the wrong width for its event is refused, with the line
 * number, and nothing is written.
 *
 * Name the file for the meet and the team, `meets/rockingham-girls.txt`. The
 * `-girls` comes off for the slug, so both teams' files for one meet publish side
 * by side under their own team.
 *
 * On the way out it lists this file's labels against every other file for the same
 * team and season: who is new, who raced before and is not here, and any pair with
 * the same first name that might be one runner whose label drifted.
 *
 * Writes `public/meets/<year>/<team>/<slug>.dat`, which **is** meant to be committed. The
 * input is not: /meets/ is gitignored, exactly like roster*.txt. The year comes off
 * the meet's own date line, the team off its team line and the slug off the input
 * file's name, so the data file and the page's address are derived from the source
 * rather than typed twice.
 *
 * Writing the file is half of publishing a meet. The other half is the line in
 * PUBLISHED in src/lib/pages.ts, which is what gives the meet an address and what
 * makes the build write an actual page there. This prints the line to add.
 *
 * What gets written is the short form the tap buttons already say, "Rowan H.",
 * and it is scrambled rather than encrypted. Same tradeoff as the team file and
 * the same reasoning, which is written out in full in src/lib/teamfile.ts:
 * automatic beats secret for a page that has to open from a texted link, and
 * finish times are already published next to full names on the meet's own
 * results page. The splits are not published anywhere, which is why they travel
 * attached to a first name and an initial.
 *
 * Everything derived — whole miles, nets, segment paces, fastest and slowest,
 * the Delta — is computed by the app from these marks and never stored. One
 * source of truth, so a hand-edited spreadsheet cell cannot disagree with the
 * page. The whole derived table gets printed here for exactly that reason: it is
 * the only chance to compare it against the sheet before it ships.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { formatElapsed, formatPr, formatSignedElapsed } from '../src/lib/clock.ts'
import { anchorLabel, kickAllowances, type Meet, meetRows, meetText, mileage, parseMeet } from '../src/lib/meet.ts'
import { scrambleMeet, unscrambleMeet } from '../src/lib/meetfile.ts'
import { meetFilePath, PUBLISHED, seasonCoachPath, seasonPath } from '../src/lib/pages.ts'
import { shortNames } from '../src/lib/names.ts'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run meet-file -- meets/rockingham-girls.txt')
  process.exit(1)
}

let source: Meet
try {
  source = parseMeet(readFileSync(file, 'utf8'))
} catch (err) {
  console.error(`${file}, ${(err as Error).message}`)
  console.error('Nothing was written.')
  process.exit(1)
}
const everyone = source.events.flatMap((e) => e.runners)
if (everyone.length === 0) {
  console.error(`No runners found in ${file}. One per line, tab separated, under an "# event" line.`)
  process.exit(1)
}

// Two labels that read the same would be two rows in a dropdown a runner cannot
// tell apart, and she would read somebody else's race as her own. shortNames
// grows a letter until they differ, so a clash surviving it is a bug in it rather
// than something to paper over here. Across the whole file, since the athlete
// page's picker is.
const labels = shortNames(everyone.map((r) => r.label))
const clash = labels.find((label, i) => labels.indexOf(label) !== i)
if (clash) {
  console.error(`Two runners would both read "${clash}". Nothing was written.`)
  process.exit(1)
}

/**
 * The slug comes from the input file's name, with a trailing `-girls` or `-boys`
 * taken off, so `rockingham-girls.txt` and `rockingham-boys.txt` are the same meet
 * for two teams and publish side by side. A suffix that disagrees with the file's
 * own team line is a file about to be published under the wrong team, so it is
 * refused rather than believed either way.
 */
const stem = basename(file, extname(file))
const suffix = /-(girls|boys)$/.exec(stem)?.[1]
if (suffix && suffix !== source.team) {
  console.error(`${file} is named for the ${suffix} but says "# team ${source.team}". Nothing was written.`)
  process.exit(1)
}
const slug = suffix ? stem.slice(0, -(suffix.length + 1)) : stem
// The slug is a directory name in a URL, and a season's own pages sit beside it.
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || ['girls', 'boys', 'coach'].includes(slug)) {
  console.error(`"${slug}" cannot be a meet's address. Name the file like rockingham-girls.txt. Nothing was written.`)
  process.exit(1)
}

const short = new Map(everyone.map((r, i) => [r, labels[i]]))
const meet: Meet = {
  ...source,
  events: source.events.map((e) => ({
    ...e,
    runners: e.runners.map((r) => ({ ...r, label: short.get(r)! })),
  })),
}

/**
 * The year comes off the meet's own date, so the address and the data file are
 * both derived from the source rather than typed twice. Under `public/` at exactly
 * the path the app will ask for.
 */
const year = Number(meet.date.slice(0, 4))
const published = { slug, year, team: meet.team, date: meet.date, name: meet.name }
const OUT = `public/${meetFilePath(published)}`

// Read back through the same path the app uses, once before anything is written and
// once off the disk after, so a bad file is caught here rather than by an athlete
// who cannot find her name. A file that fails the second is removed, not left.
const body = `${scrambleMeet(meet)}\n`
const roundTrips = (text: string) => {
  const back = unscrambleMeet(text)
  return back != null && meetText(back) === meetText(meet)
}
if (!roundTrips(body)) {
  console.error('The meet did not read back as itself. Nothing was written.')
  process.exit(1)
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, body)
if (!roundTrips(readFileSync(OUT, 'utf8'))) {
  rmSync(OUT)
  console.error(`${OUT} did not read back as the same meet off the disk, so it was removed.`)
  process.exit(1)
}

/* ---------- what shipped, for checking against the sheet ---------- */

const cell = (ms: number | null | undefined, wide = 9) => (ms == null ? '' : formatElapsed(ms)).padStart(wide)
const signed = (ms: number | undefined) => (ms == null ? '' : formatSignedElapsed(ms)).padStart(9)

console.error(`${meet.name}, ${meet.date}, ${meet.team}: ${everyone.length} runners`)
let bests = 0
for (const { event, rows } of meetRows(meet)) {
  console.error('')
  console.error(`${event.squad === 'jv' ? 'JV' : 'Varsity'}, ${event.distance} m, marks at ${event.markers.map((m) => m.label).join(', ')}`)
  const miles = Math.max(0, ...rows.map((r) => r.miles.length))
  console.error(
    [
      'runner'.padEnd(14),
      ...event.markers.map((m) => m.label.padStart(9)),
      ...Array.from({ length: miles }, (_, i) => [`mile ${i + 1}`.padStart(9), 'net'.padStart(9)]).flat(),
      'closing'.padStart(9),
      'finish'.padStart(10),
      'vs PR'.padStart(10),
    ].join(''),
  )
  for (const r of rows) {
    console.error(
      [
        r.observed.label.padEnd(14),
        ...r.observed.times.map((t, i) => cell(t, 8) + (r.observed.derived.includes(i) ? '~' : ' ')),
        ...Array.from({ length: miles }, (_, i) => {
          const m = r.miles[i]
          return [cell(m?.split, 8) + (m && !m.timed ? '*' : ' '), signed(m?.net)]
        }).flat(),
        cell(r.closing?.time),
        (r.observed.finish == null ? '' : formatPr(r.observed.finish)).padStart(10),
        (r.vsBest == null ? '' : formatSignedElapsed(r.vsBest)).padStart(10),
        r.best ? '  new PR' : '',
      ].join(''),
    )
  }
  bests += rows.filter((r) => r.best).length

  console.error('')
  console.error('* interpolated, because nobody stood at that mile for that runner:')
  for (let i = 0; i < miles; i++) {
    const from = new Map<string, number>()
    for (const r of rows) {
      const m = r.miles[i]
      if (!m?.between) continue
      const key = m.between.map((a) => anchorLabel(event, a)).join(' to ')
      from.set(key, (from.get(key) ?? 0) + 1)
    }
    for (const [key, n] of from) console.error(`  mile ${i + 1}: ${n} off ${key}`)
  }
  const closing = rows.find((r) => r.closing)?.closing
  if (closing) console.error(`  Closing is the last marker to the line, ${mileage(closing.meters)}.`)
  for (const r of rows.filter((r) => r.observed.derived.length > 0)) {
    const which = r.observed.derived.map((i) => event.markers[i].label).join(', ')
    console.error(`  ${r.observed.label}: ${which} calculated, not timed.`)
  }
}

// The numbers this run measured, printed because they are the derived quantities
// that depend on the field as a whole rather than on one runner, so a course where
// one comes out wildly different is worth noticing here.
const allowances = kickAllowances(meet)
if (allowances.length > 0) {
  console.error('')
  for (const a of allowances) {
    const span = (pair: [number, number]) => pair.map((m) => (m >= a.distance ? 'finish' : mileage(m))).join(' to ')
    console.error(
      `Mile ${a.mile} off ${span(a.from)} is corrected onto ${span(a.onto)} by ${formatSignedElapsed(a.ms)}, ` +
        `measured from ${a.calibrators} runner${a.calibrators === 1 ? '' : 's'} with both.`,
    )
  }
}

const unfinished = everyone.filter((r) => r.finish == null).map((r) => short.get(r)!)
if (unfinished.length > 0) {
  console.error('')
  // Labels end in an initial's period already, so the sentence does not add one.
  const list = unfinished.join(', ')
  console.error(`No finish time for ${list}${list.endsWith('.') ? '' : '.'}`)
  console.error('Their marks ship and nothing is derived for them. If that is a missing')
  console.error('time rather than a DNF, fix the source and run this again.')
}

/*
 * Labels against the rest of the season. shortNames only knows about this file, so
 * adding one runner can grow somebody else's label a letter ("Emma L." becoming
 * "Emma La.") and her season quietly splits into two people. A new runner and a
 * drifted label look the same to the code and are obvious to whoever reads this.
 */
const seasonDir = dirname(OUT)
const others = readdirSync(seasonDir)
  .filter((f) => f.endsWith('.dat') && f !== `${slug}.dat`)
  .flatMap((f) => {
    const other = unscrambleMeet(readFileSync(join(seasonDir, f), 'utf8'))
    return other ? [other] : []
  })
console.error('')
if (others.length === 0) {
  console.error(`First ${meet.team} meet of ${year} on disk, so there are no other labels to check against.`)
} else {
  const labelsOf = (m: Meet) => new Set(m.events.flatMap((e) => e.runners.map((r) => r.label)))
  const here = labelsOf(meet)
  const before = new Map<string, string>()
  for (const other of others) for (const label of labelsOf(other)) if (!before.has(label)) before.set(label, other.name)
  const fresh = [...here].filter((l) => !before.has(l)).sort()
  const absent = [...before.keys()].filter((l) => !here.has(l)).sort()
  const first = (l: string) => l.split(' ')[0]
  console.error(`Labels against the other ${others.length} ${meet.team} meet${others.length === 1 ? '' : 's'} of ${year}:`)
  console.error(`  First time this season: ${fresh.length > 0 ? fresh.join(', ') : 'nobody'}`)
  console.error(`  Raced before, not here: ${absent.length > 0 ? absent.join(', ') : 'nobody'}`)
  for (const l of fresh) {
    for (const a of absent.filter((a) => first(a) === first(l))) {
      console.error(`  Same runner? "${l}" here and "${a}" at ${before.get(a)}. If so, the labels have drifted.`)
    }
  }
}

console.error('')
console.error(`${bests} new PR${bests === 1 ? '' : 's'}.`)
console.error('')
console.error(`Wrote ${OUT}. Read it back and the meet matches.`)
console.error('Check the tables above against the sheet before committing it.')
console.error('')
console.error('This file is scrambled, not encrypted. Anyone who wants it can decode')
console.error('it, which is why it holds first names and an initial and no full names.')
console.error('')
console.error(`Commit ${OUT}. Do not commit ${file}.`)

// The address is the other half. Without the line in PUBLISHED this file ships and
// nothing can reach it, which is a failure with no error message anywhere.
const listed = PUBLISHED.find((m) => m.slug === slug && m.year === year && m.team === meet.team)
if (listed) {
  console.error('')
  console.error(`Its season's pages are ${seasonPath(published)} and ${seasonCoachPath(published)}`)
} else {
  console.error('')
  console.error('This meet has no address yet. Add it to PUBLISHED in src/lib/pages.ts:')
  console.error('')
  console.error(
    `  { slug: '${slug}', year: ${year}, team: '${meet.team}', date: '${meet.date}', name: ${JSON.stringify(meet.name)} },`,
  )
  console.error('')
  console.error('The build writes a real page for each line in that list. Without one,')
  console.error('this file ships and no URL reaches it.')
}
