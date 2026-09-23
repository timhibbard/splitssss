import assert from 'node:assert/strict'
import { test } from 'node:test'
import { METERS_PER_MILE } from './distance.ts'
import {
  type Event,
  isDerived,
  kickAllowances,
  type Marker,
  type Meet,
  meetRows,
  meetText,
  mileage,
  type Observed,
  parseMarker,
  parseMeet,
  repeatsAMile,
  type Row,
} from './meet.ts'

// Invented runners throughout, like every other test here. The times are made up
// too, but they are the right size: a 20:00 5K is a real varsity girl's race and a
// 27:00 is a real JV one, and thresholds fitted to those matter.
const M = METERS_PER_MILE

const marks = (...tokens: string[]): Marker[] => tokens.map((t) => parseMarker(t)!)
const VARSITY = marks('0.5mi', '1mi', '2mi', '2.6mi')
const JV = marks('1mi', '2mi')

/** Where an evenly paced runner is at each marker, given a finish. */
function even(label: string, finish: number, markers: Marker[], extra: Partial<Observed> = {}): Observed {
  return {
    label,
    times: markers.map((m) => (finish * m.meters) / 5000),
    finish,
    derived: [],
    ...extra,
  }
}

function event(markers: Marker[], runners: Observed[], extra: Partial<Event> = {}): Event {
  return { squad: 'varsity', distance: 5000, markers, runners, ...extra }
}

function meet(...events: Event[]): Meet {
  return { name: 'Test', date: '2026-09-12', team: 'girls', events }
}

/** Every row in a meet, whichever event it is in. */
const rowsOf = (m: Meet): Row[] => meetRows(m).flatMap((e) => e.rows)
const find = (m: Meet, label: string) => rowsOf(m).find((r) => r.observed.label === label)!

const close = (a: number | undefined, b: number, why: string) => {
  assert.ok(a != null && Math.abs(a - b) < 0.001, `${why}: got ${a}, wanted ${b}`)
}

const EVEN_20 = 20 * 60 * 1000
/** The true 3 mile mark for a 20:00 5K run at exactly one pace. */
const TRUE_3_MILE = (EVEN_20 * 3 * M) / 5000

/** Without one marker, as a runner the volunteer there missed. */
function missed(r: Observed, index: number): Observed {
  return { ...r, times: r.times.map((t, i) => (i === index ? null : t)) }
}

test('an evenly paced runner interpolates to her exact 3 mile mark', () => {
  // Interpolating a straight line recovers the line, so this is the one case where
  // the derived 3 mile has a right answer and it has to hit it. It is what makes
  // everything downstream a question of how far from even a real race is, rather
  // than of whether the arithmetic is right.
  const [row] = rowsOf(meet(event(VARSITY, [even('Rowan H.', EVEN_20, VARSITY)])))
  const three = row.miles[2]
  assert.equal(three.timed, false)
  assert.deepEqual(three.between, [3, 'finish'], 'anchored on 2.6 mi')
  close(three.at, TRUE_3_MILE, 'anchored on 2.6 mi')
})

test('the 2 mile anchor also lands exactly, when there is no kick to miss', () => {
  const [row] = rowsOf(meet(event(JV, [even('Rowan H.', EVEN_20, JV)], { squad: 'jv' })))
  assert.deepEqual(row.miles[2].between, [1, 'finish'])
  close(row.miles[2].at, TRUE_3_MILE, 'anchored on 2 mi')
})

test('timed miles are timed, and say which marker they came off', () => {
  const [row] = rowsOf(meet(event(VARSITY, [even('Rowan H.', EVEN_20, VARSITY)])))
  assert.deepEqual(
    row.miles.map((m) => [m.mile, m.timed, m.marker]),
    [
      [1, true, 1],
      [2, true, 2],
      [3, false, undefined],
    ],
  )
})

test('a field with no kick measures no kick allowance', () => {
  // Zero rather than a hardcoded constant. A course where the girls do not speed up
  // over the last half mile should get no correction, and this is what says so.
  const m = meet(
    event(VARSITY, [even('Rowan H.', EVEN_20, VARSITY)]),
    event(JV, [even('Jordan B.', 22 * 60 * 1000, JV)], { squad: 'jv' }),
  )
  for (const a of kickAllowances(m)) close(a.ms, 0, `nobody sped up (mile ${a.mile})`)
})

test('no runner with both brackets means an allowance of 0, not a guess', () => {
  // The honest answer with nothing to calibrate against. Not a fallback constant
  // from another meet, which is the thing this design is avoiding. JV alone has
  // nobody at 2.6 mi, and a 2.6 mi marker from nowhere is not in this file.
  const m = meet(event(JV, [kicker('Jordan B.', EVEN_20, 8_000, JV)], { squad: 'jv' }))
  assert.ok(kickAllowances(m).every((a) => a.ms === 0))
  const [row] = rowsOf(m)
  assert.equal(row.miles[2].allowance, 0)
})

/**
 * A runner who runs even to 2.6 miles and then closes the last stretch 20 s/mile
 * quicker, which is roughly what the girls at Yellow Jacket did.
 */
function kicker(label: string, evenFinish: number, gainMs: number, markers: Marker[]): Observed {
  return { ...even(label, evenFinish, markers), finish: evenFinish - gainMs }
}

/** The allowance a meet measured for mile 3 off 2 mi, which is the one that matters. */
const mile3Off2 = (m: Meet) =>
  kickAllowances(m).find((a) => a.mile === 3 && Math.abs(a.from[0] - 2 * M) < 0.5)

test('a kick makes the 2 mile anchor read fast, and by how much', () => {
  // The 2 mile anchor averages a fast closing stretch back across 1.19 miles that
  // were not fast, so it puts the runner further along at 3 miles than she was. The
  // 2.6 anchor barely notices, because it is inside the fast part already.
  const she = kicker('Rowan H.', EVEN_20, 8_000, VARSITY)
  const m = meet(event(VARSITY, [she]), event(JV, [kicker('Jordan B.', EVEN_20, 8_000, JV)], { squad: 'jv' }))
  const gap = mile3Off2(m)!
  assert.ok(gap.ms > 0, `the 2 mile anchor should read fast, gap was ${gap.ms}`)
  assert.ok(gap.ms < 10_000, `and by seconds, not minutes: ${gap.ms}`)
  assert.equal(gap.calibrators, 1)
})

test('the allowance is measured across the whole file, not per event', () => {
  // The JV runners are the ones who need it and the varsity runners are the ones
  // who can measure it. Scoped per event, JV would get zero and every JV mile 3
  // would move by about two seconds with nothing on the page saying why.
  const a = kicker('Rowan H.', EVEN_20, 4_000, VARSITY)
  const b = kicker('Marlowe H.', 22 * 60 * 1000, 12_000, VARSITY)
  const jv = kicker('Jordan B.', 27 * 60 * 1000, 8_000, JV)
  const one = (r: Observed) => mile3Off2(meet(event(VARSITY, [r]), event(JV, [jv], { squad: 'jv' })))!.ms
  const both = meet(event(VARSITY, [a, b]), event(JV, [jv], { squad: 'jv' }))
  close(mile3Off2(both)!.ms, (one(a) + one(b)) / 2, 'the mean over the two calibrators')
  close(find(both, 'Jordan B.').miles[2].allowance, mile3Off2(both)!.ms, 'and JV gets it')
})

test('the allowance goes on the far anchor only, never on the near one', () => {
  // This was a real error in the spreadsheet this replaces: applying the JV branch
  // to the varsity rows added the correction to runners who did not need it, and
  // put everybody who had a 2.6 mile mark about two seconds off.
  const withBoth = kicker('Rowan H.', EVEN_20, 8_000, VARSITY)
  const only2 = missed({ ...kicker('Jordan B.', EVEN_20, 8_000, VARSITY) }, 3)
  const m = meet(event(VARSITY, [withBoth, only2]))
  assert.ok(mile3Off2(m)!.ms > 0, 'there is an allowance to misapply')

  const both = find(m, 'Rowan H.')
  const one = find(m, 'Jordan B.')
  assert.deepEqual(both.miles[2].between, [3, 'finish'])
  assert.equal(both.miles[2].allowance, 0, 'the tightest bracket is never corrected')
  assert.deepEqual(one.miles[2].between, [2, 'finish'])

  // Same runner, same finish, one mark apart: the 2.6-anchored row is the reference
  // and the 2-mile-anchored one has been pulled back onto it by the allowance.
  close(one.miles[2].at - both.miles[2].at, 0, 'the correction closes the gap it measured')
})

test('two events with different marker sets do not contaminate each other', () => {
  // The JV event's markers are not the varsity event's, and nothing about JV being
  // in the file may move a varsity number. The varsity rows are the calibrators;
  // they are never the corrected.
  const varsity = event(VARSITY, [kicker('Rowan H.', EVEN_20, 6_000, VARSITY), kicker('Marlowe H.', 21 * 60_000, 9_000, VARSITY)])
  const jv = event(JV, [kicker('Jordan B.', 27 * 60_000, 8_000, JV)], { squad: 'jv' })
  const strip = (r: Row) => ({ ...r, event: undefined })
  const alone = meetRows(meet(varsity))[0].rows.map(strip)
  const together = meetRows(meet(varsity, jv))
  assert.deepEqual(together[0].rows.map(strip), alone)
  assert.equal(together[1].rows[0].event.markers, JV)
  assert.equal(together[1].rows[0].observed.times.length, 2)
})

test('whole miles on a course with no whole-mile marker at all', () => {
  // 800 m, 2K and 2.6 mi. Every mile is interpolated, each from its own bracket,
  // and an even runner still comes out exactly even.
  const odd = marks('800m', '2K', '2.6mi')
  const [row] = rowsOf(meet(event(odd, [even('Rowan H.', EVEN_20, odd)])))
  assert.deepEqual(
    row.miles.map((m) => [m.timed, m.between]),
    [
      [false, [0, 1]],
      [false, [1, 2]],
      [false, [2, 'finish']],
    ],
  )
  const perMileEven = (EVEN_20 * M) / 5000
  for (const m of row.miles) close(m.split, perMileEven, `mile ${m.mile}`)
})

test('a mile the volunteer missed is interpolated, and flagged as such', () => {
  const [row] = rowsOf(meet(event(VARSITY, [missed(even('Rowan H.', EVEN_20, VARSITY), 1)])))
  assert.equal(row.miles[0].timed, false)
  assert.deepEqual(row.miles[0].between, [0, 2], 'between 0.5 mi and 2 mi')
})

test('a mile is never made out of the gun and the finish alone', () => {
  // That would be the average pace written into a split column.
  const nothing: Observed = { label: 'Rowan H.', times: [null, null], finish: EVEN_20, derived: [] }
  const [row] = rowsOf(meet(event(JV, [nothing], { squad: 'jv' })))
  assert.deepEqual(row.miles, [])
})

test('a runner with no finish gets every derived number blank, and keeps her marks', () => {
  // A DNF. Two miles and a pace would be a partial race dressed as a whole one.
  const noFinish: Observed = { ...even('Rowan H.', EVEN_20, VARSITY), finish: undefined }
  const [row] = rowsOf(meet(event(VARSITY, [noFinish])))
  assert.deepEqual(row.miles, [])
  assert.equal(row.opening, undefined)
  assert.equal(row.middle, undefined)
  assert.equal(row.closing, undefined)
  assert.equal(row.fastest, undefined)
  assert.equal(row.average, undefined)
  assert.equal(row.delta, undefined)
  assert.equal(row.vsBest, undefined)
  assert.equal(row.best, false)
  assert.deepEqual(row.observed.times, noFinish.times, 'what was timed is still there')
})

test('a DNF sorts last and moves nobody else', () => {
  const she = even('Rowan H.', EVEN_20, VARSITY)
  const dnf: Observed = { ...even('Jordan B.', EVEN_20, VARSITY), finish: undefined }
  const alone = rowsOf(meet(event(VARSITY, [she])))
  const rows = rowsOf(meet(event(VARSITY, [dnf, she])))
  assert.deepEqual(rows.map((r) => r.observed.label), ['Rowan H.', 'Jordan B.'])
  assert.deepEqual(rows[0].miles, alone[0].miles)
})

test('the splits, nets and paces a coach reads off the table', () => {
  const she: Observed = {
    label: 'Rowan H.',
    times: [173_300, 352_900, 724_600, 958_200],
    finish: 1_148_660,
    best: 1_122_530,
    derived: [],
  }
  const [row] = rowsOf(meet(event(VARSITY, [she])))

  close(row.miles[1].split, 371_700, 'mile 2 is the two mile less the one mile')
  close(row.miles[1].net, 371_700 - 352_900, 'net is mile 2 against mile 1, positive being slower')
  close(row.closing?.time, 1_148_660 - 958_200, 'the closing stretch is the finish less the 2.6 mile')
  // The closing pace is over its true 815.7 m, not a flat half mile. With markers
  // declared per race a flat half would be right on one course and wrong on the
  // next, and 15 m is not worth a special case.
  close(row.closing?.meters, 5000 - 2.6 * M, 'the closing stretch is its true length')
  close(row.closing?.pace, ((1_148_660 - 958_200) * M) / (5000 - 2.6 * M), 'and paced over it')
  assert.equal(mileage(row.closing!.meters), '0.51 mi')
  close(row.opening?.pace, 173_300 * 2, 'the opening half mile is a true half mile')
  close(row.middle?.meters, 2.1 * M, 'the middle is the 2.1 miles between the first and last marker')
  close(row.vsBest, 1_148_660 - 1_122_530, 'vs PR is positive when slower')
  assert.equal(row.best, false)

  assert.equal(row.miles.length, 3)
  const splits = row.miles.map((m) => m.split)
  close(row.fastest, Math.min(...splits), 'fastest of the three')
  close(row.slowest, Math.max(...splits), 'slowest of the three')
  close(row.average, (1_148_660 * M) / 5000, 'average pace is over the whole 5K')
})

/**
 * Cumulative marks for a runner whose three miles are exactly these, so a test can
 * name the shape of a race and get one.
 */
function shaped(label: string, [one, two, three]: [number, number, number]): Observed {
  const threeMile = one + two + three
  return {
    label,
    times: [one / 2, one, one + two, one + two + 0.6 * three],
    // The last tenth of a mile, at the third mile's pace.
    finish: threeMile + (5000 / M - 3) * three,
    derived: [],
  }
}

test('spread is the consistency number and the Delta is not', () => {
  // The reason the coach table labels them differently. Both of these runners have a
  // full minute between their fastest and slowest mile, so they are equally
  // inconsistent. One slows by exactly 30 s a mile and the other runs the middle mile
  // a minute slow and recovers, and only the Delta can tell them apart: an evenly
  // stepped race sits on the midpoint of its own range, an outlier does not.
  const m = meet(
    event(VARSITY, [shaped('Rowan H.', [360_000, 390_000, 420_000]), shaped('Jordan B.', [360_000, 420_000, 365_000])]),
  )
  const stepped = find(m, 'Rowan H.')
  const outlier = find(m, 'Jordan B.')
  const spread = (r: Row) => r.slowest! - r.fastest!

  assert.ok(Math.abs(spread(stepped) - spread(outlier)) < 2000, 'the same spread, near enough')
  assert.ok(spread(stepped) > 55_000, `a minute apart: ${spread(stepped)}`)
  assert.ok(stepped.delta! < 3000, `evenly stepped is near zero: ${stepped.delta}`)
  assert.ok(outlier.delta! > 6000, `an outlier is not: ${outlier.delta}`)
})

test('the Delta is the average against the middle of the range, and nothing else', () => {
  const [row] = rowsOf(meet(event(VARSITY, [shaped('Rowan H.', [360_000, 390_000, 420_000])])))
  close(row.midpoint, (row.fastest! + row.slowest!) / 2, 'the midpoint is the range midpoint')
  close(row.delta, Math.abs(row.average! - row.midpoint!), 'and the Delta is the gap to it')
})

test('a new PR is negative and flagged', () => {
  const [row] = rowsOf(meet(event(VARSITY, [even('Rowan H.', EVEN_20, VARSITY, { best: EVEN_20 + 30_000 })])))
  close(row.vsBest, -30_000, 'ahead of the PR coming in')
  assert.equal(row.best, true)
})

test('a runner with no PR is not a PR and not a failure', () => {
  const [row] = rowsOf(meet(event(VARSITY, [even('Rowan H.', EVEN_20, VARSITY)])))
  assert.equal(row.vsBest, undefined)
  assert.equal(row.best, false)
})

test('a non-5K suppresses vs PR, and a 5K that measured long does not', () => {
  const two = marks('1mi')
  const withPr = (distance: number) =>
    rowsOf(meet(event(two, [even('Rowan H.', 12 * 60_000, two, { best: 30 * 60_000 })], { distance })))[0]
  assert.equal(withPr(3200).vsBest, undefined, 'a 3200 is a different race')
  assert.equal(withPr(3200).best, false)
  assert.equal(withPr(4000).vsBest, undefined, 'and so is a 4K')
  assert.ok(withPr(5060).vsBest != null, 'a course 60 m long is still a 5K')
})

test('rows come out in published finishing order, not station order', () => {
  // A volunteer who taps two runners the wrong way round at a marker would put the
  // table in an order the meet disagrees with, and the meet is the one with a chip.
  const m = meet(
    event(VARSITY, [
      even('Marlowe H.', 22 * 60 * 1000, VARSITY),
      even('Rowan H.', 20 * 60 * 1000, VARSITY),
      even('Jordan B.', 21 * 60 * 1000, VARSITY),
    ]),
  )
  assert.deepEqual(
    rowsOf(m).map((r) => r.observed.label),
    ['Rowan H.', 'Jordan B.', 'Marlowe H.'],
  )
})

/* ---------- the text format ---------- */

const FILE = [
  '# meet Yellow Jacket Invitational',
  '# date 2026-09-12',
  '# team girls',
  '',
  '# event Varsity',
  '# marks 0.5mi 1mi 2mi 2.6mi',
  'Rowan H.\t2:53.30\t5:52.90\t12:04.60\t15:58.20\t19:08.66\t18:42.53',
  'Marlowe H.\t3:01.10\t6:48.00~\t13:12.40\t-\t21:14.02\t-',
  '',
  '# event JV',
  '# marks 1mi 2mi',
  'Jordan B.\t7:54.40\t16:54.80\t27:04.84\t22:40.25',
].join('\n')

const refusal = (text: string, pattern: RegExp) => assert.throws(() => parseMeet(text), pattern)

test('a meet file survives the round trip byte for byte', () => {
  // The tool that writes the shipped file refuses to publish anything that does
  // not, so this is the check that check depends on.
  assert.equal(meetText(parseMeet(FILE)), FILE)
})

test('a non-5K event keeps its distance through the round trip', () => {
  const text = [
    ...FILE.split('\n').slice(0, 10),
    '# marks 1mi',
    '# distance 3200',
    'Jordan B.\t6:34.40\t13:04.84\t-',
  ].join('\n')
  const back = parseMeet(meetText(parseMeet(text)))
  assert.equal(back.events[1].distance, 3200)
  assert.equal(meetText(back), text)
})

test('the headings carry the meet, and each event its own markers', () => {
  const m = parseMeet(FILE)
  assert.equal(m.name, 'Yellow Jacket Invitational')
  assert.equal(m.date, '2026-09-12')
  assert.equal(m.team, 'girls')
  assert.deepEqual(
    m.events.map((e) => [e.squad, e.markers.map((k) => k.label), e.runners.length]),
    [
      ['varsity', ['0.5 mi', '1 mi', '2 mi', '2.6 mi'], 2],
      ['jv', ['1 mi', '2 mi'], 1],
    ],
  )
})

test('a dash is the volunteer missing a runner, and stays null', () => {
  const [, marlowe] = parseMeet(FILE).events[0].runners
  assert.equal(marlowe.times[3], null, 'missed at 2.6 mi')
  assert.ok(marlowe.times[2] != null, 'but timed at 2 mi')
})

test('a tilde marks a mark nobody timed, and it survives', () => {
  // The one thing this format must not lose. An estimate that reads as a stopwatch
  // reading is a small lie that outlives everyone who knew better.
  const m = parseMeet(FILE)
  const [rowan, marlowe] = m.events[0].runners
  assert.deepEqual(marlowe.derived, [1])
  assert.deepEqual(rowan.derived, [], 'and is not sprayed onto everyone else')
  const hers = find(m, 'Marlowe H.')
  assert.equal(isDerived(hers, 1), true)
  assert.equal(isDerived(hers, 2), false)
  assert.ok(hers.observed.times[1] != null, 'the value is still there to use')
})

test('a missing PR is absent rather than zero', () => {
  const [, marlowe] = parseMeet(FILE).events[0].runners
  assert.equal(marlowe.best, undefined)
})

test('a blank line or a rule of dashes is not a runner', () => {
  const m = parseMeet(`${FILE}\n\n---\n\t\t\n`)
  assert.equal(m.events[1].runners.length, 1)
})

test('hundredths are kept, because a published finish time is not ours to round', () => {
  const [rowan] = parseMeet(FILE).events[0].runners
  assert.equal(rowan.finish, 19 * 60_000 + 8_660)
})

test('a row of the wrong width is refused, naming the runner and the line', () => {
  // The old format read a short row as absent marks and shifted everything after
  // the gap one column left. A 2 mi became a 2.6 mi and nothing could tell.
  const short = FILE.replace('Jordan B.\t7:54.40\t16:54.80', 'Jordan B.\t16:54.80')
  refusal(short, /line 12: Jordan B\. has 4 cells and JV needs 5/)
  const long = FILE.replace('Rowan H.\t2:53.30', 'Rowan H.\t2:53.30\t2:53.30')
  refusal(long, /line 7: Rowan H\. has 8 cells/)
})

test('a cell that is not a time is refused, not dropped', () => {
  refusal(FILE.replace('12:04.60', '12;04.60'), /line 7: Rowan H\.'s 2 mi is "12;04\.60"/)
  // A spreadsheet header pasted with the data is the common way this happens.
  const header = FILE.replace('# marks 1mi 2mi', '# marks 1mi 2mi\nAthlete\t1 mi\t2 mi\tFinish\tPR')
  refusal(header, /Athlete's 1 mi is "1 mi"/)
})

test('an event with no marks, or marks out of order, is refused', () => {
  refusal(FILE.replace('# marks 1mi 2mi\n', ''), /no "# marks" line/)
  refusal(FILE.replace('# marks 1mi 2mi', '# marks'), /with no markers/)
  refusal(FILE.replace('# marks 1mi 2mi', '# marks 2mi 1mi'), /course order/)
  refusal(FILE.replace('# marks 1mi 2mi', '# marks 1mi 3.2mi'), /past the finish/)
  refusal(FILE.replace('# marks 1mi 2mi', '# marks 1mi 2 miles'), /"2" is not a marker/)
})

test('a runner in the file twice, or before any event, is refused', () => {
  refusal(FILE.replace('Jordan B.', 'Rowan H.'), /line 12: Rowan H\. is in this file twice/)
  refusal(FILE.replace('# event Varsity\n', ''), /before any "# event"/)
})

test('a meet without its team is refused', () => {
  refusal(FILE.replace('# team girls\n', ''), /No "# team/)
  refusal(FILE.replace('# team girls', '# team varsity'), /not a team/)
})

test('marker tokens', () => {
  close(parseMarker('0.5mi')?.meters, 0.5 * M, '0.5mi')
  assert.deepEqual(parseMarker('800m'), { meters: 800, label: '800 m' })
  assert.deepEqual(parseMarker('2K'), { meters: 2000, label: '2K' })
  assert.deepEqual(parseMarker('2km'), { meters: 2000, label: '2K' })
  assert.equal(parseMarker('mile 2'), undefined)
  assert.equal(parseMarker('0mi'), undefined)
})

test('a stretch that is exactly a whole mile repeats a split, and nothing else does', () => {
  // JV timed at 1 and 2 mi: the opening is mile 1 and the middle is mile 2.
  assert.equal(repeatsAMile(0, M), true)
  assert.equal(repeatsAMile(M, M), true)
  // Varsity's opening half mile and middle 2.1 miles are their own numbers.
  assert.equal(repeatsAMile(0, 0.5 * M), false)
  assert.equal(repeatsAMile(0.5 * M, 2.1 * M), false)
  // A mile long, but not a mile on the course: 0.5 to 1.5 is not a split anyone has.
  assert.equal(repeatsAMile(0.5 * M, M), false)
})
