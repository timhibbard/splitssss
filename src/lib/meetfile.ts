// Explicit extensions: see the note in link.ts.
import { base64UrlToBytes, bytesToBase64Url } from './base64.ts'
import { type Meet, meetText, parseMeet } from './meet.ts'
import { mask } from './scramble.ts'

/**
 * A meet's reconciled results, shipped with the build the same way the team list
 * is, and for the same reasons.
 *
 * Scrambled, not encrypted. The whole argument is in teamfile.ts and it applies
 * here without change: the page reads this with nothing supplied by a human, so
 * the way to read it ships in the JavaScript. What it buys is that the times of
 * minors are not plaintext in a public repository and not indexable, which is
 * exactly what .gitignore's rule about athlete data is protecting.
 *
 * The labels inside are the short form, "Rowan H.", never full names, which is
 * also what the athlete page shows. A 5K finish time is already published next to
 * a full name on the meet's own results page; the splits are not published
 * anywhere, and they are the part that belongs to the team.
 *
 * One file per meet rather than one file holding a season, so a fixed result from
 * September is not rewritten every time October's splits arrive. Adding a meet is
 * adding the file and a line in PUBLISHED, in pages.ts, which is also what gives
 * the meet its address. Where the file sits is meetFilePath, next to that list, so
 * the results of two seasons' worth of the same invitational do not collide.
 */

/**
 * Its own key and its own header, so a team file served under a results file's
 * name is a clean rejection rather than a plausible-looking mess. Different
 * keystreams mean the bytes do not even decode to text.
 *
 * v2 is the event-shaped meet, markers declared per event. There is no v1 reader:
 * every shipped file was regenerated from its source when the format changed, so a
 * compatibility path would have nothing left to read, and a v1 body under this key
 * decodes to noise and is refused like any other stranger.
 */
const KEY = 'splitssss/meet/v2'
const HEADER = 'splitssss meet v2'
const FOOTER = 'splitssss end'

export function scrambleMeet(meet: Meet): string {
  const text = [HEADER, meetText(meet), FOOTER].join('\n')
  return bytesToBase64Url(mask(new TextEncoder().encode(text), KEY))
}

/**
 * Null for anything that is not a whole meet file: a truncated body, an unrelated
 * file, a meet with no runners in it, an event with no markers, a meet with no
 * team — anything parseMeet refuses. Half a results table is never an answer —
 * an athlete scrolling to her own name and not finding it would conclude she was
 * left out, when in fact the download was cut short.
 */
export function unscrambleMeet(body: string): Meet | null {
  const bytes = base64UrlToBytes(body.trim())
  if (!bytes || bytes.length === 0) return null
  const lines = new TextDecoder().decode(mask(bytes, KEY)).split('\n')
  if (lines.length < 3) return null
  if (lines[0] !== HEADER || lines[lines.length - 1] !== FOOTER) return null
  let meet: Meet
  try {
    meet = parseMeet(lines.slice(1, -1).join('\n'))
  } catch {
    return null
  }
  return meet.events.some((e) => e.runners.length > 0) ? meet : null
}

/**
 * Looks for a shipped results file. A build without one is the normal case for
 * anyone who clones this repo, so absent is not an error and never surfaces as
 * one: the page says the results are not on this build yet.
 */
export async function fetchMeet(url: string): Promise<Meet | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return unscrambleMeet(await res.text())
  } catch {
    return null
  }
}
