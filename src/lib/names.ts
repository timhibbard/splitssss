import type { Athlete } from './types'

/**
 * What a name looks like on a button.
 *
 * A phone has room for "Rowan H." and not much more, and a volunteer picking a
 * runner out of a field of a hundred does not read a surname to know who is
 * coming. Full names stay in storage and in the export, which is the coach's
 * record and the thing that gets filed.
 */

export type NameParts = { first: string; last: string }

/**
 * Splits on the last space, so everything before it is the first name.
 * "Anna Grace Fielding" is Anna Grace, because that is what the team calls out.
 */
export function nameParts(full: string): NameParts {
  const words = full.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return { first: words[0] ?? '', last: '' }
  return { first: words.slice(0, -1).join(' '), last: words[words.length - 1] }
}

/**
 * "Rowan Hayes" becomes "Rowan H." A one word name is left alone, and a
 * surname shorter than the letters asked for is spelled out rather than
 * abbreviated to itself with a dot on the end.
 */
export function shortName(full: string, letters = 1): string {
  const { first, last } = nameParts(full)
  if (last === '') return first
  const chars = [...last]
  if (letters >= chars.length) return `${first} ${last}`
  return `${first} ${chars.slice(0, letters).join('')}.`
}

/**
 * What counts as the same label to someone glancing at a button. The trailing
 * dot goes, so "Marlowe Ho" and "Marlowe Ho." are treated as a clash rather
 * than as two labels that differ by a speck of punctuation.
 */
function sameLabel(label: string): string {
  return label.replace(/\.$/, '').toLowerCase()
}

/** Keys used more than once in the list. */
function repeated(keys: string[]): Set<string> {
  const seen = new Set<string>()
  const twice = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) twice.add(key)
    seen.add(key)
  }
  return twice
}

/**
 * Short names for a whole team, grown a letter at a time wherever two of them
 * would read the same. Two buttons with the same label is a split on the wrong
 * runner, so a clash costs letters until it is gone: Rowan H. and Rowan Ha.
 * before Rowan Hayes. Twenty letters in, two people share a name, and then both
 * get it in full.
 */
export function shortNames(names: string[]): string[] {
  const full = names.map((name) => name.trim())
  const out = full.map((name) => shortName(name))
  for (let letters = 2; letters <= 20; letters++) {
    const keys = out.map(sameLabel)
    const clashing = repeated(keys)
    if (clashing.size === 0) break
    for (let i = 0; i < out.length; i++) {
      if (clashing.has(keys[i])) out[i] = shortName(full[i], letters)
    }
  }
  return out
}

/** The label for every runner on a list, by id. */
export function displayNames(athletes: Athlete[]): Map<string, string> {
  const labels = shortNames(athletes.map((a) => a.name))
  return new Map(athletes.map((a, i) => [a.id, labels[i]]))
}

/**
 * A few names and a count, for confirming a lineup without reading all of it.
 * "Marlowe H., Rowan H., Jordan B. and 4 more"
 */
export function summarize(labels: string[], shown = 3): string {
  if (labels.length === 0) return 'nobody yet'
  if (labels.length <= shown) {
    if (labels.length === 1) return labels[0]
    return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  }
  return `${labels.slice(0, shown).join(', ')} and ${labels.length - shown} more`
}
