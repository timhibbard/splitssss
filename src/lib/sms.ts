/**
 * Where a split taker's results go. One number, because every phone at a meet
 * is timing for the same coach, and a volunteer handed a phone ten minutes
 * before the gun should not have to find a contact in a share sheet.
 */
export const COACH_PHONE = '+17855501483'

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
