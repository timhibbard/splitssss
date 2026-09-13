/**
 * One runner's race, in numbers.
 *
 * Reached from a link the coach texts the team, so the person opening this has
 * never seen the app, is on a phone, and is looking for exactly one thing: her own
 * name. So the whole page is a dropdown and then her race — no navigation, no
 * team table she has to scan, nothing to set up.
 *
 * She picks from first names and an initial, which is all this build holds.
 *
 * No commentary. Her splits, her miles, her paces, her marks, and which of them
 * nobody timed. What the race meant is the coach's to say, not a page's, and a
 * number is the same number whoever reads it.
 *
 * Deliberately not a leaderboard either. The meet publishes places and the whole
 * field already; what the team's own splits add is where she was and when.
 */

import { useState } from 'react'
import { formatElapsed, formatPr, formatSignedElapsed } from '../lib/clock'
import { isDerived, type Meet, meetRows, type Row } from '../lib/meet'
import type { Published } from '../lib/pages'

type Props = {
  /** `undefined` while the file is still being looked for, `null` if there isn't one. */
  meet: Meet | null | undefined
  /**
   * Which meet's address this is. The page can name the meet from it before the
   * file has loaded, so a runner opening a texted link sees where she is rather
   * than the word "Results" while the fetch is in flight.
   */
  published: Published
  onBack: () => void
}

/** The cumulative marks, in course order, as her own row of the table. */
const MARKS: { key: 'half' | 'mile1' | 'twoMile' | 'mile26'; says: string }[] = [
  { key: 'half', says: 'Half mile' },
  { key: 'mile1', says: '1 mile' },
  { key: 'twoMile', says: '2 miles' },
  { key: 'mile26', says: '2.6 miles' },
]

export function AthleteResults({ meet, published, onBack }: Props) {
  const [picked, setPicked] = useState('')
  const rows = meet ? meetRows(meet) : []
  const row = rows.find((r) => r.observed.label === picked)

  return (
    <div className="screen results">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>{meet?.name ?? published.name}</strong>
          <span>{meet ? 'Your race, mile by mile' : 'One moment'}</span>
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
          <label className="pick">
            <span>Find your name</span>
            {/*
              A native select and not a grid of name buttons, unlike the timing
              screen. There the tap has to land on the right runner while she is
              going past; here nothing is timed, and a phone's own picker is the
              control every person opening this already knows how to use.
            */}
            <select value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">Choose…</option>
              {[...rows]
                .sort((a, b) => a.observed.label.localeCompare(b.observed.label))
                .map((r) => (
                  <option key={r.observed.label} value={r.observed.label}>
                    {r.observed.label}
                  </option>
                ))}
            </select>
          </label>

          {row == null ? (
            <p className="hint">
              {rows.length} of us raced at {meet.name}. Pick your name for your half
              mile, your three miles and your finish.
            </p>
          ) : (
            <Race row={row} />
          )}
        </>
      )}
    </div>
  )
}

function Race({ row }: { row: Row }) {
  const { observed } = row
  return (
    <>
      <section className={`finish-card${row.best ? ' is-best' : ''}`}>
        <p className="finish-label">{observed.label}, 5K</p>
        <p className="finish-time">{observed.finish == null ? '' : formatPr(observed.finish)}</p>
        {row.average != null && (
          <p className="finish-pace">{pace(row.average)} per mile</p>
        )}
        {/*
          Her PR, labelled by whether the time above replaced it: previous when this
          race is the new one, current when it still stands. Which of those two words
          it is *is* the news, so it is the news rather than a sentence about it, and
          the gap is stated and not characterised. The courses being different is a
          fact she can weigh herself.
        */}
        {observed.best != null && row.vsBest != null && (
          <p className="finish-best">
            {row.best ? 'Previous PR' : 'Current PR'} {formatPr(observed.best)}
            <span className={row.vsBest < 0 ? 'is-down' : 'is-up'}>
              {formatSignedElapsed(row.vsBest)}
            </span>
          </p>
        )}
      </section>

      {/*
        The three miles as bars, because the shape is the point and three numbers in
        a row do not have a shape. Widths are relative to the slowest mile, so the
        longest bar is always full and the comparison is between her own three miles
        rather than against some absolute pace nobody has in mind.
      */}
      <section className="miles">
        <h2>Your three miles</h2>
        {row.miles.map((ms, i) => (
          <div key={i} className="mile-row">
            <span className="mile-no">Mile {i + 1}</span>
            <span className="mile-bar">
              <span
                className={`mile-fill${ms === row.fastest ? ' is-fast' : ''}${
                  ms === row.slowest ? ' is-slow' : ''
                }`}
                style={{ width: `${(ms / row.slowest!) * 100}%` }}
              />
            </span>
            <span className="mile-time">{formatElapsed(ms)}</span>
          </div>
        ))}
        <p className="hint">
          Mile 3 is calculated from your{' '}
          {observed.mile26 != null ? '2.6 mile mark' : '2 mile mark'} and your finish.
          {isDerived(row, 'mile1') && ' Mile 1 is calculated too.'}
        </p>
      </section>

      {/*
        The two ends as the time each one took, which is the comparison: the opening
        half mile against the closing one. Both exist only where a volunteer stood at
        0.5 mi and 2.6 mi, and they are the reason those two markers are worth a
        person each even though neither is a mile.

        The closing one is 815.7 m, and is called and paced as a half mile anyway, so
        the pace in the next section is this time doubled. See `lastHalf` in meet.ts.

        Times here and paces in the next section, deliberately not both in both. The
        same number twice under two headings makes a page longer without making it say
        more.
      */}
      {(observed.half != null || row.lastHalf != null) && (
        <section className="marks">
          <h2>The two ends of the race</h2>
          <table>
            <tbody>
              {observed.half != null && (
                <tr>
                  <th scope="row">First half mile</th>
                  <td>{formatElapsed(observed.half)}</td>
                </tr>
              )}
              {row.lastHalf != null && (
                <tr>
                  <th scope="row">Last half mile</th>
                  <td>{formatElapsed(row.lastHalf)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">
            How long each one took. The last one is from the 2.6 mile mark to the line.
          </p>
        </section>
      )}

      {/*
        The same race as four paces, in course order, ending on the average. Going out
        25 s/mile quick and closing 30 s/mile quick are different races with the same
        finish time, and this is the section where that is visible.

        The middle is the 2.1 miles between the two markers rather than "the middle
        two miles", because 0.5 to 2.6 is what was actually timed and rounding it to a
        tidier distance would make the number wrong.

        Only shown when at least one segment pace exists. A JV runner had nobody at
        0.5 mi or 2.6 mi, so hers would be a section containing one number that the
        finish card already prints.
      */}
      {(row.openPace != null || row.middlePace != null || row.kickPace != null) && (
        <section className="marks">
          <h2>Paces</h2>
          <table>
            <tbody>
              {row.openPace != null && (
                <tr>
                  <th scope="row">First half mile</th>
                  <td>{pace(row.openPace)}</td>
                </tr>
              )}
              {row.middlePace != null && (
                <tr>
                  <th scope="row">Middle 2.1 miles</th>
                  <td>{pace(row.middlePace)}</td>
                </tr>
              )}
              {row.kickPace != null && (
                <tr>
                  <th scope="row">Last half mile</th>
                  <td>{pace(row.kickPace)}</td>
                </tr>
              )}
              {row.average != null && (
                <tr>
                  <th scope="row">Whole race</th>
                  <td>{pace(row.average)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">
            Minutes per mile.
            {row.middlePace != null &&
              ' The middle is from your half mile mark to your 2.6 mile mark.'}
          </p>
        </section>
      )}

      <section className="marks">
        <h2>Where you were, and when</h2>
        <table>
          <tbody>
            {MARKS.filter(({ key }) => observed[key] != null).map(({ key, says }) => (
              <tr key={key}>
                <th scope="row">{says}</th>
                <td>
                  {formatElapsed(observed[key]!)}
                  {isDerived(row, key) && <span className="soft"> calculated</span>}
                </td>
              </tr>
            ))}
            {row.threeMile != null && (
              <tr>
                <th scope="row">3 miles</th>
                <td>
                  {formatElapsed(row.threeMile)}
                  <span className="soft"> calculated</span>
                </td>
              </tr>
            )}
            {observed.finish != null && (
              <tr>
                <th scope="row">Finish</th>
                <td>{formatPr(observed.finish)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="hint">
          Every one of these is time since the gun, not the time for that piece on
          its own.
        </p>
      </section>
    </>
  )
}

/** A pace as m:ss. Tenths of a second per mile is precision this does not have. */
function pace(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
