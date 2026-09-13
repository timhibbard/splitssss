// Explicit extension so `node --test` can load this module's graph without a
// build step. Vite resolves it identically.
import { base64UrlToText, textToBase64Url } from './base64.ts'
import { parseRoster, rosterText } from './roster.ts'
import type { Athlete } from './types'

/**
 * Rosters travel in the URL fragment, never the query string.
 *
 * A fragment is not sent to the server, so the names of minors never reach a web
 * server log or a CDN cache, and there is no backend to hold them either. The
 * texted link *is* the data transfer.
 *
 * The payload is base64url of the same one-runner-per-line text a coach would
 * paste, best times included, so a link and a paste decode through identical
 * code. Base64 is not secrecy, it just keeps a list of names out of a text
 * message preview and survives every mail client and messaging app that would
 * otherwise mangle spaces, commas, and accents.
 */
const KEY = 'r='

export function encodeRoster(athletes: Athlete[]): string {
  return textToBase64Url(rosterText(athletes))
}

export function decodeRoster(encoded: string): Athlete[] {
  // A truncated or hand-edited link decodes to null. Better to import nothing
  // than to import junk.
  const text = base64UrlToText(encoded)
  return text == null ? [] : parseRoster(text)
}

/** The link a coach texts out. Drops any existing fragment or query. */
export function rosterLink(athletes: Athlete[], origin: string, path: string): string {
  return `${origin}${path}#${KEY}${encodeRoster(athletes)}`
}

/** Pulls a roster out of a fragment, tolerating a leading # and other params. */
export function rosterFromHash(hash: string): Athlete[] {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const part = raw.split('&').find((p) => p.startsWith(KEY))
  if (!part) return []
  return decodeRoster(part.slice(KEY.length))
}

/**
 * The help page's own address, so it can be texted on its own rather than
 * described over the phone.
 *
 * A fragment and not a path, for the same reason the roster is one: this is a
 * static site on a subpath with no server to route anything, so /splitssss/help
 * would be a 404 for exactly the person being sent the link, the one who has not
 * opened the app before. A fragment always lands on the app itself.
 *
 * Matched whole rather than by prefix, and it shares the fragment grammar the
 * roster key uses, so a link carrying a roster is never read as a request for the
 * help page and a stray fragment is never read as either.
 */
const HELP = 'help'

export const HELP_HASH = `#${HELP}`

export function helpLink(origin: string, path: string): string {
  return `${origin}${path}${HELP_HASH}`
}

export function isHelpHash(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw.split('&').some((part) => part === HELP)
}

/**
 * The two Yellow Jacket results pages, addressed the same way the help page is,
 * and for the same reason: this is a static site on a subpath with no server to
 * route anything, so /splitssss/yellow-jacket would 404 for exactly the person
 * being sent the link.
 *
 * Two addresses rather than one page with a switch, because they are for two
 * different people and only one of them should be textable to a team. The
 * athlete page shows one runner her own race; the coach page shows the whole
 * field with every derived column and the caveats attached. Neither is reachable
 * from the timing screens on purpose — a volunteer holding a phone at Mile 2 has
 * no use for a results table, and the app's home screen is theirs.
 *
 * Matched whole, so the athlete hash never matches the coach one despite being a
 * prefix of it.
 */
const RESULTS = 'yellow-jacket'
const RESULTS_COACH = 'yellow-jacket-coach'

export const RESULTS_HASH = `#${RESULTS}`
export const RESULTS_COACH_HASH = `#${RESULTS_COACH}`

/** The link a coach texts to the team. */
export function resultsLink(origin: string, path: string): string {
  return `${origin}${path}${RESULTS_HASH}`
}

export function isResultsHash(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw.split('&').some((part) => part === RESULTS)
}

export function isCoachResultsHash(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw.split('&').some((part) => part === RESULTS_COACH)
}
