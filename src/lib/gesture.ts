/**
 * Telling a tap apart from the start of a scroll.
 *
 * The name buttons record a crossing and they sit in a grid that scrolls, so a
 * finger that lands on a name only to drag the list past it has to record
 * nothing at all. See DESIGN.md for why the time is still taken on the way
 * down.
 */

/**
 * How far a finger may travel and still count as a tap, in CSS pixels. Ten is
 * about where a browser itself decides a touch is a pan, so a press that stays
 * inside this is one the browser has not taken over either.
 */
export const TAP_SLOP = 10

export type Point = { x: number; y: number }

/**
 * True once a press has moved far enough to be a scroll rather than a tap.
 * Compared squared, so the handler that runs on every pointer move does no
 * square root.
 */
export function becameScroll(from: Point, to: Point, slop: number = TAP_SLOP): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return dx * dx + dy * dy > slop * slop
}
