import type { Best } from '../lib/bestsfile'
import { formatIsoDate, formatPlanned, formatPr } from '../lib/clock'
import { mileage, type Row } from '../lib/meet'
import type { Published } from '../lib/pages'

type Props = {
  row: Row
  published: Published
  /** Her PR and season best from the coach's list, when the season has one. */
  best?: Best
  onClose: () => void
}

/**
 * Her race plan on one card, the shape the coach prints four to a page: the plan's
 * finish and her bests, where to be at each mark, and each stretch's pace and time.
 * Before the race only, like the plan it is made from. Print gives the card alone,
 * a quarter of a letter sheet, for a pocket or a bag.
 */
export function PlanCard({ row, published, best, onClose }: Props) {
  const { event, plan, observed } = row
  const first = event.markers[0]
  const last = event.markers.at(-1)
  const stretches =
    first && last
      ? [
          { says: `First ${mileage(first.meters)}`, s: plan?.opening },
          ...(event.markers.length > 1 ? [{ says: `Middle ${mileage(last.meters - first.meters)}`, s: plan?.middle }] : []),
          { says: `Last ${mileage(event.distance - last.meters)}`, s: plan?.closing },
        ].filter((x) => x.s?.pace != null)
      : []
  const marks = event.markers.flatMap((marker, i) => {
    const at = observed.plan?.times[i]
    return at == null ? [] : [{ says: marker.label, at }]
  })
  const pr = best?.pr ?? observed.best
  const sb = best?.sb
  return (
    <div className="screen results plan-card-screen">
      <header className="bar">
        <button type="button" className="back" onClick={onClose}>
          Back
        </button>
        <div className="bar-where">
          <strong>{published.name}</strong>
          <span>Race plan card</span>
        </div>
      </header>

      <article className="plan-card">
        <header>
          <h2>{observed.label}</h2>
          {plan?.finish != null && (
            <div className="plan-card-goal">
              <span>Plan</span>
              {formatPlanned(plan.finish)}
            </div>
          )}
        </header>
        <p className="plan-card-meet">
          {published.name}, {formatIsoDate(published.date)}
        </p>
        {(pr != null || sb != null) && (
          <p className="plan-card-bests">
            {pr != null && (
              <>
                PR <b>{formatPr(pr)}</b>
              </>
            )}
            {pr != null && sb != null && ' · '}
            {sb != null && (
              <>
                Season best <b>{formatPr(sb)}</b>
              </>
            )}
          </p>
        )}
        {(marks.length > 0 || plan?.finish != null) && (
          <>
            <h3>Times to hit</h3>
            <table className="plan-card-marks">
              <tbody>
                {marks.map((m) => (
                  <tr key={m.says}>
                    <th scope="row">{m.says}</th>
                    <td>{formatPlanned(m.at)}</td>
                  </tr>
                ))}
                {plan?.finish != null && (
                  <tr className="plan-card-finish">
                    <th scope="row">Finish</th>
                    <td>{formatPlanned(plan.finish)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
        {stretches.length > 0 && (
          <>
            <h3>The plan</h3>
            <table className="plan-card-stretch">
              <thead>
                <tr>
                  <td />
                  <th scope="col">Pace</th>
                </tr>
              </thead>
              <tbody>
                {stretches.map(({ says, s }) => (
                  <tr key={says}>
                    <th scope="row">{says}</th>
                    <td>{s!.pace != null ? `${perMile(s!.pace)}/mi` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </article>

      <button type="button" className="primary plan-card-print" onClick={() => window.print()}>
        Print
      </button>
    </div>
  )
}

/** A stretch's pace as the coach's sheet writes it, m:ss a mile. */
function perMile(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
