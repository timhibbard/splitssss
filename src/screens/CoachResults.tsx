/**
 * The whole field, every column, for the one person who wants all of it.
 *
 * This is the spreadsheet, on a phone. It is deliberately the opposite of the
 * athlete page: no sentences, no encouragement, no rounding, twenty columns and a
 * horizontal scroll. A coach comparing eight runners' second miles needs them in a
 * grid, and any amount of prose in the way makes that harder.
 *
 * Nothing here says "her" or "his". Two teams share this app and one athlete's
 * table is the same table as another's, so the text says "the runner" or says
 * nothing. The columns are the same either way.
 *
 * The footnotes are not decoration. Half the numbers in this table are derived,
 * one runner's mile 1 was never timed at all, and three of the four stations had a
 * gun error that had to be corrected out by hand before any of this lined up. A
 * table that does not say so is a table that will be trusted too much next spring.
 */

import { useState } from 'react'
import { formatElapsed, formatPr, formatSignedElapsed } from '../lib/clock'
import { METERS_PER_MILE } from '../lib/distance'
import { resultsLink } from '../lib/link'
import {
  anchorLabel,
  comparesToPr,
  type Event,
  type EventRows,
  isDerived,
  kickAllowances,
  type Meet,
  meetRows,
  mileage,
  repeatsAMile,
  type Row,
} from '../lib/meet'
import type { Published } from '../lib/pages'

type Props = {
  /** `undefined` while the file is still being looked for, `null` if there isn't one. */
  meet: Meet | null | undefined
  /** Which meet's address this is, so the page has a name before the file lands. */
  published: Published
  onBack: () => void
}

/**
 * The columns, in the order the spreadsheet has them, which is course order with
 * each derived number immediately after the marks it came from. A split next to
 * its own net is the comparison; a split three columns from its net is arithmetic
 * to do in your head.
 *
 * `soft` marks a column whose every value is interpolated, so the header can say
 * so once instead of the body marking each cell.
 */
type Column = {
  head: string
  /** Short enough for a phone's column, since the header row is the widest thing. */
  sub?: string
  soft?: boolean
  cell: (row: Row) => string
  /** Whether this particular runner's value was reconstructed. */
  derived?: (row: Row) => boolean
  /** Signed, and coloured by sign: a net or a gap to a PR. */
  signed?: boolean
}

const time = (ms: number | null | undefined) => (ms == null ? '' : formatElapsed(ms))
const sign = (ms: number | undefined) => (ms == null ? '' : formatSignedElapsed(ms))
/** A pace as m:ss. Tenths of a second per mile is precision this does not have. */
const pace = (ms: number | undefined) => {
  if (ms == null) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** A column head for a distance: "½ mi" reads faster in a header than "0.5 mi". */
const head = (label: string) => label.replace(/^0\.5 mi$/, '½ mi')

/** How many whole miles an event's rows have, which is how many mile columns it gets. */
const mileCount = (rows: Row[]) => Math.max(0, ...rows.map((r) => r.miles.length))

/** Whether a runner's mile k (1-based) was interpolated, or rests on one that was. */
const softMile = (r: Row, k: number) => {
  const m = r.miles[k - 1]
  return m != null && (!m.timed || (m.marker != null && isDerived(r, m.marker)))
}

/**
 * Course order, built from the event's own markers. Each marker, and any whole
 * mile nobody stood at, in the order a runner reaches them; after every whole mile
 * from the second on, that mile's split and its net; the middle pace after the
 * last marker; then the closing stretch, the finish and the PR.
 */
function courseColumns(event: Event, rows: Row[]): Column[] {
  const miles = mileCount(rows)
  const places = [
    ...event.markers.map((marker, i) => ({ meters: marker.meters, marker: i })),
    ...Array.from({ length: miles }, (_, i) => ({ meters: (i + 1) * METERS_PER_MILE, mile: i + 1 })).filter(
      ({ meters }) => !event.markers.some((m) => Math.abs(m.meters - meters) <= 0.5),
    ),
  ].sort((a, b) => a.meters - b.meters)

  const columns: Column[] = [{ head: 'Pace', sub: 'per mile', cell: (r) => pace(r.average) }]
  const last = event.markers.at(-1)
  const first = event.markers[0]
  for (const place of places) {
    if ('marker' in place && place.marker != null) {
      const i = place.marker
      columns.push({
        head: head(event.markers[i].label),
        cell: (r) => time(r.observed.times[i]),
        derived: (r) => isDerived(r, i),
      })
    } else {
      const k = (place as { mile: number }).mile
      columns.push({
        head: `${k} mi`,
        sub: 'calculated',
        soft: true,
        cell: (r) => time(r.miles[k - 1]?.at),
      })
    }
    const k = Math.round(place.meters / METERS_PER_MILE)
    if (k >= 2 && k <= miles && Math.abs(place.meters - k * METERS_PER_MILE) <= 0.5) {
      const calculated = !event.markers.some((m) => Math.abs(m.meters - place.meters) <= 0.5)
      columns.push(
        {
          head: `Mile ${k}`,
          sub: 'split',
          soft: calculated,
          cell: (r) => time(r.miles[k - 1]?.split),
          derived: (r) => softMile(r, k) || softMile(r, k - 1),
        },
        {
          head: 'Net',
          sub: `vs mile ${k - 1}`,
          soft: calculated,
          cell: (r) => sign(r.miles[k - 1]?.net),
          derived: (r) => softMile(r, k) || softMile(r, k - 1),
          signed: true,
        },
      )
    }
    if (
      event.markers.length > 1 &&
      'marker' in place &&
      place.marker === event.markers.length - 1 &&
      !repeatsAMile(first.meters, last!.meters - first.meters)
    ) {
      columns.push({
        head: 'Middle',
        sub: `${first.label.replace(' mi', '')}–${last!.label} pace`,
        cell: (r) => pace(r.middle?.pace),
      })
    }
  }
  if (last) {
    columns.push({
      head: `Last ${mileage(event.distance - last.meters)}`,
      cell: (r) => time(r.closing?.time),
    })
  }
  columns.push({
    head: 'Finish',
    cell: (r) => (r.observed.finish == null ? '' : formatPr(r.observed.finish)),
  })
  // "Previous PR", not "Best coming in". PR is the word the team says, and
  // "previous" carries what "coming in" was there for: this is the time they
  // arrived with, and a highlighted row has beaten it. Only for a 5K, since a PR
  // is a 5K PR and against anything else it is two different races subtracted.
  if (comparesToPr(event.distance)) {
    columns.push(
      { head: 'Previous PR', cell: (r) => (r.observed.best == null ? '' : formatPr(r.observed.best)) },
      { head: 'vs PR', cell: (r) => sign(r.vsBest), signed: true },
    )
  }
  return columns
}

/**
 * The miles against each other, for the view that is about how consistent each
 * race was rather than where each mark was taken.
 *
 * Spread is the consistency column: slowest mile less fastest, in seconds, which is
 * the whole question in one number. The Delta is a different question — how far the
 * average mile sits from the middle of that range, which says whether one mile was an
 * outlier or all of them stepped evenly — and its sub-label names its inputs, since
 * the name Delta does not and "middle mile", which used to sit there, named the wrong
 * ones.
 */
function mileColumns(event: Event, rows: Row[]): Column[] {
  const first = event.markers[0]
  const last = event.markers.at(-1)
  const calculated = (k: number) =>
    !event.markers.some((m) => Math.abs(m.meters - k * METERS_PER_MILE) <= 0.5)
  return [
    ...Array.from({ length: mileCount(rows) }, (_, i): Column => ({
      head: `Mile ${i + 1}`,
      ...(calculated(i + 1) ? { sub: 'calculated', soft: true } : {}),
      cell: (r) => time(r.miles[i]?.split),
      derived: (r) => softMile(r, i + 1) || (i > 0 && softMile(r, i)),
    })),
    { head: 'Fastest', cell: (r) => time(r.fastest) },
    { head: 'Slowest', cell: (r) => time(r.slowest) },
    {
      head: 'Spread',
      sub: 'how consistent',
      cell: (r) => (r.fastest == null ? '' : formatElapsed(r.slowest! - r.fastest!)),
    },
    { head: 'Pace', sub: 'per mile', cell: (r) => pace(r.average) },
    { head: 'Delta', sub: 'avg vs midrange', cell: (r) => time(r.delta) },
    ...(first && !repeatsAMile(0, first.meters) ? [{ head: 'Open', sub: `first ${mileage(first.meters)}`, cell: (r: Row) => pace(r.opening?.pace) }] : []),
    ...(last
      ? [{ head: 'Kick', sub: `last ${mileage(event.distance - last.meters)}`, cell: (r: Row) => pace(r.closing?.pace) }]
      : []),
  ]
}

/**
 * Two column sets, named for what they hold.
 *
 * Neither is called "everything", because neither is: `course` is every mark and
 * every net in course order and has none of the mile-against-mile numbers, and
 * `miles` has those and none of the intermediate marks. And neither is called "how
 * they ran", which sounds like a judgement about a race when both are the same
 * arithmetic on the same stopwatch readings.
 */
type View = 'course' | 'miles'
const VIEWS: { view: View; says: string }[] = [
  { view: 'course', says: 'Course order' },
  { view: 'miles', says: 'Mile by mile' },
]

export function CoachResults({ meet, published, onBack }: Props) {
  const [view, setView] = useState<View>('course')
  const [status, setStatus] = useState('')

  const events = meet ? meetRows(meet) : []
  const runners = events.reduce((n, e) => n + e.rows.length, 0)

  /**
   * Texts the *athlete* page, not this one. This page is the only thing on the site
   * with the whole team's numbers side by side, and a team group text is exactly
   * where it should not end up — one runner reading their own splits is one thing and
   * reading them ranked against six teammates is another. So the button here sends
   * the address that shows one runner one race, their own.
   */
  async function share() {
    // Built from the app's base, not from where this page happens to be. The coach
    // page sits underneath the athlete page, so a link made out of the current
    // pathname would point back at this table.
    const link = resultsLink(window.location.origin, import.meta.env.BASE_URL, published)
    const text = `${published.name} splits — pick your name: ${link}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // Cancelled or unsupported. Fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Link copied. Paste it into the team text.')
    } catch {
      setStatus(`Could not copy it. The link is ${link}`)
    }
  }

  return (
    <div className="screen results coach">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>{meet?.name ?? published.name}</strong>
          <span>{meet ? `${meet.date} · ${runners} runners` : 'One moment'}</span>
        </div>
      </header>

      {meet === undefined ? (
        <p className="instructions">Looking for the results…</p>
      ) : meet === null ? (
        <p className="instructions">
          This build does not have the results in it. Tap Refresh on the home screen
          to pick up a newer one.
        </p>
      ) : (
        <>
          <section className="coach-share">
            <button type="button" onClick={share}>
              Text the team their splits
            </button>
            <p className="hint">
              Sends the athlete page, where each runner picks their own name. Not this
              page.
            </p>
            {status && <p className="status">{status}</p>}
          </section>

          <div className="views" role="group" aria-label="Which columns">
            {VIEWS.map(({ view: which, says }) => (
              <button
                key={which}
                type="button"
                className={view === which ? 'is-on' : ''}
                aria-pressed={view === which}
                onClick={() => setView(which)}
              >
                {says}
              </button>
            ))}
          </div>

          {events.map((e) => (
            <EventTable key={e.event.squad} {...e} view={view} several={events.length > 1} />
          ))}

          <Footnotes meet={meet} events={events} />
        </>
      )}
    </div>
  )
}

/**
 * One event's table. Its own columns, because its own markers: a JV race timed at
 * 1 and 2 miles and a varsity race timed at four places are two tables, and one
 * table holding both would be half blanks that read as missed runners.
 */
function EventTable({ event, rows, view, several }: EventRows & { view: View; several: boolean }) {
  const columns = view === 'course' ? courseColumns(event, rows) : mileColumns(event, rows)
  return (
    <section className="coach-event">
      {several && (
        <h2>
          {event.squad === 'jv' ? 'JV' : 'Varsity'} · {rows.length} runners
        </h2>
      )}
      {/*
        Horizontal scroll with the name column pinned. Fifteen columns will not
        fit a phone and shrinking the type until they do makes the table
        unreadable, so it scrolls — but a row of times with the name scrolled off
        the left edge belongs to nobody, hence the sticky first column.
      */}
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" className="who">
                Runner
              </th>
              {columns.map((col) => (
                <th key={col.head + (col.sub ?? '')} scope="col" className={col.soft ? 'is-soft' : ''}>
                  {col.head}
                  {col.sub && <span className="sub">{col.sub}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.observed.label} className={row.best ? 'is-best' : ''}>
                <th scope="row" className="who">
                  {row.observed.label}
                </th>
                {columns.map((col) => {
                  const text = col.cell(row)
                  const soft = col.soft || (col.derived?.(row) ?? false)
                  return (
                    <td
                      key={col.head + (col.sub ?? '')}
                      className={[
                        soft ? 'is-soft' : '',
                        col.signed && text.startsWith('-') ? 'is-down' : '',
                        col.signed && text.startsWith('+') ? 'is-up' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * What is measured and what is not, spelled out.
 *
 * Generated from the meet rather than typed, so a second meet with different
 * stations cannot ship last meet's caveats. The one thing hardcoded is the gun
 * corrections, because those happened outside this data: they were reconciled by
 * hand before the file was built, and the file has no memory of them. That is the
 * gap results-import is meant to close.
 */
function Footnotes({ meet, events }: { meet: Meet; events: EventRows[] }) {
  const allowances = kickAllowances(meet).filter((a) => a.ms !== 0)
  const several = events.length > 1
  const span = (distance: number, pair: [number, number]) =>
    pair.map((m) => (m === 0 ? 'the gun' : m >= distance - 0.5 ? 'the finish' : mileage(m))).join(' to ')

  return (
    <section className="footnotes">
      <h2>What is measured, and what is not</h2>
      <ul>
        {events.map(({ event, rows }) => {
          const who = several ? `${event.squad === 'jv' ? 'JV' : 'Varsity'}: ` : ''
          const counts = event.markers.map(
            (m, i) => `${m.label} ${rows.filter((r) => r.observed.times[i] != null).length}`,
          )
          const finished = rows.filter((r) => r.observed.finish != null).length
          const guessed = rows.flatMap((r) =>
            r.observed.derived.length > 0
              ? [`${r.observed.label} (${r.observed.derived.map((i) => event.markers[i].label).join(', ')})`]
              : [],
          )
          const miles = mileCount(rows)
          return [
            <li key={`${event.squad}-coverage`}>
              <strong>{who}Coverage.</strong> {counts.join(', ')}, finish {finished}, out of {rows.length}.
            </li>,
            ...Array.from({ length: miles }, (_, i) => {
              // Grouped by what each runner's mile came off, with the weight the
              // later of the two carries, which is what says how far to trust it.
              const off = new Map<string, { n: number; weight: number }>()
              for (const r of rows) {
                const m = r.miles[i]
                if (!m?.between) continue
                const [lo, hi] = m.between
                const at = (a: typeof lo) =>
                  a === 'start' ? 0 : a === 'finish' ? event.distance : event.markers[a].meters
                const phrase = (a: typeof lo) =>
                  a === 'start' ? 'the gun' : a === 'finish' ? 'the finish' : `the ${anchorLabel(event, a)} mark`
                const key = `${phrase(lo)} and ${phrase(hi)}`
                const weight = ((i + 1) * METERS_PER_MILE - at(lo)) / (at(hi) - at(lo))
                off.set(key, { n: (off.get(key)?.n ?? 0) + 1, weight })
              }
              if (off.size === 0) return null
              const total = [...off.values()].reduce((a, b) => a + b.n, 0)
              return (
                <li key={`${event.squad}-mile-${i + 1}`}>
                  <strong>
                    {who}Mile {i + 1} is interpolated for {total === rows.length ? 'everybody' : `${total} of ${rows.length}`}.
                  </strong>{' '}
                  Nobody stood at it for them.{' '}
                  {[...off].map(([key, { n, weight }]) =>
                    `${n} ${n === 1 ? 'is' : 'are'} between ${key}, where the later one carries about ${Math.round(weight * 100)}% of the weight`,
                  ).join('; ')}
                  .
                </li>
              )
            }),
            guessed.length > 0 ? (
              <li key={`${event.squad}-guessed`}>
                <strong>{who}Timed marks that are actually estimates:</strong> {guessed.join('; ')}.
                Filled in from the marks either side. Shown in the lighter type, same as the
                calculated columns.
              </li>
            ) : null,
          ]
        })}
        {allowances.map((a) => (
          <li key={`${a.distance}-${a.mile}-${a.from.join('/')}`}>
            <strong>
              Mile {a.mile} off {span(a.distance, a.from)} gets a {formatSignedElapsed(a.ms)} allowance.
            </strong>{' '}
            A straight line over a longer stretch ignores the closing kick and reads fast.
            The {a.calibrators} {a.calibrators === 1 ? 'runner' : 'runners'} with both {span(a.distance, a.from)}{' '}
            and {span(a.distance, a.onto)} let that be measured rather than guessed, and this is
            what they measured at this meet. It is recalculated per meet, not stored.
          </li>
        ))}
        <li>
          <strong>Every station's gun was corrected by hand.</strong> Three of the four
          volunteers started late — by 2.3 s, 6.6 s and 9.5 s — and the offsets came out
          of the absolute clock times, not out of what anyone remembered pressing. The
          2.6 mile operator reported being "3 to 4 seconds" late and the phone recorded
          9.5. This table is the corrected version; the raw exports are not in it.
        </li>
        <li>
          <strong>The PR column is the one they came in with.</strong> A highlighted row
          beat the time in it at this meet. It has not been written back to anybody's
          record here.
        </li>
        <li>
          <strong>Segment paces are over their true distance.</strong> The first, middle
          and last stretches are each divided by the distance between the markers that
          bound them, and labelled with it.
        </li>
        <li>
          <strong>Nets and vs-PR are signed seconds.</strong> Minus is faster: a
          negative net is a mile quicker than the one before it, a negative vs-PR is a
          new PR.
        </li>
        <li>
          <strong>Spread is the consistency number. The Delta is not.</strong> Spread is
          the slowest mile less the fastest, so zero is identical miles and it is the
          column to read for how even a race was. The Delta is how far the average mile
          sits from the middle of that fastest–slowest range, which answers a different
          question — whether one mile was an outlier, or all of them stepped evenly. A
          runner who slows by the same amount every mile has a Delta near zero whatever
          their spread, so the two disagree constantly and neither one substitutes for
          the other.
        </li>
      </ul>
    </section>
  )
}
