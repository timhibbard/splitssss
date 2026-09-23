// Explicit extension so `node --test` can load this module's graph without a
// build step. Vite resolves it identically.
import { base64UrlToText, textToBase64Url } from './base64.ts'
import { HELP_PATH, pageLink, type Published, type ResultsPage } from './pages.ts'
import { shareAddress } from './season.ts'
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
 * The addresses of the pages that can be texted on their own: the help page and,
 * per meet, the athlete and coach results pages.
 *
 * These are paths, and the reason they can be is that the build writes a real
 * index.html at each one. See pages.ts, which is the list that does it.
 *
 * The links are built from the app's base rather than from wherever the browser
 * currently is, so the coach page — which is itself at a nested path — hands out
 * the athlete link and not a path relative to its own.
 */
export const HELP = 'help'

export function helpLink(origin: string, base: string): string {
  return pageLink(origin, base, HELP_PATH)
}

/**
 * The link a coach texts to the team: the athlete page, never the coach page.
 *
 * Two addresses rather than one page with a switch, because they are for two
 * different people and only one of them should be textable to a team. The athlete
 * page shows one runner her own race; the coach page shows the whole field with
 * every derived column and the caveats attached. Neither is reachable from the
 * timing screens on purpose — a volunteer holding a phone at Mile 2 has no use for
 * a results table, and the app's home screen is theirs.
 *
 * Takes the page and the meet on screen rather than a path, so the coach page's own
 * address cannot be passed in here by mistake. See shareAddress for which athlete
 * address that comes to.
 */
export function resultsLink(
  origin: string,
  base: string,
  page: ResultsPage,
  showing: Published,
): string {
  return pageLink(origin, base, shareAddress(page, showing))
}

/**
 * The old `#help` address, kept working because it has been texted to parents and
 * a link somebody already has in a message thread has to keep landing somewhere.
 * It is read once at startup and turned into the real path.
 *
 * Matched whole and sharing the fragment grammar the roster key uses, so a link
 * carrying a roster is never read as a request for the help page.
 *
 * The results pages never had a fragment address that reached anybody, so there is
 * nothing of theirs to keep working.
 */
export function isLegacyHelpHash(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw.split('&').some((part) => part === HELP)
}
