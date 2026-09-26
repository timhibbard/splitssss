// Explicit extensions: see the note in link.ts.
import { parsePr } from './clock.ts'
import { METERS_PER_MILE, PR_METERS } from './distance.ts'
import type { Squad, Team } from './types'

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
 *
 * Which markers a race had is data, declared per event, and never a field name.
 * Yellow Jacket's varsity race had volunteers at 0.5, 1, 2 and 2.6 miles and its
 * JV race only at 1 and 2; the next course may have one at 800 m. A model with
 * one course's markers written into its types cannot tell "nobody stood there"
 * from "the volunteer missed this runner", and those are different facts: the
 * first is a marker absent from the event, the second a null in a runner's row.
 */

/**
 * A place on the course somebody stood. `label` is how a page says it, "0.5 mi"
 * or "800 m" or "2K", and with its space taken out it is also how the file says
 * it, which is what lets the text round-trip.
 */
export type Marker = { meters: number; label: string }

export type Observed = {
  /** "Rowan H.", the same label the tap buttons say. Never a full name. */
  label: string
  /**
   * Cumulative from the gun, one per marker of this runner's event, in the same
   * order. Null where the volunteer at that marker missed this runner.
   */
  times: (number | null)[]
  finish?: number
  /** This runner's 5K PR *before* this meet, for the comparison. */
  best?: number
  /**
   * Indices into `times` holding a number nobody timed.
   *
   * A missing split can be reconstructed when two real observations bracket it,
   * and that value is worth having, but it must never be indistinguishable from a
   * tap. At Yellow Jacket exactly one was: a varsity mile 1, interpolated between
   * a timed 0.5 mi and a timed 2 mi. A year from now nothing else would say so.
   */
  derived: readonly number[]
  /**
   * What the coach told this runner to run, when there was a plan: a cumulative
   * time for each marker, in the same order as `times`, and a finish. Targets and
   * not observations, so nothing in it is ever `derived`, and a page shows it
   * beside the race and never in place of any part of it.
   */
  plan?: Plan
}

/** A race plan: where the runner meant to be at each marker, and at the line. */
export type Plan = { times: (number | null)[]; finish?: number }

/**
 * One race inside a meet. Its markers and its distance are its own, because two
 * races on one afternoon do not have to have had the same volunteers.
 *
 * `distance` is the honest measured length, not the nominal one. A course that
 * ran 60 m long is still a 5K for the PR line (see `comparesToPr`), but the paces
 * are figured over what was actually run.
 */
export type Event = { squad: Squad; distance: number; markers: Marker[]; runners: Observed[] }

/** One meet for one team: one course, one afternoon, one set of guns. */
export type Meet = { name: string; date: string; team: Team; events: Event[] }

/** Milliseconds per mile at the pace implied by covering `meters` in `ms`. */
export function perMile(ms: number, meters: number): number {
  return (ms * METERS_PER_MILE) / meters
}

/**
 * A distance as a page says it, to the tenth of a mile: "0.5 mi", "2.1 mi".
 *
 * A label and nothing else. 2.6 mi to a 5K line is 815.7 m, 0.507 mi, and this
 * says 0.5: the last hundredth is true and is a nuance nobody reading the page can
 * use. The arithmetic does not round with it. Every pace is still over the true
 * distance, which the segment carries.
 */
export function mileage(meters: number): string {
  return `${Number((meters / METERS_PER_MILE).toFixed(1))} mi`
}

/**
 * Whether a finish at this distance can be set against a 5K PR. A band, not an
 * exact match: a PR is a PR even if the course ran short or long, and a course
 * that measured 60 m over should not cost anyone their PR line. A 3200 or a 4000
 * is well outside it, which keeps distance.ts's rule that a 4K is not a 5K.
 */
export function comparesToPr(distance: number): boolean {
  return Math.abs(distance - PR_METERS) <= 250
}

/* ---------- whole miles ---------- */

/**
 * How close two distances have to be to be the same place. Marker distances come
 * out of tokens like "2.6mi", so two spellings of one marker agree to far better
 * than this; anything farther apart is a different spot on the course.
 */
const SAME_PLACE_M = 0.5

/**
 * Whether a stretch starting `from` meters out and `meters` long is exactly one
 * whole mile, which a mile split already shows. A JV race timed at 1 and 2 miles
 * has an opening that is mile 1 and a middle that is mile 2, and the same number
 * twice under two headings makes a page longer without making it say more.
 */
export function repeatsAMile(from: number, meters: number): boolean {
  const miles = from / METERS_PER_MILE
  return (
    Math.abs(miles - Math.round(miles)) * METERS_PER_MILE <= SAME_PLACE_M &&
    Math.abs(meters - METERS_PER_MILE) <= SAME_PLACE_M
  )
}

/** A known time: the gun, a marker by its index in the event, or the finish. */
export type Anchor = 'start' | 'finish' | number

type Point = { anchor: Anchor; meters: number; at: number }

/** Everything known about one runner's race, in course order, gun included. */
function points(event: Event, runner: Observed): Point[] {
  const known: Point[] = [{ anchor: 'start', meters: 0, at: 0 }]
  event.markers.forEach((marker, i) => {
    const at = runner.times[i]
    if (at != null) known.push({ anchor: i, meters: marker.meters, at })
  })
  if (runner.finish != null) known.push({ anchor: 'finish', meters: event.distance, at: runner.finish })
  return known
}

function pointAt(known: Point[], meters: number): Point | undefined {
  return known.find((p) => p.anchor !== 'start' && Math.abs(p.meters - meters) <= SAME_PLACE_M)
}

/**
 * The two nearest known times either side of `meters`.
 *
 * Never the gun and the finish together. A mile interpolated from nothing but a
 * finish time is the runner's average pace written into a split column, and it
 * would read as a mile somebody ran.
 */
function bracket(known: Point[], meters: number): [Point, Point] | undefined {
  const low = known.findLast((p) => p.meters < meters - SAME_PLACE_M)
  const high = known.find((p) => p.meters > meters + SAME_PLACE_M)
  if (!low || !high) return undefined
  if (low.anchor === 'start' && high.anchor === 'finish') return undefined
  return [low, high]
}

function interpolate([low, high]: [Point, Point], meters: number): number {
  return low.at + ((high.at - low.at) * (meters - low.meters)) / (high.meters - low.meters)
}

/**
 * A correction for interpolating a mile off a wider bracket than the course's
 * tightest, measured rather than assumed.
 *
 * A straight line from 2 mi to the finish misses the fact that runners speed up
 * over the last half mile, and it misses it worse than a line from 2.6 mi does,
 * because it has more than twice the distance to be wrong over. Anybody with both
 * brackets timed shows the size of that miss directly: compute the mile both ways
 * and take the gap. At Yellow Jacket that was +1.84 s, fast on all nine varsity
 * girls, ranging +0.8 s to +3.0 s.
 *
 * Calibrating instead of hardcoding is what makes this survive another meet. A
 * flatter course, a longer finishing straight, or a 2.5 mi marker instead of 2.6
 * changes the number, and nobody would remember to edit a constant.
 *
 * Measured across the whole file, not per event, and that is deliberate. The
 * allowance is a property of the course, and the runners who need it (JV, who had
 * nobody at 2.6) are exactly the ones who cannot calibrate it. Scoped per event it
 * would come out zero for JV and silently move their mile 3 by about two seconds.
 * One file is one team on one course on one day, so the file is the course.
 * Races of different lengths are kept apart, since they did not share a finish.
 */
export type Allowance = {
  /** The race length it applies to. */
  distance: number
  /** Which whole mile. */
  mile: number
  /** The bracket being corrected, as meters from the gun. */
  from: [number, number]
  /** The tightest bracket anyone in the file had, which is what it is corrected onto. */
  onto: [number, number]
  /** Added to a mile interpolated off `from`. Zero when nobody had both brackets. */
  ms: number
  /** How many runners had both, and so measured it. */
  calibrators: number
}

/**
 * Every allowance in a meet.
 *
 * Only the wider brackets get one. The tightest bracket is the reference and is
 * never corrected, which was a real error in the spreadsheet this replaces: the
 * JV correction applied to the varsity rows put every runner who had a 2.6 mile
 * mark about two seconds off.
 *
 * Zero when nobody has both, which is the honest answer: with no runner to
 * calibrate against there is nothing to say about the closing kick, and a
 * constant carried over from another meet is exactly what this is avoiding.
 */
export function kickAllowances(meet: Meet): Allowance[] {
  const found: Allowance[] = []
  for (const distance of new Set(meet.events.map((e) => e.distance))) {
    const field = meet.events
      .filter((e) => e.distance === distance)
      .flatMap((e) => e.runners.map((r) => points(e, r)))
    for (let mile = 1; mile * METERS_PER_MILE <= distance + SAME_PLACE_M; mile++) {
      const at = mile * METERS_PER_MILE
      const brackets = field.flatMap((known) => {
        if (pointAt(known, at)) return []
        const b = bracket(known, at)
        return b ? [b] : []
      })
      if (brackets.length === 0) continue
      const onto = brackets.reduce((best, b) =>
        b[1].meters - b[0].meters < best[1].meters - best[0].meters ? b : best,
      )
      const seen = new Set<string>()
      for (const from of brackets) {
        const key = `${from[0].meters}/${from[1].meters}`
        if (sameSpan(from, onto) || seen.has(key)) continue
        seen.add(key)
        const gaps = field.flatMap((known) => {
          const tight = [pointAt(known, onto[0].meters) ?? start(known, onto[0]), pointAt(known, onto[1].meters)]
          const wide = [pointAt(known, from[0].meters) ?? start(known, from[0]), pointAt(known, from[1].meters)]
          if (!tight[0] || !tight[1] || !wide[0] || !wide[1]) return []
          return [
            interpolate(tight as [Point, Point], at) - interpolate(wide as [Point, Point], at),
          ]
        })
        found.push({
          distance,
          mile,
          from: [from[0].meters, from[1].meters],
          onto: [onto[0].meters, onto[1].meters],
          ms: gaps.length === 0 ? 0 : gaps.reduce((a, b) => a + b, 0) / gaps.length,
          calibrators: gaps.length,
        })
      }
    }
  }
  return found
}

/** The gun, when the bracket end being looked for is the gun. Everybody has that one. */
function start(known: Point[], p: Point): Point | undefined {
  return p.anchor === 'start' ? known[0] : undefined
}

function sameSpan(a: [Point, Point], b: [Point, Point]): boolean {
  return (
    Math.abs(a[0].meters - b[0].meters) <= SAME_PLACE_M &&
    Math.abs(a[1].meters - b[1].meters) <= SAME_PLACE_M
  )
}

/** One whole mile of one runner's race. */
export type WholeMile = {
  /** 1, 2, 3. */
  mile: number
  /** Cumulative from the gun at the mile mark. */
  at: number
  /** This mile on its own. */
  split: number
  /** This mile against the one before it. Positive is slower. Absent for mile 1. */
  net?: number
  /**
   * Whether somebody stood at the mile. A timed mile can still be one the coach
   * reconstructed by hand; that is on the marker, and `isDerived` says.
   */
  timed: boolean
  /** The marker it was timed at, when it was timed at one. */
  marker?: number
  /** The two known times it was interpolated between, when it was not timed. */
  between?: [Anchor, Anchor]
  /** What the kick allowance added to it. Zero on a timed mile or the tightest bracket. */
  allowance: number
}

/** A stretch of the race between two known times, with its true length. */
export type Segment = { meters: number; time: number; pace: number }

export type Row = {
  event: Event
  observed: Observed
  /**
   * Every whole mile up to the race distance that can be had, in order. Timed
   * where somebody stood at the mile, interpolated from the nearest known times
   * either side where nobody did. Stops at the first one that cannot be had,
   * which is a runner with only the gun and the finish to go on. Empty for a
   * runner with no finish, who gets nothing derived at all.
   *
   * JV's mile 3 and varsity's are the same code path, and so is a course with
   * markers at 800 m and 2K and no whole miles at all.
   */
  miles: WholeMile[]
  /**
   * Gun to the event's first marker, first marker to its last, and last marker to
   * the line. Each is divided by its true distance and carries it. The page
   * labels it to the tenth of a mile, "Last 0.5 mi", but the pace is over the
   * true 0.507.
   *
   * These against the race average are the whole story of how a race was run, and
   * they are why a marker is worth a volunteer even when it is not a mile. Going out
   * 25 s/mi quick and closing 30 s/mi quick are different races with one finish.
   */
  opening?: Segment
  middle?: Segment
  closing?: Segment
  fastest?: number
  slowest?: number
  /** Halfway between the fastest and slowest mile. What the Delta is measured from. */
  midpoint?: number
  /** True average mile pace across the whole race. */
  average?: number
  /**
   * How far the average sits from that midpoint. Small means the miles were evenly
   * spaced around the average; large means one of them was an outlier dragging the
   * middle away from where the runner actually spent the race.
   *
   * Not a consistency measure, and named so it cannot be read as one: a runner who
   * slows by the same amount every mile lands near zero however wide their spread.
   * Spread is the consistency number. The coach table calls this one Delta.
   */
  delta?: number
  /** Finish against the PR coming in. Negative is a new PR. Only for a 5K. */
  vsBest?: number
  best: boolean
  /**
   * The plan's own stretches, cut at the same markers and over the same true
   * distances as the race's, so a planned pace and a run one are the same
   * arithmetic and can sit side by side. Absent for a runner with no plan.
   */
  plan?: PlannedRace
}

/** The plan, measured the way a race is. */
export type PlannedRace = {
  opening?: Segment
  middle?: Segment
  closing?: Segment
  finish?: number
  average?: number
  /** Finish against the planned finish. Negative is quicker than the plan. */
  vsPlan?: number
}

export type EventRows = { event: Event; rows: Row[] }

/**
 * Everything the pages show, derived once, event by event, each in finishing
 * order.
 *
 * Order is by published finish rather than by anything timed at a marker: it is
 * the only number here that a chip recorded, and a station's crossing order can
 * disagree with it wherever a volunteer tapped two runners out of sequence.
 */
export function meetRows(meet: Meet): EventRows[] {
  const allowances = kickAllowances(meet)
  return meet.events.map((event) => ({
    event,
    rows: [...event.runners]
      .sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity))
      .map((observed) => row(event, observed, allowances)),
  }))
}

function row(event: Event, observed: Observed, allowances: Allowance[]): Row {
  const { finish, best } = observed

  // No finish, nothing derived. Every derived number here is anchored on the
  // finish somewhere, and the ones that are not would be a partial race dressed as
  // a whole one: two miles and a pace next to twenty finishers. Her marks stay,
  // because those were timed.
  if (finish == null) {
    return { event, observed, miles: [], best: false }
  }

  const known = points(event, observed)

  const miles: WholeMile[] = []
  for (let mile = 1; mile * METERS_PER_MILE <= event.distance + SAME_PLACE_M; mile++) {
    const meters = mile * METERS_PER_MILE
    const hit = pointAt(known, meters)
    const b = hit ? undefined : bracket(known, meters)
    if (!hit && !b) break
    const allowance = b
      ? (allowances.find(
          (a) =>
            a.distance === event.distance &&
            a.mile === mile &&
            Math.abs(a.from[0] - b[0].meters) <= SAME_PLACE_M &&
            Math.abs(a.from[1] - b[1].meters) <= SAME_PLACE_M,
        )?.ms ?? 0)
      : 0
    const at = hit ? hit.at : interpolate(b!, meters) + allowance
    const before = miles.at(-1)
    const split = at - (before?.at ?? 0)
    miles.push({
      mile,
      at,
      split,
      ...(before ? { net: split - before.split } : {}),
      timed: hit != null,
      ...(hit && typeof hit.anchor === 'number' ? { marker: hit.anchor } : {}),
      ...(b ? { between: [b[0].anchor, b[1].anchor] as [Anchor, Anchor] } : {}),
      allowance,
    })
  }

  const { opening, middle, closing } = stretches(event, observed.times, finish)

  const splits = miles.map((m) => m.split)
  const fastest = splits.length > 0 ? Math.min(...splits) : undefined
  const slowest = splits.length > 0 ? Math.max(...splits) : undefined
  const midpoint = fastest != null && slowest != null ? (fastest + slowest) / 2 : undefined
  const average = finish != null ? perMile(finish, event.distance) : undefined
  const delta = average != null && midpoint != null ? Math.abs(average - midpoint) : undefined
  const vsBest =
    finish != null && best != null && comparesToPr(event.distance) ? finish - best : undefined

  return {
    event,
    observed,
    miles,
    opening,
    middle,
    closing,
    fastest,
    slowest,
    midpoint,
    average,
    delta,
    vsBest,
    best: vsBest != null && vsBest < 0,
    ...(observed.plan ? { plan: planned(event, observed.plan, finish) } : {}),
  }
}

/**
 * Gun to the first marker, first marker to the last, and last marker to the line,
 * each over its true distance. One function for the race and the plan, so the two
 * can never be cut at different places.
 */
function stretches(
  event: Event,
  times: (number | null)[],
  finish: number | undefined,
): { opening?: Segment; middle?: Segment; closing?: Segment } {
  const { markers } = event
  const first = times[0]
  const last = times.at(-1)
  const segment = (meters: number, time: number): Segment => ({ meters, time, pace: perMile(time, meters) })
  return {
    opening: markers.length > 0 && first != null ? segment(markers[0].meters, first) : undefined,
    middle:
      markers.length > 1 && first != null && last != null
        ? segment(markers.at(-1)!.meters - markers[0].meters, last - first)
        : undefined,
    closing:
      markers.length > 0 && last != null && finish != null
        ? segment(event.distance - markers.at(-1)!.meters, finish - last)
        : undefined,
  }
}

function planned(event: Event, plan: Plan, ran: number): PlannedRace {
  return {
    ...stretches(event, plan.times, plan.finish),
    ...(plan.finish == null
      ? {}
      : { finish: plan.finish, average: perMile(plan.finish, event.distance), vsPlan: ran - plan.finish }),
  }
}

/** Whether a marker's time on this row is a real observation or something reconstructed. */
export function isDerived(row: Row, marker: number): boolean {
  return row.observed.derived.includes(marker)
}

/** How a page names a known time: a marker's label, or the start or finish. */
export function anchorLabel(event: Event, anchor: Anchor): string {
  if (anchor === 'start') return 'start'
  if (anchor === 'finish') return 'finish'
  return event.markers[anchor].label
}

/* ---------- the text format ---------- */

/**
 * Headings for the meet, then one block per event, each declaring its own
 * markers, then its runners one per line, tab separated:
 *
 *   # meet Yellow Jacket Invitational
 *   # date 2026-09-12
 *   # team girls
 *
 *   # event Varsity
 *   # marks 0.5mi 1mi 2mi 2.6mi
 *   Rowan H.  2:53.3  5:52.9~  12:04.6  15:58.2  19:08.66  18:42.53
 *
 *   # event JV
 *   # marks 1mi 2mi
 *   Jordan B.  7:54.4  16:54.8  27:04.84  -
 *
 * A row is the label, one cell per marker in the order `# marks` gives them, the
 * finish, and the PR they came in with. `-` where the volunteer missed a runner,
 * and a trailing `~` on any value reconstructed rather than timed. `# distance
 * 3200`, in meters, only for an event that is not a 5K.
 *
 * A race plan is a heading line under its runner's row, the label and then the
 * same cells without the PR, each one a cumulative target:
 *
 *   # plan Rowan H.  2:57.5  6:04.0  12:17.0  16:00.8  19:00.80
 *
 * Tabs and not commas, because the source of this is a spreadsheet column and a
 * paste out of one is tab separated already. Positional and not keyed, because
 * the same decision is already made for the roster format and one file format per
 * repository is enough.
 *
 * The label is the short form the tap buttons say, never a full name: this ships
 * in a public build, and the argument is written out in teamfile.ts.
 */

const SQUAD_WORD: Record<string, Squad> = { varsity: 'varsity', jv: 'jv' }
const SQUAD_LABEL: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }
const TEAM_WORD: Record<string, Team> = { girls: 'girls', boys: 'boys' }

/**
 * A marker out of its file token: `0.5mi`, `2.6mi`, `800m`, `2K`. Undefined for
 * anything else, so a typo refuses the file rather than putting a marker
 * somewhere on the course nobody stood.
 */
export function parseMarker(token: string): Marker | undefined {
  const m = /^(\d+(?:\.\d+)?)(mi|m|k|km)$/i.exec(token.trim())
  if (!m) return undefined
  const n = Number(m[1])
  if (!(n > 0)) return undefined
  switch (m[2].toLowerCase()) {
    case 'mi':
      return { meters: n * METERS_PER_MILE, label: `${n} mi` }
    case 'm':
      return { meters: n, label: `${n} m` }
    default:
      return { meters: n * 1000, label: `${n}K` }
  }
}

/**
 * A meet out of text, or an Error saying exactly which line is wrong.
 *
 * Refusing is the point. The old format took a short row as absent marks and
 * silently shifted every value after the gap one column left, so a runner's 2 mi
 * became her 2.6 mi and nothing on any page could tell. Now a row that is not the
 * width its event's `# marks` says is refused, naming the runner and the line, and
 * so is a cell that is not a time. A spreadsheet's header row pasted in with the
 * data lands here too, which is right: it is not a runner.
 *
 * A line with no letters in the first cell still drops out, the same as
 * parseRoster does it: a blank row or a rule of dashes pasted along with the data
 * is not a runner and is not worth refusing the whole file over.
 */
export function parseMeet(text: string): Meet {
  let name = ''
  let date = ''
  let team: Team | undefined
  const events: Event[] = []
  let open: (Event & { at: number }) | undefined
  const labels = new Set<string>()

  const close = () => {
    if (!open) return
    const { at, ...event } = open
    const where = `line ${at}, ${SQUAD_LABEL[event.squad]}`
    if (event.markers.length === 0) throw new Error(`${where}: no "# marks" line for this event.`)
    event.markers.forEach((m, i) => {
      if (i > 0 && m.meters <= event.markers[i - 1].meters)
        throw new Error(`${where}: the marks have to be in course order, and ${m.label} is not.`)
      if (m.meters >= event.distance)
        throw new Error(`${where}: ${m.label} is at or past the finish.`)
    })
    events.push(event)
    open = undefined
  }

  text.split('\n').forEach((raw, i) => {
    const n = i + 1
    const line = raw.replace(/\r$/, '')
    if (line.trim() === '') return

    if (line.trim().startsWith('#')) {
      const head = /^#\s*(\w+)\s*(.*)$/.exec(line.trim())
      if (!head) return
      const [, key, rest] = head
      const value = rest.trim()
      switch (key.toLowerCase()) {
        case 'meet':
          name = value
          return
        case 'date':
          date = value
          return
        case 'team':
          team = TEAM_WORD[value.toLowerCase()]
          if (!team) throw new Error(`line ${n}: "${value}" is not a team. Girls or boys.`)
          return
        case 'event': {
          close()
          const squad = SQUAD_WORD[value.toLowerCase()]
          if (!squad) throw new Error(`line ${n}: "${value}" is not an event. Varsity or JV.`)
          if (events.some((e) => e.squad === squad))
            throw new Error(`line ${n}: a second ${SQUAD_LABEL[squad]} event in one file.`)
          open = { squad, distance: PR_METERS, markers: [], runners: [], at: n }
          return
        }
        case 'marks': {
          if (!open) throw new Error(`line ${n}: "# marks" before any "# event" line.`)
          if (open.runners.length > 0)
            throw new Error(`line ${n}: "# marks" after runners, which would realign them.`)
          const tokens = value.split(/\s+/).filter(Boolean)
          if (tokens.length === 0) throw new Error(`line ${n}: "# marks" with no markers on it.`)
          open.markers = tokens.map((token) => {
            const marker = parseMarker(token)
            if (!marker) throw new Error(`line ${n}: "${token}" is not a marker. Like 0.5mi, 800m, 2K.`)
            return marker
          })
          return
        }
        case 'distance': {
          if (!open) throw new Error(`line ${n}: "# distance" before any "# event" line.`)
          const meters = Number(value)
          if (!/^\d+(\.\d+)?$/.test(value) || !(meters > 0))
            throw new Error(`line ${n}: "${value}" is not a distance in meters.`)
          open.distance = meters
          return
        }
        case 'plan': {
          // A heading and not a row, so a phone still running a build from before
          // plans existed reads the line as a comment and shows the race without
          // it, rather than refusing the whole file over a row the wrong width.
          if (!open) throw new Error(`line ${n}: "# plan" before any "# event" line.`)
          const cells = value.split('\t').map((c) => c.trim())
          const who = cells[0] ?? ''
          const runner = open.runners.find((r) => r.label === who)
          if (!runner) throw new Error(`line ${n}: a plan for ${who || 'nobody'}, who has no row above it in this event.`)
          if (runner.plan) throw new Error(`line ${n}: a second plan for ${who}.`)
          const width = open.markers.length + 2
          if (cells.length !== width)
            throw new Error(
              `line ${n}: ${who}'s plan has ${cells.length} cells and needs ${width}: ` +
                `the name, ${open.markers.map((m) => m.label).join(', ')} and the finish.`,
            )
          const read = (cell: string, what: string) => {
            if (cell === '' || cell === '-') return null
            const ms = parsePr(cell)
            if (ms == null) throw new Error(`line ${n}: ${who}'s planned ${what} is "${cell}", which is not a time.`)
            return ms
          }
          const finish = read(cells[width - 1], 'finish')
          runner.plan = {
            times: open.markers.map((m, j) => read(cells[j + 1], m.label)),
            ...(finish == null ? {} : { finish }),
          }
          return
        }
        default:
          // Any other heading is a comment.
          return
      }
    }

    const cells = line.split('\t').map((c) => c.trim())
    const label = cells[0] ?? ''
    if (!/\p{L}/u.test(label)) return
    if (!open) throw new Error(`line ${n}: ${label} is before any "# event" line.`)
    if (open.markers.length === 0)
      throw new Error(`line ${n}: ${label} is in an event with no "# marks" line above it.`)

    const width = open.markers.length + 3
    if (cells.length !== width) {
      throw new Error(
        `line ${n}: ${label} has ${cells.length} cells and ${SQUAD_LABEL[open.squad]} needs ${width}: ` +
          `the name, ${open.markers.map((m) => m.label).join(', ')}, the finish and the PR. ` +
          `Put a - in any cell with nothing in it.`,
      )
    }
    if (labels.has(label)) throw new Error(`line ${n}: ${label} is in this file twice.`)
    labels.add(label)

    const read = (cell: string, what: string): { ms: number; soft: boolean } | null => {
      if (cell === '' || cell === '-') return null
      const soft = cell.endsWith('~')
      const ms = parsePr(soft ? cell.slice(0, -1) : cell)
      if (ms == null) throw new Error(`line ${n}: ${label}'s ${what} is "${cell}", which is not a time.`)
      return { ms, soft }
    }

    const derived: number[] = []
    const times = open.markers.map((marker, j) => {
      const got = read(cells[j + 1], marker.label)
      if (got?.soft) derived.push(j)
      return got?.ms ?? null
    })
    const finish = read(cells[width - 2], 'finish')
    const best = read(cells[width - 1], 'PR')
    if (finish?.soft || best?.soft)
      throw new Error(`line ${n}: ${label}'s finish and PR are published times, never reconstructed.`)
    open.runners.push({
      label,
      times,
      ...(finish == null ? {} : { finish: finish.ms }),
      ...(best == null ? {} : { best: best.ms }),
      derived,
    })
  })
  close()

  if (name === '') throw new Error('No "# meet <name>" line.')
  if (date === '') throw new Error('No "# date <yyyy-mm-dd>" line.')
  if (!team) throw new Error('No "# team girls" or "# team boys" line.')
  return { name, date, team, events }
}

/**
 * Back to text, so the tool that writes the shipped file can read it back through
 * this same parser and refuse to publish anything that does not survive the round
 * trip. Hundredths throughout, because the finish times came off a results page
 * with hundredths on them and rounding somebody's 19:08.66 would be this app
 * inventing a time nobody ran.
 */
export function meetText(meet: Meet): string {
  const cell = (ms: number | null | undefined, soft = false) =>
    ms == null ? '-' : `${hundredths(ms)}${soft ? '~' : ''}`
  const blocks = meet.events.map((event) =>
    [
      `# event ${SQUAD_LABEL[event.squad]}`,
      `# marks ${event.markers.map((m) => m.label.replace(' ', '')).join(' ')}`,
      ...(event.distance === PR_METERS ? [] : [`# distance ${event.distance}`]),
      ...event.runners.map((r) =>
        [
          r.label,
          ...event.markers.map((_, i) => cell(r.times[i], r.derived.includes(i))),
          cell(r.finish),
          cell(r.best),
        ].join('\t'),
      ),
      ...event.runners.flatMap((r) =>
        r.plan
          ? [`# plan ${[r.label, ...event.markers.map((_, i) => cell(r.plan!.times[i])), cell(r.plan.finish)].join('\t')}`]
          : [],
      ),
    ].join('\n'),
  )
  return [[`# meet ${meet.name}`, `# date ${meet.date}`, `# team ${meet.team}`].join('\n'), ...blocks].join(
    '\n\n',
  )
}

/**
 * m:ss.hh, the format parsePr reads back. Not clock.ts's formatPr, which is for
 * showing a PR and floors sub-centisecond noise into a display string; this one
 * has to round-trip, so it rounds to the centisecond the same way parsePr will
 * read it.
 */
function hundredths(ms: number): string {
  const total = Math.round(ms / 10)
  const cs = total % 100
  const secs = Math.floor(total / 100) % 60
  const mins = Math.floor(total / 6000)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
