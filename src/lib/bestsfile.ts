// Explicit extensions: see the note in link.ts.
import { base64UrlToBytes, bytesToBase64Url } from './base64.ts'
import { formatPr, parsePr } from './clock.ts'
import type { Season } from './pages.ts'
import { mask } from './scramble.ts'

/**
 * Each runner's PR and season best, as the coach keeps them, for the coach page.
 *
 * The coach's own numbers and not worked out from the published meets, because
 * they are not the same thing: a season best can come from a race with no file
 * here, a hand-timed one or a meet that never reached MileSplit, and the coach's
 * list is the one the team goes by. Shipped exactly as given.
 *
 * One file per season, beside its meets, because a season best belongs to a
 * season and next year's list starts empty. Scrambled the same way the meets and
 * the team list are, and for the same reasons: see teamfile.ts. Labels only, the
 * short form the rest of the app says, never a full name.
 */
export type Best = { label: string; pr?: number; sb?: number }

const KEY = 'splitssss/bests/v1'
const HEADER = 'splitssss bests v1'
const FOOTER = 'splitssss end'

export function bestsFilePath(season: Season): string {
  return `meets/${season.year}/${season.team}/bests.dat`
}

/** One line per runner: the label, the PR and the season best, tab separated, `-` for none. */
export function bestsText(bests: Best[]): string {
  const cell = (ms: number | undefined) => (ms == null ? '-' : formatPr(ms))
  return bests.map((b) => [b.label, cell(b.pr), cell(b.sb)].join('\t')).join('\n')
}

export function parseBests(text: string): Best[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [label, pr, sb] = line.split('\t').map((c) => c.trim())
      const read = (cell: string | undefined) => (cell == null || cell === '-' ? undefined : parsePr(cell))
      const best: Best = { label }
      const p = read(pr)
      const s = read(sb)
      if (p != null) best.pr = p
      if (s != null) best.sb = s
      return best
    })
}

export function scrambleBests(bests: Best[]): string {
  const text = [HEADER, bestsText(bests), FOOTER].join('\n')
  return bytesToBase64Url(mask(new TextEncoder().encode(text), KEY))
}

/** Null for anything that is not a whole file, the same rule as the meets: half a list is never an answer. */
export function unscrambleBests(body: string): Best[] | null {
  const bytes = base64UrlToBytes(body.trim())
  if (!bytes || bytes.length === 0) return null
  const lines = new TextDecoder().decode(mask(bytes, KEY)).split('\n')
  if (lines.length < 3) return null
  if (lines[0] !== HEADER || lines[lines.length - 1] !== FOOTER) return null
  const bests = parseBests(lines.slice(1, -1).join('\n'))
  return bests.length > 0 ? bests : null
}

/** A season with no list is the normal case, the boys' for one, so absent is not an error. */
export async function fetchBests(url: string): Promise<Best[] | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return unscrambleBests(await res.text())
  } catch {
    return null
  }
}
