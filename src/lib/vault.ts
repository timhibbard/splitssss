// Explicit extensions: see the note in link.ts.
import { base64UrlToBytes, bytesToBase64Url } from './base64.ts'
import { parseRoster, rosterText } from './roster.ts'
import type { Athlete } from './types'

/**
 * The roster, encrypted, so it can be committed to a public repository.
 *
 * What is actually secret and what is not, stated plainly:
 *
 * - The repository is public, because free GitHub Pages requires it, and the
 *   published site is public either way. Anything the page can read without a
 *   human supplying something, anyone can read. Base64, an odd filename or a key
 *   shipped in the JavaScript are speed bumps, not secrecy.
 * - So the only thing that can protect a list of minors' names in this repo is a
 *   passphrase that never enters it. The coach texts the passphrase to whoever is
 *   timing, separately from the link.
 * - The ciphertext is public forever, including in git history, so it can be
 *   ground on offline for as long as somebody cares to. That is a passphrase
 *   strength problem, which is why the encrypt tool insists on a real one.
 *
 * AES-GCM so a tampered file fails to open rather than decrypting to something
 * else, with the key from PBKDF2-SHA256. `iter` is stored in the file rather than
 * assumed, so the count can rise later without stranding a roster already
 * published. Salt and IV are fresh per file, which is what keeps two seasons
 * encrypted under the same passphrase from producing comparable ciphertext.
 */
export type Vault = {
  v: 1
  kdf: 'PBKDF2-SHA256'
  iter: number
  /** base64url, all three. */
  salt: string
  iv: string
  ct: string
}

/**
 * Twice OWASP's 2023 floor for PBKDF2-SHA256. WebCrypto is native, so this
 * measures at a fraction of a second on a laptop and well under a second on a
 * phone, paid once per device. The file is public forever, so the rounds are
 * worth more here than the wait costs.
 */
export const ITERATIONS = 1_200_000

/**
 * A hostile or corrupt file must not be able to hang the phone by asking for a
 * billion rounds, so anything above this is rejected rather than attempted.
 */
const MAX_ITERATIONS = 4_000_000

/** The published file, at the site root. Committed; the names file never is. */
export const VAULT_FILE = 'roster.enc'

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iter: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(text: string, passphrase: string): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, ITERATIONS)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text),
  )
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: ITERATIONS,
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(ct)),
  }
}

/**
 * Null for a wrong passphrase, a tampered file, or a malformed one. The three
 * are indistinguishable from the ciphertext, and they are the same sentence to
 * the person holding the phone anyway.
 */
export async function open(vault: Vault, passphrase: string): Promise<string | null> {
  const salt = base64UrlToBytes(vault.salt)
  const iv = base64UrlToBytes(vault.iv)
  const ct = base64UrlToBytes(vault.ct)
  if (!salt || !iv || !ct) return null
  try {
    const key = await deriveKey(passphrase, salt, vault.iter)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/** Shape check for a file arriving off the network, before any work is done on it. */
export function isVault(value: unknown): value is Vault {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.v === 1 &&
    v.kdf === 'PBKDF2-SHA256' &&
    typeof v.iter === 'number' &&
    Number.isInteger(v.iter) &&
    v.iter > 0 &&
    v.iter <= MAX_ITERATIONS &&
    typeof v.salt === 'string' &&
    v.salt.length > 0 &&
    typeof v.iv === 'string' &&
    v.iv.length > 0 &&
    typeof v.ct === 'string' &&
    v.ct.length > 0
  )
}

/** Same one-runner-per-line text as a paste or a link, so all three decode alike. */
export function sealRoster(athletes: Athlete[], passphrase: string): Promise<Vault> {
  return seal(rosterText(athletes), passphrase)
}

export async function openRoster(vault: Vault, passphrase: string): Promise<Athlete[] | null> {
  const text = await open(vault, passphrase)
  return text === null ? null : parseRoster(text)
}

/**
 * Looks for a published roster. Absent is the normal case, not an error: a fresh
 * clone of this repo has no roster in it, and the unlock prompt simply never
 * appears. Any failure reads as absent for the same reason.
 */
export async function fetchVault(url: string): Promise<Vault | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const body: unknown = await res.json()
    return isVault(body) ? body : null
  } catch {
    return null
  }
}
