/**
 * The column machinery the two coach tables share: the race table, one row per
 * runner, and a runner's season, one row per race. Same formats and the same
 * lighter type for anything calculated, so a number reads the same in both.
 */

import { formatElapsed, formatSignedElapsed } from '../lib/clock'
import { isDerived, type Row } from '../lib/meet'

/**
 * The columns, in the order the spreadsheet has them, which is course order with
 * each derived number immediately after the marks it came from. A split next to
 * its own net is the comparison; a split three columns from its net is arithmetic
 * to do in your head.
 *
 * `soft` marks a column whose every value is interpolated, so the header can say
 * so once instead of the body marking each cell.
 */
export type Column = {
  head: string
  /** Short enough for a phone's column, since the header row is the widest thing. */
  sub?: string
  soft?: boolean
  cell: (row: Row) => string
  /** Whether this particular runner's value was reconstructed. */
  derived?: (row: Row) => boolean
  /** Signed, and coloured by sign: a net or a gap to a PR. */
  signed?: boolean
  /**
   * When a signed plus counts as slower enough to colour. Without it any plus
   * does; with it, a plus it says no to prints plain.
   */
  slowWhen?: (row: Row) => boolean
}

/**
 * How much slower mile 2 can be than mile 1 before its net is coloured. The
 * coach expects a second mile to come back slower than an opening one — the start
 * is fast — so a few seconds up is the race going to plan and not something to
 * flag. Only the colour: the number in the cell is the same number either way.
 */
export const MILE_2_ALLOWED_MS = 30_000

export const time = (ms: number | null | undefined) => (ms == null ? '' : formatElapsed(ms))
export const sign = (ms: number | undefined) => (ms == null ? '' : formatSignedElapsed(ms))
/** A pace as m:ss. Tenths of a second per mile is precision this does not have. */
export const pace = (ms: number | undefined) => {
  if (ms == null) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** A column head for a distance: "½ mi" reads faster in a header than "0.5 mi". */
export const head = (label: string) => label.replace(/^0\.5 mi$/, '½ mi')

/** Whether a runner's mile k (1-based) was interpolated, or rests on one that was. */
export const softMile = (r: Row, k: number) => {
  const m = r.miles[k - 1]
  return m != null && (!m.timed || (m.marker != null && isDerived(r, m.marker)))
}

/** A cell's classes: lighter for calculated, and coloured by sign where the column is signed. */
export function cellClass(col: Column, row: Row, text: string): string {
  const soft = col.soft || (col.derived?.(row) ?? false)
  return [
    soft ? 'is-soft' : '',
    col.signed && text.startsWith('-') ? 'is-down' : '',
    col.signed && text.startsWith('+') && (col.slowWhen?.(row) ?? true) ? 'is-up' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
