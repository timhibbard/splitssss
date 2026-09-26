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
 * No commentary. Her splits, her miles, her paces and her marks. What the race meant
 * is the coach's to say, not a page's, and a number is the same number whoever reads
 * it.
 *
 * Deliberately not a leaderboard either. The meet publishes places and the whole
 * field already; what the team's own splits add is where she was and when.
 */

import { useState } from 'react'
import { formatElapsed, formatIsoDate, formatPr, formatSignedElapsed } from '../lib/clock'
import { type Anchor, anchorLabel, comparesToPr, type Event, meetRows, mileage, repeatsAMile, type Row } from '../lib/meet'
import { type ResultsPage, seasonName } from '../lib/pages'
import { firstRace, isHandedOut, racesOf, type SeasonMeet, seasonLabels } from '../lib/season'

type Props = {
  /** The season's meets, newest first, each with its file as far as it has loaded. */
  meets: SeasonMeet[]
  /**
   * Which address this is, and the meet it opens on. The page can name the meet
   * from it before the files have loaded, so a runner opening a texted link sees
   * where she is rather than the word "Results" while the fetch is in flight.
   */
  page: ResultsPage
  onBack: () => void
}

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

export function AthleteResults({ meets, page, onBack }: Props) {
  const [picked, setPicked] = useState('')
  /** The race on screen, by slug, once she has picked one other than her first. */
  const [chosen, setChosen] = useState('')

  const loading = meets.some((m) => m.meet === undefined)
  const loaded = meets.filter((m) => m.meet)
  const labels = seasonLabels(loaded)
  const races = picked ? racesOf(picked, loaded) : []
  const race = races.find((r) => r.published.slug === chosen) ?? firstRace(page, races)
  const row = race?.meet
    ? meetRows(race.meet)
        .flatMap((e) => e.rows)
        .find((r) => r.observed.label === picked)
    : undefined

  // Before a name is picked, a texted meet address is about its meet and a season
  // is about the season.
  const title =
    race?.published.name ?? (isHandedOut(page) && page.meet ? page.meet.name : seasonName(page))

  return (
    <div className="screen results">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>{title}</strong>
          <span>{row ? 'Your race, mile by mile' : meets.length === 0 ? 'Results' : loading ? 'One moment' : 'Your races'}</span>
        </div>
      </header>

      {meets.length === 0 ? (
        <p className="instructions">No results for this season yet.</p>
      ) : loading ? (
        <p className="instructions">Looking for the results…</p>
      ) : loaded.length === 0 ? (
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
            <select
              value={picked}
              onChange={(e) => {
                setPicked(e.target.value)
                setChosen('')
              }}
            >
              <option value="">Choose…</option>
              {labels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {race && (
            <label className="pick">
              {/* Only the meets she ran. One she was not at has nothing of hers in it. */}
              <span>Race</span>
              <select value={race.published.slug} onChange={(e) => setChosen(e.target.value)}>
                {races.map(({ published }) => (
                  <option key={published.slug} value={published.slug}>
                    {published.name}, {formatIsoDate(published.date)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {row == null ? (
            <p className="hint">
              {loaded.length === 1
                ? `${labels.length} of us raced at ${loaded[0].published.name}. Pick your name for your marks, your miles and your finish.`
                : `${labels.length} of us raced in ${loaded.length} meets this season. Pick your name for your marks, your miles and your finish at each.`}
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
  const { observed, event } = row
  const first = event.markers[0]?.meters ?? 0
  const opening = row.opening && repeatsAMile(0, row.opening.meters) ? undefined : row.opening
  const middle = row.middle && repeatsAMile(first, row.middle.meters) ? undefined : row.middle
  const { closing, plan } = row
  const calculated = row.miles.filter((m) => !m.timed)
  const planned = observed.plan

  /*
    Every mark somebody stood at and timed her, in course order. Not the whole miles
    nobody stood at: those are arithmetic on two of these, and the miles above
    already say so.
  */
  const where = event.markers.flatMap((marker, i) => {
    const at = observed.times[i]
    return at == null ? [] : [{ meters: marker.meters, says: marker.label, at, plan: planned?.times[i] }]
  })

  return (
    <>
      <section className={`finish-card${row.best ? ' is-best' : ''}`}>
        <p className="finish-label">
          {observed.label}, {comparesToPr(event.distance) ? '5K' : `${event.distance} m`}
        </p>
        {observed.finish == null ? (
          <p className="finish-pace">No finish time</p>
        ) : (
          <p className="finish-time">{formatPr(observed.finish)}</p>
        )}
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
        Her miles as bars, because the shape is the point and three numbers in a row
        do not have a shape. Widths are relative to the slowest mile, so the longest
        bar is always full and the comparison is between her own miles rather than
        against some absolute pace nobody has in mind.
      */}
      {row.miles.length > 0 && (
        <section className="miles">
          <h2>Your {COUNT[row.miles.length] ?? row.miles.length} miles</h2>
          {row.miles.map((m) => (
            <div key={m.mile} className="mile-row">
              <span className="mile-no">Mile {m.mile}</span>
              <span className="mile-bar">
                <span
                  className={`mile-fill${m.split === row.fastest ? ' is-fast' : ''}${
                    m.split === row.slowest ? ' is-slow' : ''
                  }`}
                  style={{ width: `${(m.split / row.slowest!) * 100}%` }}
                />
              </span>
              <span className="mile-time">{formatElapsed(m.split)}</span>
            </div>
          ))}
          {calculated.map((m) => (
            <p key={m.mile} className="hint">
              Mile {m.mile} is calculated from {yours(event, m.between![0])} and{' '}
              {yours(event, m.between![1])}.
            </p>
          ))}
        </section>
      )}

      {/*
        The two ends as the time each one took, which is the comparison: the opening
        stretch against the closing one. Each is named with its length to the tenth of a
        mile, and the pace in the next section is that time over its true distance.

        Times here and paces in the next section, deliberately not both in both. The
        same number twice under two headings makes a page longer without making it say
        more.
      */}
      {(opening != null || closing != null) && (
        <section className="marks">
          <h2>The two ends of the race</h2>
          <table>
            <tbody>
              {opening != null && (
                <tr>
                  <th scope="row">First {mileage(opening.meters)}</th>
                  <td>{formatElapsed(opening.time)}</td>
                </tr>
              )}
              {closing != null && (
                <tr>
                  <th scope="row">Last {mileage(closing.meters)}</th>
                  <td>{formatElapsed(closing.time)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">
            How long each one took.
            {closing != null && ` The last one is from the ${event.markers.at(-1)!.label} mark to the line.`}
          </p>
        </section>
      )}

      {/*
        The same race as paces, in course order, ending on the average. Going out
        25 s/mile quick and closing 30 s/mile quick are different races with the same
        finish time, and this is the section where that is visible.

        The middle is what was actually timed, first marker to last, rather than a
        tidier distance, because rounding it would make the number wrong.

        Only shown when at least one segment pace exists, so it is never a section
        holding one number the finish card already prints.
      */}
      {/*
        With a plan, the plan's pace for each stretch sits in a column beside the
        race's, cut at the same marks and over the same distances. A column and not
        a section, because the plan was set in exactly these stretches and the
        comparison is the point; a second table would be the same rows twice.
      */}
      {(opening != null || middle != null || closing != null) && (
        <section className="marks">
          <h2>Paces</h2>
          <table>
            {plan && (
              <thead>
                <tr>
                  <td />
                  <th scope="col">Plan</th>
                  <th scope="col">Ran</th>
                </tr>
              </thead>
            )}
            <tbody>
              {opening != null && (
                <tr>
                  <th scope="row">First {mileage(opening.meters)}</th>
                  {plan && <td className="plan">{plan.opening ? pace(plan.opening.pace) : ''}</td>}
                  <td>{pace(opening.pace)}</td>
                </tr>
              )}
              {middle != null && (
                <tr>
                  <th scope="row">Middle {mileage(middle.meters)}</th>
                  {plan && <td className="plan">{plan.middle ? pace(plan.middle.pace) : ''}</td>}
                  <td>{pace(middle.pace)}</td>
                </tr>
              )}
              {closing != null && (
                <tr>
                  <th scope="row">Last {mileage(closing.meters)}</th>
                  {plan && <td className="plan">{plan.closing ? pace(plan.closing.pace) : ''}</td>}
                  <td>{pace(closing.pace)}</td>
                </tr>
              )}
              {row.average != null && (
                <tr>
                  <th scope="row">Whole race</th>
                  {/* The planned finish as a pace is still the planned finish. */}
                  {plan && <td className="plan" />}
                  <td>{pace(row.average)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">
            Minutes per mile.
            {middle != null &&
              ` The middle is from your ${event.markers[0].label} mark to your ${event.markers.at(-1)!.label} mark.`}
          </p>
        </section>
      )}

      {/*
        With a plan, the time she was aiming for at each mark sits beside the time she
        got there, and the gap between them, so where the race came off the plan is
        a column to run a finger down rather than a subtraction per row.

        Never the planned finish, here or anywhere on this page. It is the one plan
        number she would read, and a finish that missed it would be all she took
        away from marks that went to plan.
      */}
      <section className="marks">
        <h2>Where you were, and when</h2>
        <table>
          {planned && (
            <thead>
              <tr>
                <td />
                <th scope="col">Plan</th>
                <th scope="col">Ran</th>
                <th scope="col">Vs plan</th>
              </tr>
            </thead>
          )}
          <tbody>
            {where.map((w) => (
              <tr key={w.meters}>
                <th scope="row">{w.says}</th>
                {planned && <td className="plan">{w.plan != null ? formatElapsed(w.plan) : ''}</td>}
                <td>{formatElapsed(w.at)}</td>
                {planned && <VsPlan ran={w.at} plan={w.plan} />}
              </tr>
            ))}
            {observed.finish != null && (
              <tr>
                <th scope="row">Finish</th>
                {planned && <td className="plan" />}
                <td>{formatPr(observed.finish)}</td>
                {planned && <td className="vs" />}
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

/** How far behind (+) or ahead (−) of the plan she was, or nothing when there is no plan time there. */
function VsPlan({ ran, plan }: { ran: number; plan: number | null | undefined }) {
  if (plan == null) return <td className="vs" />
  const off = ran - plan
  return <td className={`vs ${off < 0 ? 'is-down' : 'is-up'}`}>{formatSignedElapsed(off)}</td>
}

/** A known time as it reads in a sentence to her: "your 2.6 mi mark", "the gun". */
function yours(event: Event, anchor: Anchor): string {
  if (anchor === 'start') return 'the gun'
  if (anchor === 'finish') return 'your finish'
  return `your ${anchorLabel(event, anchor)} mark`
}

/** A pace as m:ss. Tenths of a second per mile is precision this does not have. */
function pace(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
