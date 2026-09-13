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
import { resultsLink } from '../lib/link'
import { isDerived, kickAllowance, type Mark, type Meet, meetRows, type Row } from '../lib/meet'
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

const time = (ms: number | undefined) => (ms == null ? '' : formatElapsed(ms))
const sign = (ms: number | undefined) => (ms == null ? '' : formatSignedElapsed(ms))
/** A pace as m:ss. Tenths of a second per mile is precision this does not have. */
const pace = (ms: number | undefined) => {
  if (ms == null) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const COLUMNS: Column[] = [
  { head: 'Pace', sub: 'per mile', cell: (r) => pace(r.average) },
  { head: '½ mi', cell: (r) => time(r.observed.half), derived: (r) => isDerived(r, 'half') },
  { head: '1 mi', cell: (r) => time(r.observed.mile1), derived: (r) => isDerived(r, 'mile1') },
  { head: '2 mi', cell: (r) => time(r.observed.twoMile), derived: (r) => isDerived(r, 'twoMile') },
  { head: 'Mile 2', sub: 'split', cell: (r) => time(r.mile2Split) },
  { head: 'Net', sub: 'vs mile 1', cell: (r) => sign(r.net1), signed: true },
  { head: '2.6 mi', cell: (r) => time(r.observed.mile26), derived: (r) => isDerived(r, 'mile26') },
  { head: 'Middle', sub: '½–2.6 pace', cell: (r) => pace(r.middlePace) },
  { head: '3 mi', sub: 'calculated', soft: true, cell: (r) => time(r.threeMile) },
  { head: 'Mile 3', sub: 'split', soft: true, cell: (r) => time(r.mile3Split) },
  { head: 'Net', sub: 'vs mile 2', soft: true, cell: (r) => sign(r.net2), signed: true },
  { head: 'Last ½ mi', cell: (r) => time(r.lastHalf) },
  { head: 'Finish', cell: (r) => (r.observed.finish == null ? '' : formatPr(r.observed.finish)) },
  // "Previous PR", not "Best coming in". PR is the word the team says, and
  // "previous" carries what "coming in" was there for: this is the time they
  // arrived with, and a highlighted row has beaten it.
  { head: 'Previous PR', cell: (r) => (r.observed.best == null ? '' : formatPr(r.observed.best)) },
  { head: 'vs PR', cell: (r) => sign(r.vsBest), signed: true },
]

/**
 * The three miles against each other, for the view that is about how consistent
 * each race was rather than where each mark was taken.
 *
 * Spread is the consistency column: slowest mile less fastest, in seconds, which is
 * the whole question in one number. The Delta is a different question — how far the
 * average mile sits from the middle of that range, which says whether one mile was an
 * outlier or all three stepped evenly — and its sub-label names its inputs, since the
 * name Delta does not and "middle mile", which used to sit there, named the wrong
 * ones.
 */
const BY_MILE: Column[] = [
  { head: 'Mile 1', cell: (r) => time(r.observed.mile1), derived: (r) => isDerived(r, 'mile1') },
  { head: 'Mile 2', cell: (r) => time(r.mile2Split) },
  { head: 'Mile 3', sub: 'calculated', soft: true, cell: (r) => time(r.mile3Split) },
  { head: 'Fastest', cell: (r) => time(r.fastest) },
  { head: 'Slowest', cell: (r) => time(r.slowest) },
  {
    head: 'Spread',
    sub: 'how consistent',
    cell: (r) => (r.fastest == null ? '' : formatElapsed(r.slowest! - r.fastest!)),
  },
  { head: 'Pace', sub: 'per mile', cell: (r) => pace(r.average) },
  { head: 'Delta', sub: 'avg vs midrange', cell: (r) => time(r.delta) },
  { head: 'Open', sub: 'first ½ mi', cell: (r) => pace(r.openPace) },
  { head: 'Kick', sub: 'last ½ mi', cell: (r) => pace(r.kickPace) },
]

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

  const rows = meet ? meetRows(meet) : []
  const columns = view === 'course' ? COLUMNS : BY_MILE

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
          <span>{meet ? `${meet.date} · ${rows.length} runners` : 'One moment'}</span>
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
                      {row.observed.squad && <span className="sub">{row.observed.squad === 'jv' ? 'JV' : 'V'}</span>}
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

          <Footnotes meet={meet} rows={rows} />
        </>
      )}
    </div>
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
function Footnotes({ meet, rows }: { meet: Meet; rows: Row[] }) {
  const allowance = kickAllowance(meet.runners)
  const both = meet.runners.filter((r) => r.mile26 != null && r.twoMile != null).length
  const onMile26 = rows.filter((r) => r.anchor === 'mile26').length
  const onTwoMile = rows.filter((r) => r.anchor === 'twoMile').length
  const guessed = rows.flatMap((r) =>
    r.observed.derived.length > 0 ? [`${r.observed.label} (${r.observed.derived.join(', ')})`] : [],
  )
  const counts = (mark: Mark) => rows.filter((r) => r.observed[mark] != null).length

  return (
    <section className="footnotes">
      <h2>What is measured, and what is not</h2>
      <ul>
        <li>
          <strong>Coverage.</strong> Half mile {counts('half')}, mile 1 {counts('mile1')}, two mile{' '}
          {counts('twoMile')}, 2.6 mile {counts('mile26')}, finish {counts('finish')}, out of{' '}
          {rows.length}.
        </li>
        <li>
          <strong>The 3 mile mark is interpolated for everybody.</strong> Nobody stood
          at 3 miles. {onMile26} {onMile26 === 1 ? 'runner is' : 'runners are'} anchored on
          the 2.6 mile mark, where the finish carries about 79% of the weight, and{' '}
          {onTwoMile} on the 2 mile mark, where it carries about 90%. Being that close
          to the line is why it holds up: a six second error at 2.6 miles comes through
          here as about one second.
        </li>
        {allowance !== 0 && (
          <li>
            <strong>The 2 mile anchor gets a {formatSignedElapsed(allowance)} allowance.</strong>{' '}
            A straight line from 2 miles to the finish ignores the closing kick and
            reads fast. The {both} runners with both marks let that be measured rather
            than guessed, and this is what they measured at this meet. It is
            recalculated per meet, not stored.
          </li>
        )}
        {guessed.length > 0 && (
          <li>
            <strong>Timed marks that are actually estimates:</strong> {guessed.join('; ')}
            . Filled in from the marks either side. Shown in the lighter type, same as
            the 3 mile columns.
          </li>
        )}
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
          <strong>Nets and vs-PR are signed seconds.</strong> Minus is faster: a
          negative net is a mile quicker than the one before it, a negative vs-PR is a
          new PR.
        </li>
        <li>
          <strong>Spread is the consistency number. The Delta is not.</strong> Spread is
          the slowest mile less the fastest, so zero is three identical miles and it is
          the column to read for how even a race was. The Delta is how
          far the average mile sits from the middle of that fastest–slowest range, which
          answers a different question — whether one mile was an outlier, or all three
          stepped evenly. A runner who slows by the same amount every mile has a Delta
          near zero whatever their spread, so the two disagree constantly and neither one
          substitutes for the other.
        </li>
      </ul>
    </section>
  )
}
