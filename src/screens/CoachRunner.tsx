/**
 * One runner's season for the coach: every race she ran, a row each, newest first.
 *
 * The race table turned on its side. That one is a meet with a row per runner;
 * this is a runner with a row per meet, and the columns are the same numbers in the
 * same formats, so a second mile here is the second mile there. Marks line up by
 * distance across meets, and a mark a meet did not time is a blank. Nothing is
 * estimated to fill a column, and nothing says what the races meant.
 *
 * Reached from her name in the race table, at the coach address with her name in
 * the fragment. Never the link that is texted to her; that is the icon beside it.
 */

import { formatIsoDate, formatPr } from '../lib/clock'
import { comparesToPr, isDerived, type Marker, type PlanStretch, type Segment } from '../lib/meet'
import { markIndex, type SeasonRace, seasonMarks } from '../lib/season'
import { cellClass, type Column, head, MILE_2_ALLOWED_MS, pace, sign, softMile, time } from './coachColumns'

type Props = {
  label: string
  races: SeasonRace[]
  onBack: () => void
}

const squad = (r: SeasonRace) => (r.row.event.squad === 'jv' ? 'JV' : 'Varsity')

/**
 * The columns. The finish and what it is measured against first, since that is
 * what a season is compared on; then every mark, the whole miles and their nets,
 * the three stretches, and the plan where there was one.
 */
function seasonColumns(races: SeasonRace[]): Column[] {
  const rows = races.map((r) => r.row)
  const columns: Column[] = [
    { head: 'Finish', cell: (r) => (r.observed.finish == null ? '' : formatPr(r.observed.finish)) },
    { head: 'Pace', sub: 'per mile', cell: (r) => pace(r.average) },
  ]
  if (rows.some((r) => comparesToPr(r.event.distance))) {
    columns.push(
      { head: 'Previous PR', cell: (r) => (r.observed.best == null ? '' : formatPr(r.observed.best)) },
      { head: 'vs PR', cell: (r) => sign(r.vsBest), signed: true },
    )
  }
  for (const mark of seasonMarks(races)) {
    columns.push({
      head: head(mark.label),
      cell: (r) => {
        const i = markIndex(r, mark)
        return i < 0 ? '' : time(r.observed.times[i])
      },
      derived: (r) => {
        const i = markIndex(r, mark)
        return i >= 0 && isDerived(r, i)
      },
    })
  }
  const miles = Math.max(0, ...rows.map((r) => r.miles.length))
  for (let k = 1; k <= miles; k++) {
    // Lighter where that meet had nobody at the mile, which differs race to race,
    // so it is said per cell and not once in the header.
    const soft = (r: (typeof rows)[number]) => softMile(r, k) || (k > 1 && softMile(r, k - 1))
    columns.push({ head: `Mile ${k}`, sub: 'split', cell: (r) => time(r.miles[k - 1]?.split), derived: soft })
    if (k >= 2) {
      columns.push({
        head: 'Net',
        sub: `vs mile ${k - 1}`,
        cell: (r) => sign(r.miles[k - 1]?.net),
        derived: soft,
        signed: true,
        ...(k === 2 ? { slowWhen: (r) => (r.miles[1]?.net ?? 0) > MILE_2_ALLOWED_MS } : {}),
      })
    }
  }
  const planned = rows.some((r) => r.plan)
  type R = (typeof rows)[number]
  const stretch = (name: string, ran: (r: R) => Segment | undefined, plan: (r: R) => PlanStretch | undefined) => {
    columns.push({ head: name, sub: planned ? 'ran' : 'pace', cell: (r) => pace(ran(r)?.pace) })
    if (planned) columns.push({ head: '', sub: 'plan', cell: (r) => pace(plan(r)?.pace) })
  }
  stretch('First', (r) => r.opening, (r) => r.plan?.opening)
  if (rows.some((r) => r.middle)) stretch('Middle', (r) => r.middle, (r) => r.plan?.middle)
  stretch('Last', (r) => r.closing, (r) => r.plan?.closing)
  if (planned) {
    columns.push(
      { head: 'Finish', sub: 'plan', cell: (r) => (r.plan?.finish == null ? '' : formatPr(r.plan.finish)) },
      { head: 'vs plan', cell: (r) => sign(r.plan?.vsPlan), signed: true },
    )
  }
  return columns
}

export function CoachRunner({ label, races, onBack }: Props) {
  const columns = seasonColumns(races)
  const marks: Marker[] = seasonMarks(races)
  const planned = races.some((r) => r.row.plan)
  return (
    <div className="screen results coach">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>{label}</strong>
          <span>
            {races.length} {races.length === 1 ? 'race' : 'races'} this season
          </span>
        </div>
      </header>

      {races.length === 0 ? (
        <p className="instructions">No races for this runner this season.</p>
      ) : (
        <>
          <section className="coach-event">
            <div className="table-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th scope="col" className="who">
                      Race
                    </th>
                    {columns.map((col, i) => (
                      <th key={i} scope="col">
                        {col.head}
                        {col.sub && <span className="sub">{col.sub}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {races.map((race) => (
                    <tr
                      key={`${race.published.slug}-${race.row.event.squad}`}
                      className={race.row.best ? 'is-best' : ''}
                    >
                      <th scope="row" className="who">
                        {race.published.name}
                        <span className="sub">
                          {formatIsoDate(race.published.date)} · {squad(race)}
                        </span>
                      </th>
                      {columns.map((col, i) => {
                        const text = col.cell(race.row)
                        return (
                          <td key={i} className={cellClass(col, race.row, text)}>
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

          <section className="footnotes">
            <h2>What is measured, and what is not</h2>
            <ul>
              <li>
                <strong>Each mark is one column across meets.</strong>{' '}
                {marks.map((m) => m.label).join(', ')}. A blank is a mark that meet did not
                time, or a runner the volunteer there missed. Nothing is estimated to fill it.
              </li>
              <li>
                <strong>Lighter type is calculated or estimated.</strong> A whole mile nobody
                stood at, and the split and net that rest on it, are interpolated the way the
                race table does it, and so is a timed mark filled in from the marks either side.
              </li>
              <li>
                <strong>The stretches are each meet&rsquo;s own.</strong> First is the gun to that
                meet&rsquo;s first mark, last is its last mark to the finish. Paces are over
                the true distance.
              </li>
              <li>
                <strong>The PR column is the one the runner came in with.</strong> A highlighted
                row beat it. Minus is faster, in nets, vs PR{planned ? ' and vs plan' : ''}.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
