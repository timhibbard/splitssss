// Explicit extensions: see the note in link.ts.
import { base64UrlToBytes, bytesToBase64Url } from './base64.ts'
import { parseRoster } from './roster.ts'
import type { Athlete } from './types'

/**
 * The team list that ships with the build, so a phone opens with the names
 * already on it. No link to text, no passphrase to type, nothing to explain to a
 * parent who got handed the job ten minutes ago.
 *
 * What this is and is not, stated plainly, because the difference matters and the
 * names belong to minors:
 *
 * - This is **obfuscation, not encryption**. The page reads this file with no
 *   human supplying anything, so the way to read it ships in the JavaScript, so
 *   anyone who wants the list can have it. There is no version of automatic that
 *   is also secret.
 * - What it does buy is real but narrow: the names are not plaintext in a public
 *   repository, not in a file a crawler can index, and not readable by someone
 *   who happens to look. Search for a runner and this app is not the result.
 * - So the list that ships here is deliberately the short form, "Caroline K.",
 *   the same thing the buttons say. Decoded, it is first names and an initial for
 *   a team whose roster a meet program prints anyway, rather than a file of full
 *   names.
 * - Full names never travel this way. They go by roster link or by the encrypted
 *   `roster.enc`, both of which need something a person has to supply.
 *
 * The keystream is a fixed xorshift, which is why this file is deterministic: the
 * same list rebuilds byte for byte, so a rebuild with no roster change is not a
 * diff. Nothing here is meant to resist an attacker, so nothing here pretends to.
 */

/** Precached with the app, so it is there with no signal at the two mile mark. */
export const TEAM_FILE = 'team.dat'

/**
 * The decoded text starts with one and ends with the other. Random bytes will not
 * produce either, so together they tell a corrupt or unrelated file from a real
 * one, in place of the integrity check that real encryption would give.
 *
 * The last line is the one that matters most: a download cut short would
 * otherwise decode to a short list ending in half a name, and half a name on a
 * button is a runner a volunteer cannot find.
 */
const HEADER = 'splitssss team v1'
const FOOTER = 'splitssss end'

const KEY = 'splitssss/team/v1'

/** FNV-1a over the key, purely to turn a string into a seed. */
function seed(): number {
  let h = 0x811c9dc5
  for (let i = 0; i < KEY.length; i++) {
    h ^= KEY.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h || 1
}

/**
 * XOR with a keystream, which is its own inverse, so one function covers both
 * directions and the two can never disagree about the order of anything.
 */
function mask(bytes: Uint8Array): Uint8Array {
  let x = seed()
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    x = (x ^ (x << 13)) >>> 0
    x = x ^ (x >>> 17)
    x = (x ^ (x << 5)) >>> 0
    out[i] = bytes[i] ^ (x & 0xff)
  }
  return out
}

/** The file body: one line of base64url, so it is a plain text file in git. */
export function scrambleTeam(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  const text = [HEADER, ...clean, FOOTER].join('\n')
  return bytesToBase64Url(mask(new TextEncoder().encode(text)))
}

/**
 * Null for anything that is not a whole team file: a truncated body, an unrelated
 * file served with the wrong name, a list with no names in it. Absent and
 * unreadable are the same answer here, which is that this build ships no team
 * list. Half a list is never an answer.
 */
export function unscrambleTeam(body: string): Athlete[] | null {
  const bytes = base64UrlToBytes(body.trim())
  if (!bytes || bytes.length === 0) return null
  const lines = new TextDecoder().decode(mask(bytes)).split('\n')
  if (lines.length < 3) return null
  if (lines[0] !== HEADER || lines[lines.length - 1] !== FOOTER) return null
  const athletes = parseRoster(lines.slice(1, -1).join('\n'))
  return athletes.length > 0 ? athletes : null
}

/**
 * Looks for the shipped list. A build with no team file is the normal case for
 * anyone who clones this repo, so absent is not an error and never surfaces as
 * one.
 */
export async function fetchTeam(url: string): Promise<Athlete[] | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return unscrambleTeam(await res.text())
  } catch {
    return null
  }
}

/**
 * How a phone recognizes the list it already has. Names only, in order, so a
 * rebuild that changes nothing is not mistaken for a new roster.
 */
export function teamText(athletes: Athlete[]): string {
  return athletes.map((a) => a.name).join('\n')
}
