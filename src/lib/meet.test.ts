import assert from 'node:assert/strict'
import { test } from 'node:test'
import { METERS_PER_MILE } from './distance.ts'
import { isDerived, kickAllowance, type Observed, meetRows, meetText, parseMeet } from './meet.ts'

// Invented runners throughout, like every other test here. The times are made up
// too, but they are the right size: a 20:00 5K is a real varsity girl's race and a
// 27:00 is a real JV one, and thresholds fitted to those matter.
const M = METERS_PER_MILE

/** Where an evenly paced runner is at each marker, given a finish. */
function even(label: string, finish: number, extra: Partial<Observed> = {}): Observed {
  const at = (meters: number) => (finish * meters) / 5000
  return {
    label,
    half: at(0.5 * M),
    mile1: at(1 * M),
    twoMile: at(2 * M),
    mile26: at(2.6 * M),
    finish,
    derived: [],
    ...extra,
  }
}

const close = (a: number | undefined, b: number, why: string) => {
  assert.ok(a != null && Math.abs(a - b) < 0.001, `${why}: got ${a}, wanted ${b}`)
}

const EVEN_20 = 20 * 60 * 1000
/** The true 3 mile mark for a 20:00 5K run at exactly one pace. */
const TRUE_3_MILE = (EVEN_20 * 3 * M) / 5000

test('an evenly paced runner interpolates to her exact 3 mile mark', () => {
  // Interpolating a straight line recovers the line, so this is the one case where
  // the derived 3 mile has a right answer and it has to hit it. It is what makes
  // everything downstream a question of how far from even a real race is, rather
  // than of whether the arithmetic is right.
  const [row] = meetRows({ name: 'Test', date: '2026-09-12', runners: [even('Rowan H.', EVEN_20)] })
  assert.equal(row.anchor, 'mile26')
  close(row.threeMile, TRUE_3_MILE, 'anchored on 2.6 mi')
})

test('the 2 mile anchor also lands exactly, when there is no kick to miss', () => {
  const noKick = even('Rowan H.', EVEN_20)
  delete noKick.mile26
  const [row] = meetRows({ name: 'Test', date: '2026-09-12', runners: [noKick] })
  assert.equal(row.anchor, 'twoMile')
  close(row.threeMile, TRUE_3_MILE, 'anchored on 2 mi')
})

test('a field with no kick measures no kick allowance', () => {
  // Zero rather than a hardcoded constant. A course where the girls do not speed up
  // over the last half mile should get no correction, and this is what says so.
  const runners = [even('Rowan H.', EVEN_20), even('Jordan B.', 22 * 60 * 1000)]
  close(kickAllowance(runners), 0, 'nobody sped up')
})

test('no runner with both marks means no allowance at all', () => {
  // The honest answer with nothing to calibrate against. Not a fallback constant
  // from another meet, which is the thing this design is avoiding.
  const only2 = even('Rowan H.', EVEN_20)
  delete only2.mile26
  assert.equal(kickAllowance([only2]), 0)
})

/**
 * A runner who runs even to 2.6 miles and then closes the last 816 m 20 s/mile
 * quicker, which is roughly what the girls at Yellow Jacket did.
 */
function kicker(label: string, evenFinish: number, gainMs: number): Observed {
  const base = even(label, evenFinish)
  return { ...base, finish: evenFinish - gainMs }
}

test('a kick makes the 2 mile anchor read fast, and by how much', () => {
  // The 2 mile anchor averages a fast half mile back across 1.19 miles that were
  // not fast, so it puts the runner further along at 3 miles than she was. The 2.6
  // anchor barely notices, because it is inside the fast part already.
  const she = kicker('Rowan H.', EVEN_20, 8_000)
  const gap = kickAllowance([she])
  assert.ok(gap > 0, `the 2 mile anchor should read fast, gap was ${gap}`)
  assert.ok(gap < 10_000, `and by seconds, not minutes: ${gap}`)
})

test('the allowance is the mean over everyone who has both marks', () => {
  const a = kicker('Rowan H.', EVEN_20, 4_000)
  const b = kicker('Jordan B.', 22 * 60 * 1000, 12_000)
  const noneOfIt = even('Marlowe H.', 27 * 60 * 1000)
  delete noneOfIt.mile26
  const mean = (kickAllowance([a]) + kickAllowance([b])) / 2
  close(kickAllowance([a, b, noneOfIt]), mean, 'averaged over the two calibrators')
})

test('the allowance goes on the 2 mile anchor only, never on the 2.6 one', () => {
  // This was a real error in the spreadsheet this replaces: applying the JV branch
  // to the varsity rows added the correction to runners who did not need it, and
  // put everybody who had a 2.6 mile mark about two seconds off.
  const withBoth = kicker('Rowan H.', EVEN_20, 8_000)
  const only2 = { ...kicker('Jordan B.', EVEN_20, 8_000) }
  delete only2.mile26
  const meet = { name: 'Test', date: '2026-09-12', runners: [withBoth, only2] }
  const allowance = kickAllowance(meet.runners)
  assert.ok(allowance > 0, 'there is an allowance to misapply')

  const rows = meetRows(meet)
  const both = rows.find((r) => r.observed.label === 'Rowan H.')!
  const one = rows.find((r) => r.observed.label === 'Jordan B.')!
  assert.equal(both.anchor, 'mile26')
  assert.equal(one.anchor, 'twoMile')

  // Same runner, same finish, one mark apart: the 2.6-anchored row is the reference
  // and the 2-mile-anchored one has been pulled back onto it by the allowance.
  close(one.threeMile! - both.threeMile!, 0, 'the correction closes the gap it measured')
})

test('the splits, nets and paces a coach reads off the table', () => {
  const she: Observed = {
    label: 'Rowan H.',
    half: 173_300,
    mile1: 352_900,
    twoMile: 724_600,
    mile26: 958_200,
    finish: 1_148_660,
    best: 1_122_530,
    derived: [],
  }
  const [row] = meetRows({ name: 'Test', date: '2026-09-12', runners: [she] })

  close(row.mile2Split, 371_700, 'mile 2 is the two mile less the one mile')
  close(row.net1, 371_700 - 352_900, 'net is mile 2 against mile 1, positive being slower')
  close(row.last800, 1_148_660 - 958_200, 'the last 800 is the finish less the 2.6 mile')
  close(row.vsBest, 1_148_660 - 1_122_530, 'vs best is positive when slower')
  assert.equal(row.best, false)

  // Mile 3 is derived, so it belongs in the miles list, and the three of them are
  // what fastest, slowest and the Delta are computed over.
  assert.equal(row.miles.length, 3)
  close(row.fastest, Math.min(...row.miles), 'fastest of the three')
  close(row.slowest, Math.max(...row.miles), 'slowest of the three')
  close(row.average, (1_148_660 * M) / 5000, 'average pace is over the whole 5K')
})

test('a new best is negative and flagged', () => {
  const [row] = meetRows({
    name: 'Test',
    date: '2026-09-12',
    runners: [even('Rowan H.', EVEN_20, { best: EVEN_20 + 30_000 })],
  })
  close(row.vsBest, -30_000, 'ahead of the best coming in')
  assert.equal(row.best, true)
})

test('a runner with no best is not a best and not a failure', () => {
  const [row] = meetRows({ name: 'Test', date: '2026-09-12', runners: [even('Rowan H.', EVEN_20)] })
  assert.equal(row.vsBest, undefined)
  assert.equal(row.best, false)
})

test('rows come out in published finishing order, not station order', () => {
  // A volunteer who taps two runners the wrong way round at a marker would put the
  // table in an order the meet disagrees with, and the meet is the one with a chip.
  const meet = {
    name: 'Test',
    date: '2026-09-12',
    runners: [
      even('Marlowe H.', 22 * 60 * 1000),
      even('Rowan H.', 20 * 60 * 1000),
      even('Jordan B.', 21 * 60 * 1000),
    ],
  }
  assert.deepEqual(
    meetRows(meet).map((r) => r.observed.label),
    ['Rowan H.', 'Jordan B.', 'Marlowe H.'],
  )
})

/* ---------- the text format ---------- */

const FILE = [
  '# meet Yellow Jacket Invitational',
  '# date 2026-09-12',
  'Rowan H.\tVarsity\t2:53.30\t5:52.90\t12:04.60\t15:58.20\t19:08.66\t18:42.53',
  'Marlowe H.\tVarsity\t3:01.10\t6:48.00~\t13:12.40\t17:30.00\t21:14.02\t-',
  'Jordan B.\tJV\t-\t7:54.40\t16:54.80\t-\t27:04.84\t22:40.25',
].join('\n')

test('a meet file survives the round trip byte for byte', () => {
  // The tool that writes the shipped file refuses to publish anything that does
  // not, so this is the check that check depends on.
  assert.equal(meetText(parseMeet(FILE)), FILE)
})

test('the headings carry the meet, not the runners', () => {
  const meet = parseMeet(FILE)
  assert.equal(meet.name, 'Yellow Jacket Invitational')
  assert.equal(meet.date, '2026-09-12')
  assert.equal(meet.runners.length, 3)
})

test('a dash is nobody standing there, and stays absent', () => {
  const [, , jordan] = parseMeet(FILE).runners
  assert.equal(jordan.half, undefined, 'no volunteer at the half mile for JV')
  assert.equal(jordan.mile26, undefined, 'and none at 2.6')
  assert.ok(jordan.mile1 != null, 'but the mile was timed')
  assert.equal(jordan.squad, 'jv')
})

test('a tilde marks a mark nobody timed, and it survives', () => {
  // The one thing this format must not lose. An estimate that reads as a stopwatch
  // reading is a small lie that outlives everyone who knew better.
  const [rowan, marlowe] = parseMeet(FILE).runners
  assert.deepEqual(marlowe.derived, ['mile1'])
  assert.deepEqual(rowan.derived, [], 'and is not sprayed onto everyone else')
  const rows = meetRows({ name: 'T', date: 'd', runners: [rowan, marlowe] })
  const hers = rows.find((r) => r.observed.label === 'Marlowe H.')!
  assert.equal(isDerived(hers, 'mile1'), true)
  assert.equal(isDerived(hers, 'twoMile'), false)
  assert.ok(hers.observed.mile1 != null, 'the value is still there to use')
})

test('a missing best is absent rather than zero', () => {
  const [, marlowe] = parseMeet(FILE).runners
  assert.equal(marlowe.best, undefined)
})

test('a blank line or a rule of dashes is not a runner', () => {
  const meet = parseMeet(`${FILE}\n\n---\n\t\t\n`)
  assert.equal(meet.runners.length, 3)
})

test('hundredths are kept, because a published finish time is not ours to round', () => {
  const [rowan] = parseMeet(FILE).runners
  // 19:08.66, to the centisecond.
  assert.equal(rowan.finish, 19 * 60_000 + 8_660)
})
