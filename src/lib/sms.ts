// Explicit extensions: see the note in link.ts.
import { base64UrlToBytes, bytesToBase64Url } from './base64.ts'
import { mask } from './scramble.ts'
import type { Team } from './types.ts'

/**
 * Where a split taker's results go: the girls' coach for a girls race and the
 * boys' coach for a boys race, read off the race the phone timed, so a volunteer
 * handed a phone ten minutes before the gun never picks a contact or follows a
 * special link. A race from before the phone knew about teams goes to the girls'
 * coach, who is also who it went to then.
 */
export const COACH_PHONE = '+17855501483'

/**
 * The boys' coach's number is not in this repository. The deploy build reads it
 * from the BOYS_COACH_PHONE secret and ships it scrambled, which keeps it out of
 * the code and out of a search of it. Scrambled and not secret: a phone has to
 * dial it, so the way to read it is in the app. See scramble.ts.
 */
const KEY = 'splitssss coach phone v1'
const CHECK = 'tel:'

/**
 * A number as Messages wants it, `+18645551234`, or undefined for anything that is
 * not a US number. Dashes, dots, spaces and brackets are fine; letters are not.
 */
export function normalizePhone(raw: string): string | undefined {
  if (!/^[\d\s().+-]+$/.test(raw.trim())) return undefined
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return undefined
}

export function scramblePhone(phone: string): string {
  return bytesToBase64Url(mask(new TextEncoder().encode(`${CHECK}${phone}`), KEY))
}

/** Undefined for anything that does not come back a phone number, so it is never dialled. */
export function unscramblePhone(scrambled: string): string | undefined {
  const bytes = base64UrlToBytes(scrambled)
  if (!bytes || bytes.length === 0) return undefined
  const text = new TextDecoder().decode(mask(bytes, KEY))
  if (!text.startsWith(CHECK)) return undefined
  const phone = text.slice(CHECK.length)
  return normalizePhone(phone) === phone ? phone : undefined
}

/**
 * Who this race's results go to. A boys race on a build made without the boys'
 * coach's number, which is any local build, goes to the girls' coach rather than
 * to nobody.
 */
export function coachPhone(team: Team | undefined, boysScrambled: string): string {
  if (team === 'boys') return unscramblePhone(boysScrambled) ?? COACH_PHONE
  return COACH_PHONE
}

/**
 * A link that opens Messages to that number with the body filled in. A text link
 * cannot carry a file, so the body is the whole thing; Share is still there for
 * the .csv itself.
 *
 * `?&body=` rather than `?body=` or `&body=`: iOS reads the one after the
 * ampersand and Android the one after the question mark, and this form is read
 * by both.
 */
export function smsLink(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}
