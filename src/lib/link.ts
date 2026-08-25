// Explicit extension so `node --test` can load this module's graph without a
// build step. Vite resolves it identically.
import { parseRoster } from './roster.ts'
import type { Athlete } from './types'

/**
 * Rosters travel in the URL fragment, never the query string.
 *
 * A fragment is not sent to the server, so the names of minors never reach a web
 * server log or a CDN cache, and there is no backend to hold them either. The
 * texted link *is* the data transfer.
 *
 * The payload is base64url of the same one-runner-per-line text a coach would
 * paste, so a link and a paste decode through identical code. Base64 is not
 * secrecy, it just keeps a list of names out of a text message preview and
 * survives every mail client and messaging app that would otherwise mangle
 * spaces, commas, and accents.
 */
const KEY = 'r='

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  // Built one char at a time rather than by spreading into fromCharCode, which
  // blows the argument limit on large inputs.
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    // A truncated or hand-edited link. Better to ignore it than to import junk.
    return null
  }
}

export function encodeRoster(athletes: Athlete[]): string {
  const text = athletes.map((a) => a.name).join('\n')
  return toBase64Url(text)
}

export function decodeRoster(encoded: string): Athlete[] {
  const text = fromBase64Url(encoded)
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
