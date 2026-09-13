// Explicit extensions: see the note in link.ts.
import { parsePr } from './clock.ts'
import { METERS_PER_MILE, PR_METERS } from './distance.ts'
import type { Squad } from './types'

/**
 * One meet's reconciled results: what volunteers timed at the markers, joined to
 * the finish times the meet published, per runner.
 *
 * This is the coach's season record, not a capture format. The app's own CSV is
 * one station from one phone; this is what several of those become after a person
 * has looked at them, thrown out the mis-taps, and put every device on one gun.
 * Nothing here is produced automatically yet. Doing it by hand first is what
 * establishes what the import has to handle.
 *
 * Times are milliseconds, matching everything else in this app, so the formatters
 * in clock.ts apply unchanged.
 */

/** Marker distances, in meters, as the course actually had them. */
const HALF_MILE_M = 0.5 * METERS_PER_MILE
const TWO_MILE_M = 2 * METERS_PER_MILE
const MILE_2_6_M = 2.6 * METERS_PER_MILE
const THREE_MILE_M = 3 * METERS_PER_MILE
const RACE_M = PR_METERS

/**
 * A cumulative time somebody stood at a marker for, or that the meet published.
 * Named so a derived value can say which of them it is standing in for.
 */
export type Mark = 'half' | 'mile1' | 'twoMile' | 'mile26' | 'finish'

const MARKS: Mark[] = ['half', 'mile1', 'twoMile', 'mile26', 'finish']

export type Observed = {
  /** "Rowan H.", the same label the tap buttons say. Never a full name. */
  label: string
  squad?: Squad
  /** Cumulative from the gun. Absent where no volunteer stood. */
  half?: number
  mile1?: number
  twoMile?: number
  mile26?: number
  finish?: number
  /** This runner's 5K best *before* this meet, for the comparison. */
  best?: number
  /**
   * Marks holding a number nobody timed.
   *
   * A missing split can be reconstructed when two real observations bracket it,
   * and that value is worth having, but it must never be indistinguishable from a
   * tap. At Yellow Jacket exactly one was: Emma L.'s mile 1, interpolated between
   * a timed 0.5 mi and a timed 2 mi. A year from now nothing else would say so.
   */
  derived: readonly Mark[]
}

export type Meet = { name: string; date: string; runners: Observed[] }

/** Milliseconds per mile at the pace implied by covering `meters` in `ms`. */
export function perMile(ms: number, meters: number): number {
  return (ms * METERS_PER_MILE) / meters
}

/** Where `target` falls between two marks, as a fraction of the gap. */
function fraction(target: number, from: number, to: number): number {
  return (target - from) / (to - from)
}

const FROM_2_6 = fraction(THREE_MILE_M, MILE_2_6_M, RACE_M)
const FROM_2_MILE = fraction(THREE_MILE_M, TWO_MILE_M, RACE_M)

/**
 * The 3 mile mark, interpolated, because nobody was standing at it.
 *
 * It reads far better than an interpolation has any right to, and the reason is
 * that 3 miles is only 172 m short of a 5K. Anchored on 2.6 mi the published
 * finish carries 79% of the weight; anchored on 2 mi it carries 90%. So the
 * shakiest number in a set barely touches the answer: the 9.5 s gun error at
 * Yellow Jacket's 2.6 mi station comes through as about 1.3 s here.
 *
 * Anchoring on the nearer mark is strictly better, so 2.6 mi wins whenever a
 * volunteer stood there. Only the JV girls, who had no 2.6 mi station, fall back
 * to 2 mi.
 */
function fromMark(mark: number, finish: number, span: number): number {
  return mark + span * (finish - mark)
}

/**
 * How much the 2 mi anchor undershoots, measured rather than assumed.
 *
 * A straight line from 2 mi to the finish misses the fact that runners speed up
 * over the last half mile, and it misses it worse than a line from 2.6 mi does
 * because it has more than twice the distance to be wrong over. Every varsity
 * girl has *both* anchors, so the size of that miss is not a guess: compute both
 * ways for whoever has both marks and take the mean gap. At Yellow Jacket that is
 * +1.84 s, fast on all nine, ranging +0.8 s to +3.0 s.
 *
 * Calibrating instead of hardcoding is what makes this survive another meet. A
 * flatter course, a longer finishing straight, or a 2.5 mi marker instead of 2.6
 * changes the number, and nobody would remember to edit a constant.
 *
 * Zero when nobody has both marks, which is the honest answer: with no runner to
 * calibrate against there is nothing to say about the closing kick.
 */
export function kickAllowance(runners: Observed[]): number {
  const gaps = runners.flatMap((r) =>
    r.mile26 != null && r.twoMile != null && r.finish != null
      ? [fromMark(r.mile26, r.finish, FROM_2_6) - fromMark(r.twoMile, r.finish, FROM_2_MILE)]
      : [],
  )
  if (gaps.length === 0) return 0
  return gaps.reduce((a, b) => a + b, 0) / gaps.length
}

export type Row = {
  observed: Observed
  /** Mile 2 alone: the 2 mile mark less the 1 mile mark. */
  mile2Split?: number
  /** Mile 2 against mile 1. Positive is slower. */
  net1?: number
  threeMile?: number
  /** Which mark the 3 mile came off, so a page can say. */
  anchor?: Extract<Mark, 'mile26' | 'twoMile'>
  mile3Split?: number
  /** Mile 3 against mile 2. Positive is slower. */
  net2?: number
  /**
   * 2.6 mi to the line, called the last half mile everywhere it is shown.
   *
   * It is 815.7 m, which is 15.7 m more than half a mile, and that difference is
   * deliberately given up: `kickPace` divides by a flat half mile so the pace is the
   * time doubled and reconciles in one step. Dividing by the true 0.507 mi put 3:10.4
   * next to 6:16 when doubling it says 6:20.9, and two correct numbers that look like
   * they disagree cost more than 1.4% of a distance a volunteer paced off anyway.
   */
  lastHalf?: number
  /** Per mile over the 2.1 miles between the 0.5 and 2.6 markers. */
  middlePace?: number
  /**
   * Per mile over the opening half mile and over the closing one, both figured over
   * exactly half a mile so each is its own time doubled. Both exist only where a
   * volunteer stood at 0.5 mi and 2.6 mi, so varsity only here.
   *
   * These two against the race average are the whole story of how a 5K was run,
   * and they are the reason those two markers are worth a volunteer each even
   * though neither is a mile. Going out 25 s/mi quick and closing 30 s/mi quick
   * are different races with the same finish time.
   */
  openPace?: number
  kickPace?: number
  /** The three individual miles, in order, however many of them exist. */
  miles: number[]
  fastest?: number
  slowest?: number
  /** Halfway between the fastest and slowest mile. What the Delta is measured from. */
  midpoint?: number
  /** True average mile pace across the whole 5K. */
  average?: number
  /**
   * How far the average sits from that midpoint. Small means the three miles were
   * evenly spaced around the average; large means one of them was an outlier
   * dragging the middle away from where the runner actually spent the race.
   *
   * Not a consistency measure, and named so it cannot be read as one: a runner who
   * slows by the same amount every mile lands near zero however wide their spread.
   * Spread is the consistency number. The coach table calls this one Delta.
   */
  delta?: number
  /** Finish against the best time coming in. Negative is a new best. */
  vsBest?: number
  best: boolean
}

/**
 * Everything the pages show, derived once, in finishing order.
 *
 * Order is by published finish rather than by anything timed at a marker: it is
 * the only number here that a chip recorded, and a station's crossing order can
 * disagree with it wherever a volunteer tapped two runners out of sequence.
 */
export function meetRows(meet: Meet): Row[] {
  const allowance = kickAllowance(meet.runners)
  return [...meet.runners]
    .sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity))
    .map((observed) => row(observed, allowance))
}

function row(observed: Observed, allowance: number): Row {
  const { half, mile1, twoMile, mile26, finish, best } = observed

  const mile2Split = twoMile != null && mile1 != null ? twoMile - mile1 : undefined
  const net1 = mile2Split != null && mile1 != null ? mile2Split - mile1 : undefined

  const anchor = finish == null ? undefined : mile26 != null ? 'mile26' : twoMile != null ? 'twoMile' : undefined
  const threeMile =
    finish == null
      ? undefined
      : anchor === 'mile26'
        ? fromMark(mile26!, finish, FROM_2_6)
        : anchor === 'twoMile'
          ? fromMark(twoMile!, finish, FROM_2_MILE) + allowance
          : undefined

  const mile3Split = threeMile != null && twoMile != null ? threeMile - twoMile : undefined
  const net2 = mile3Split != null && mile2Split != null ? mile3Split - mile2Split : undefined

  const lastHalf = finish != null && mile26 != null ? finish - mile26 : undefined
  const middlePace =
    mile26 != null && half != null ? perMile(mile26 - half, MILE_2_6_M - HALF_MILE_M) : undefined
  const openPace = half != null ? perMile(half, HALF_MILE_M) : undefined
  // A flat half mile, not the 815.7 m this actually is. See `lastHalf`: the pace has
  // to be the time doubled or the two numbers read as a contradiction.
  const kickPace = lastHalf != null ? perMile(lastHalf, HALF_MILE_M) : undefined

  const miles = [mile1, mile2Split, mile3Split].filter((m): m is number => m != null)
  const fastest = miles.length > 0 ? Math.min(...miles) : undefined
  const slowest = miles.length > 0 ? Math.max(...miles) : undefined
  const midpoint = fastest != null && slowest != null ? (fastest + slowest) / 2 : undefined
  const average = finish != null ? perMile(finish, RACE_M) : undefined
  const delta = average != null && midpoint != null ? Math.abs(average - midpoint) : undefined
  const vsBest = finish != null && best != null ? finish - best : undefined

  return {
    observed,
    mile2Split,
    net1,
    threeMile,
    anchor,
    mile3Split,
    net2,
    lastHalf,
    middlePace,
    openPace,
    kickPace,
    miles,
    fastest,
    slowest,
    midpoint,
    average,
    delta,
    vsBest,
    best: vsBest != null && vsBest < 0,
  }
}

/** Whether a mark on this row is a real observation or something reconstructed. */
export function isDerived(row: Row, mark: Mark): boolean {
  return row.observed.derived.includes(mark)
}

/* ---------- the text format ---------- */

/**
 * One runner per line, tab separated, in the fixed order below, with `-` where
 * no volunteer stood and a trailing `~` on any value that was reconstructed
 * rather than timed:
 *
 *   Rowan H.  Varsity  2:53.3  5:52.9~  12:04.6  15:58.2  19:08.66  18:42.53
 *
 * Tabs and not commas, because the source of this is a spreadsheet column and a
 * paste out of one is tab separated already. Positional and not keyed, because
 * the same decision is already made for the roster format and one file format per
 * repository is enough.
 *
 * The label is the short form the tap buttons say, never a full name: this ships
 * in a public build, and the argument is written out in teamfile.ts.
 */
const COLUMNS: Mark[] = ['half', 'mile1', 'twoMile', 'mile26', 'finish']

const SQUAD_WORD: Record<string, Squad> = {
  varsity: 'varsity',
  jv: 'jv',
}

const SQUAD_LABEL: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }

/**
 * A meet out of text. Headings carry the meet itself:
 *
 *   # meet Yellow Jacket Invitational
 *   # date 2026-09-12
 *
 * A line with no letters in the first cell drops out rather than throwing, for the
 * same reason parseRoster does it: a blank row or a rule of dashes pasted along
 * with the data is not a runner and is not worth refusing the whole file over.
 *
 * A spreadsheet's *header* row does have letters and does become a runner here,
 * named "Athlete" with no times on it. That is deliberate rather than overlooked:
 * guessing at which first cells are headings would eventually throw away somebody's
 * actual race. It is caught one layer up instead, where tools/meet-file.ts refuses
 * to write a file containing anybody with no finish time, and says whose.
 */
export function parseMeet(text: string): Meet {
  let name = ''
  let date = ''
  const runners: Observed[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('#')) {
      const head = /^#\s*(meet|date)\s+(.*)$/i.exec(line)
      if (head) {
        if (head[1].toLowerCase() === 'meet') name = head[2].trim()
        else date = head[2].trim()
      }
      continue
    }
    const cells = line.split('\t').map((c) => c.trim())
    const label = cells[0] ?? ''
    if (!/\p{L}/u.test(label)) continue
    const squad = SQUAD_WORD[(cells[1] ?? '').toLowerCase()]
    const derived: Mark[] = []
    const times: Partial<Record<Mark, number>> = {}
    COLUMNS.forEach((mark, i) => {
      const cell = cells[i + 2] ?? '-'
      if (cell === '' || cell === '-') return
      const soft = cell.endsWith('~')
      const value = parsePr(soft ? cell.slice(0, -1) : cell)
      if (value == null) return
      times[mark] = value
      if (soft) derived.push(mark)
    })
    const best = parsePr(cells[COLUMNS.length + 2] ?? '')
    runners.push({
      label,
      ...(squad == null ? {} : { squad }),
      ...times,
      ...(best == null ? {} : { best }),
      derived,
    })
  }
  return { name, date, runners }
}

/**
 * Back to text, so the tool that writes the shipped file can read it back through
 * this same parser and refuse to publish anything that does not survive the round
 * trip. Hundredths throughout, because the finish times came off a results page
 * with hundredths on them and rounding somebody's 19:08.66 would be this app
 * inventing a time nobody ran.
 */
export function meetText(meet: Meet): string {
  const cell = (ms: number | undefined, soft: boolean) =>
    ms == null ? '-' : `${hundredths(ms)}${soft ? '~' : ''}`
  const lines = meet.runners.map((r) =>
    [
      r.label,
      r.squad == null ? '-' : SQUAD_LABEL[r.squad],
      ...COLUMNS.map((mark) => cell(r[mark], r.derived.includes(mark))),
      r.best == null ? '-' : hundredths(r.best),
    ].join('\t'),
  )
  return [`# meet ${meet.name}`, `# date ${meet.date}`, ...lines].join('\n')
}

/**
 * m:ss.hh, the format parsePr reads back. Not clock.ts's formatPr, which is for
 * showing a best time and floors sub-centisecond noise into a display string;
 * this one has to round-trip, so it rounds to the centisecond the same way parsePr
 * will read it.
 */
function hundredths(ms: number): string {
  const total = Math.round(ms / 10)
  const cs = total % 100
  const secs = Math.floor(total / 100) % 60
  const mins = Math.floor(total / 6000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** Every mark, for a page that wants to walk them in course order. */
export { MARKS }
