/**
 * The keystream behind every file this app ships with names in it.
 *
 * Lifted out of teamfile.ts when a second such file appeared, so the two cannot
 * drift apart in the one way that would matter: a byte order or a seed that
 * disagreed between writer and reader produces a file that decodes to garbage,
 * and the person who finds out is standing at a course.
 *
 * This is **obfuscation, not encryption**, and the argument for it is written out
 * in full in teamfile.ts. The short version: the page reads these files with
 * nothing supplied by a human, so the way to read them ships in the JavaScript,
 * so anyone who wants the contents can have them. What it buys is that the names
 * of minors are not plaintext in a public repository and not indexable by a
 * crawler. What it does not buy is secrecy, so nothing here pretends to it.
 *
 * The key is a parameter rather than a constant because each file gets its own,
 * so a truncated team file can never half-decode as a results file. Different
 * keystreams plus the per-file header and footer make that a clean rejection
 * instead of a plausible-looking mess.
 */

/** FNV-1a over the key, purely to turn a string into a seed. */
function seed(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h || 1
}

/**
 * XOR with a fixed xorshift keystream, which is its own inverse, so one function
 * covers both directions and the two can never disagree about the order of
 * anything.
 *
 * Deterministic on purpose: the same list rebuilds byte for byte, so a rebuild
 * with no roster change is not a diff to review.
 */
export function mask(bytes: Uint8Array, key: string): Uint8Array {
  let x = seed(key)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    x = (x ^ (x << 13)) >>> 0
    x = x ^ (x >>> 17)
    x = (x ^ (x << 5)) >>> 0
    out[i] = bytes[i] ^ (x & 0xff)
  }
  return out
}
