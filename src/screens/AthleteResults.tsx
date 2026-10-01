/**
 * One runner's race, in numbers.
 *
 * Reached from a link the coach texts, the team's or her own, so whoever opens
 * this has never seen the app, is on a phone, and is looking for exactly one
 * thing: her own name. So the whole page is a dropdown and then her race — no
 * navigation, no team table she has to scan, nothing to set up. Her own link
 * names her and the race, and opens on it.
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

import { useEffect, useState } from 'react'
import { formatElapsed, formatIsoDate, formatPr, formatSignedElapsed } from '../lib/clock'
import { METERS_PER_MILE } from '../lib/distance'
import { athleteFromHash, athleteHash, labelFor } from '../lib/link'
import { type Anchor, anchorLabel, comparesToPr, type Event, meetRows, mileage, repeatsAMile, type Row } from '../lib/meet'
import { type ResultsPage, seasonName } from '../lib/pages'
import { degrees, feelsLike, readingAt, type Weather } from '../lib/weather'
import {
  firstRace,
  isHandedOut,
  markIndex,
  racesOf,
  type SeasonMeet,
  type SeasonRace,
  seasonLabels,
  seasonMarks,
  seasonRows,
} from '../lib/season'

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
  // Her own link names her and the race, so she lands on it without picking.
  const [opened] = useState(() => athleteFromHash(window.location.hash))
  const [picked, setPicked] = useState(opened.name ?? '')
  /** The race on screen, by slug, once she has picked one other than her first. */
  const [chosen, setChosen] = useState(opened.meet ?? '')

  const loading = meets.some((m) => m.meet === undefined)
  const loaded = meets.filter((m) => m.meet)
  const labels = seasonLabels(loaded)
  // A name from a link that no meet has, misspelt or from a label that has since
  // changed, is no name: she gets the picker, as if the link had not named her.
  const name = labelFor(picked, labels)
  const races = name ? racesOf(name, loaded) : []
  const race = races.find((r) => r.published.slug === chosen) ?? firstRace(page, races)
  const row = race?.meet
    ? meetRows(race.meet)
        .flatMap((e) => e.rows)
        .find((r) => r.observed.label === name)
    : undefined

  // The address follows what is on screen, so a link copied out of it opens the
  // same race. Replaced rather than pushed: picking a name is not a page to go
  // Back through. Not until the files are in, when a name from the link can be
  // told apart from one no meet has.
  const slug = race?.published.slug
  useEffect(() => {
    if (loading) return
    const hash = name ? `#${athleteHash(name, slug)}` : ''
    if (window.location.hash === hash) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hash)
  }, [loading, name, slug])

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
              value={name}
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
            <>
              <Race row={row} weather={race?.meet?.weather} />
              {races.length > 1 && (
                <Season
                  races={seasonRows(name, races).reverse()}
                  showing={race!.published.slug}
                  onPick={setChosen}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Race({ row, weather }: { row: Row; weather?: Weather }) {
  const { observed, event } = row
  const first = event.markers[0]?.meters ?? 0
  const opening = row.opening && repeatsAMile(0, row.opening.meters) ? undefined : row.opening
  const middle = row.middle && repeatsAMile(first, row.middle.meters) ? undefined : row.middle
  const { closing, plan } = row
  const calculated = row.miles.filter((m) => !m.timed)
  const planned = observed.plan
  const planTimes = plan?.opening?.time != null || plan?.closing?.time != null
  const conditions = readingAt(weather, event.gun)

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
        The conditions from the reading nearest her gun: the heat, the heat index
        when it is a different number, and the humidity, the ones a runner feels.
        Not the station, the wind or the sky.
      */}
      {conditions && (
        <p className="hint conditions-line">
          {[degrees(conditions.tempF), feelsLike(conditions)].filter(Boolean).join(', ')}
          {conditions.humidity != null && ` and ${Math.round(conditions.humidity)}% humidity`} at the gun
        </p>
      )}

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
      {/*
        A plan column only when the coach's sheet gave stretch times, and then the
        times as the sheet has them.
      */}
      {(opening != null || closing != null) && (
        <section className="marks">
          <h2>The two ends of the race</h2>
          <table>
            {planTimes && (
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
                  {planTimes && (
                    <td className="plan">{plan?.opening?.time != null ? formatElapsed(plan.opening.time) : ''}</td>
                  )}
                  <td>{formatElapsed(opening.time)}</td>
                </tr>
              )}
              {closing != null && (
                <tr>
                  <th scope="row">Last {mileage(closing.meters)}</th>
                  {planTimes && (
                    <td className="plan">{plan?.closing?.time != null ? formatElapsed(plan.closing.time) : ''}</td>
                  )}
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
        race's, exactly as the coach's sheet has it. A column and not
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
                  {plan && <td className="plan">{plan.opening?.pace != null ? pace(plan.opening.pace) : ''}</td>}
                  <td>{pace(opening.pace)}</td>
                </tr>
              )}
              {middle != null && (
                <tr>
                  <th scope="row">Middle {mileage(middle.meters)}</th>
                  {plan && <td className="plan">{plan.middle?.pace != null ? pace(plan.middle.pace) : ''}</td>}
                  <td>{pace(middle.pace)}</td>
                </tr>
              )}
              {closing != null && (
                <tr>
                  <th scope="row">Last {mileage(closing.meters)}</th>
                  {plan && <td className="plan">{plan.closing?.pace != null ? pace(plan.closing.pace) : ''}</td>}
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
        got there. Two columns and no third for the gap between them: the two times
        side by side already say it.

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
              </tr>
            </thead>
          )}
          <tbody>
            {where.map((w) => (
              <tr key={w.meters}>
                <th scope="row">{w.says}</th>
                {planned && <td className="plan">{w.plan != null ? formatElapsed(w.plan) : ''}</td>}
                <td>{formatElapsed(w.at)}</td>
              </tr>
            ))}
            {observed.finish != null && (
              <tr>
                <th scope="row">Finish</th>
                {planned && <td className="plan" />}
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

/**
 * Her races side by side, a column each, oldest to newest so the season reads left
 * to right. One row per mark, and each whole mile's pace after the mark it ends at,
 * but not mile 1's where it is the 1 mi mark again. A mark a meet did not time is a blank, never an
 * estimate, and the note under the table says which marks each meet had, so a blank
 * does not read as a slow mile. Two 5Ks are compared straight, with nothing said
 * about the courses; a race at another distance says its distance.
 *
 * Never the plan, which is per race and is already beside that race above.
 */
function Season({
  races,
  showing,
  onPick,
}: {
  races: SeasonRace[]
  showing: string
  onPick: (slug: string) => void
}) {
  const marks = seasonMarks(races)
  const miles = Math.max(0, ...races.map((r) => r.row.miles.length))
  const anyPr = races.some((r) => r.row.vsBest != null)
  // Which meets had which marks, the meets with the same ones together.
  const sets = new Map<string, { marks: string[]; meets: string[] }>()
  for (const r of races) {
    const marks = r.row.event.markers.map((m) => m.label.replace(' mi', ''))
    const key = marks.join(',')
    const set = sets.get(key) ?? { marks, meets: [] }
    if (!set.meets.includes(r.published.name)) set.meets.push(r.published.name)
    sets.set(key, set)
  }
  const calculated = races.some((r) => r.row.miles.some((m) => !m.timed))

  const line = (says: string, cell: (row: Row) => { text: string; soft?: boolean; sign?: number }) => (
    <tr key={says}>
      <th scope="row">{says}</th>
      {races.map((r) => {
        const { text, soft, sign } = cell(r.row)
        return (
          <td
            key={`${r.published.slug}-${r.row.event.squad}`}
            className={[soft ? 'is-soft' : '', sign == null ? '' : sign < 0 ? 'is-down' : 'is-up']
              .filter(Boolean)
              .join(' ')}
          >
            {text}
          </td>
        )
      })}
    </tr>
  )

  return (
    <section className="marks season">
      <h2>Your races side by side</h2>
      <div className="season-scroll">
        <table>
          <thead>
            <tr>
              <td />
              {races.map((r) => (
                <th key={`${r.published.slug}-${r.row.event.squad}`} scope="col">
                  {/* A tap on a race opens it above. */}
                  <button
                    type="button"
                    className={r.published.slug === showing ? 'is-on' : ''}
                    aria-pressed={r.published.slug === showing}
                    onClick={() => onPick(r.published.slug)}
                  >
                    {formatIsoDate(r.published.date).replace(/^\w+, /, '')}
                    <span className="sub">
                      {r.published.name}
                      {comparesToPr(r.row.event.distance) ? '' : `, ${r.row.event.distance} m`}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line('Finish', (r) => ({ text: r.observed.finish == null ? '' : formatPr(r.observed.finish) }))}
            {line('Pace', (r) => ({ text: r.average == null ? '' : pace(r.average) }))}
            {anyPr &&
              line('vs PR', (r) => ({
                text: r.vsBest == null ? '' : formatSignedElapsed(r.vsBest),
                sign: r.vsBest ?? undefined,
              }))}
            {/*
              Course order: each mark, and each mile's pace straight after the mark
              that ends it, or after the last mark before it where nobody stood at
              the mile.
            */}
            {[
              ...marks.map((mark) => ({ meters: mark.meters, mark })),
              ...Array.from({ length: miles }, (_, k) => ({ meters: (k + 1) * METERS_PER_MILE + 1, mile: k })).filter(
                // Mile 1's pace is the 1 mi mark again wherever somebody stood there,
                // so it only gets a row when some meet had to calculate it.
                ({ mile }) => mile > 0 || races.some((r) => r.row.miles[0] && !r.row.miles[0].timed),
              ),
            ]
              .sort((a, b) => a.meters - b.meters)
              .map((place) =>
                'mark' in place
                  ? line(place.mark.label, (r) => {
                      const i = markIndex(r, place.mark)
                      const at = i < 0 ? null : r.observed.times[i]
                      return { text: at == null ? '' : formatElapsed(at) }
                    })
                  : line(`Mile ${place.mile + 1} pace`, (r) => {
                      const m = r.miles[place.mile]
                      return { text: m ? formatElapsed(m.split) : '', soft: m != null && !m.timed }
                    }),
              )}
          </tbody>
        </table>
      </div>
      <p className="hint">
        A mark is the time since the gun. A mile&rsquo;s pace is that mile on its own.
        {calculated && ' A lighter pace is calculated, because nobody stood at that mile.'}{' '}
        {sets.size === 1
          ? 'A blank is a mark where nobody caught you.'
          : `${[...sets.values()]
              .map(({ marks, meets }) => `${listOf(meets)} timed ${listOf(marks)} mi`)
              .join('. ')}. A blank is a mark that meet did not have, or one where nobody caught you.`}
      </p>
    </section>
  )
}

/** "0.5, 1, 2 and 2.6", or two meets' names with an "and". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
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
