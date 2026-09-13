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
 * No commentary. Her splits, her miles, her marks, and which of them nobody timed.
 * What the race meant is the coach's to say, not a page's, and a number is the same
 * number whoever reads it.
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
          Her best coming in, and the gap, stated and not characterised. A minus is
          a new best; the courses being different is a fact she can weigh herself.
        */}
        {observed.best != null && row.vsBest != null && (
          <p className="finish-best">
            Best coming in {formatPr(observed.best)}
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
          Mile 3 is worked out from the {observed.mile26 != null ? '2.6 mile mark' : '2 mile mark'}{' '}
          and your finish, because nobody stands at 3 miles.
          {isDerived(row, 'mile1') && ' Mile 1 is worked out too.'}
        </p>
      </section>

      {/*
        Opening pace and closing pace against the race average. These exist only
        where a volunteer stood at 0.5 mi and 2.6 mi, and they are the reason those
        two markers are worth a person each even though neither is a mile.
      */}
      {(row.openPace != null || row.kickPace != null) && row.average != null && (
        <section className="marks">
          <h2>The two ends of the race</h2>
          <table>
            <tbody>
              {row.openPace != null && (
                <tr>
                  <th scope="row">First half mile</th>
                  <td>{pace(row.openPace)} per mile</td>
                </tr>
              )}
              <tr>
                <th scope="row">Whole 5K</th>
                <td>{pace(row.average)} per mile</td>
              </tr>
              {row.kickPace != null && (
                <tr>
                  <th scope="row">Last 800</th>
                  <td>{pace(row.kickPace)} per mile</td>
                </tr>
              )}
            </tbody>
          </table>
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
                  {isDerived(row, key) && <span className="soft"> worked out</span>}
                </td>
              </tr>
            ))}
            {row.threeMile != null && (
              <tr>
                <th scope="row">3 miles</th>
                <td>
                  {formatElapsed(row.threeMile)}
                  <span className="soft"> worked out</span>
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
