import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchVault, isVault, ITERATIONS, open, openRoster, sealRoster } from './vault.ts'
import type { Athlete } from './types.ts'

const team: Athlete[] = [
  { id: 'a1', name: 'Avery Collins' },
  { id: 'a2', name: 'Zoë Ramírez' },
  { id: 'a3', name: "Bex O'Neal-Ruiz" },
]

const PASS = 'crimson-anvil-otter-lagoon'

// Sealed once and shared, because the key derivation is deliberately slow.
const sealed = await sealRoster(team, PASS)

test('the roster comes back out with the right passphrase', async () => {
  const back = await openRoster(sealed, PASS)
  assert.deepEqual(
    back?.map((a) => a.name),
    ['Avery Collins', 'Zoë Ramírez', "Bex O'Neal-Ruiz"],
    'accents and apostrophes included',
  )
})

test('ids are minted fresh on unlock, as with any other import', async () => {
  const back = await openRoster(sealed, PASS)
  assert.notEqual(back?.[0].id, 'a1')
  assert.equal(new Set(back?.map((a) => a.id)).size, 3)
})

test('the wrong passphrase gets nothing, not a guess', async () => {
  assert.equal(await openRoster(sealed, 'crimson-anvil-otter-lagoo'), null)
  assert.equal(await openRoster(sealed, ''), null)
  assert.equal(await openRoster(sealed, PASS.toUpperCase()), null)
})

test('no name appears anywhere in the published file', async () => {
  // The whole point. This file gets committed to a public repository.
  const onDisk = JSON.stringify(sealed).toLowerCase()
  // Fragments of four characters and up. A shorter one turns up in random base64
  // often enough to fail this test on a good file, which would teach us to ignore
  // it, and an ignored leak test is worse than none.
  for (const name of ['avery', 'collins', 'ramírez', 'ramirez', "o'neal", 'neal', 'ruiz']) {
    assert.equal(onDisk.includes(name), false, `${name} leaked into the file`)
  }
})

test('a tampered file fails to open rather than decrypting to something else', async () => {
  // AES-GCM authenticates, so an edited byte is a failure and not a wrong name.
  const flip = (s: string) => (s[0] === 'A' ? `B${s.slice(1)}` : `A${s.slice(1)}`)
  assert.equal(await open({ ...sealed, ct: flip(sealed.ct) }, PASS), null, 'ciphertext')
  assert.equal(await open({ ...sealed, iv: flip(sealed.iv) }, PASS), null, 'iv')
  assert.equal(await open({ ...sealed, salt: flip(sealed.salt) }, PASS), null, 'salt')
  assert.equal(await open({ ...sealed, ct: 'not base64!!' }, PASS), null, 'garbage')
  assert.equal(await open({ ...sealed, iter: ITERATIONS + 1 }, PASS), null, 'iteration count')
})

test('the same roster and passphrase seal to different bytes each time', async () => {
  // Fresh salt and IV, so two seasons under one passphrase are not comparable.
  const again = await sealRoster(team, PASS)
  assert.notEqual(again.ct, sealed.ct)
  assert.notEqual(again.salt, sealed.salt)
  assert.notEqual(again.iv, sealed.iv)
  assert.deepEqual((await openRoster(again, PASS))?.length, 3, 'and both still open')
})

test('an empty roster is not worth publishing, but it round trips', async () => {
  const empty = await sealRoster([], PASS)
  assert.deepEqual(await openRoster(empty, PASS), [])
})

test('a file that is not a vault is rejected before any work is done', () => {
  assert.equal(isVault(sealed), true)
  assert.equal(isVault(null), false)
  assert.equal(isVault('<!doctype html><title>404</title>'), false, 'a Pages 404 page')
  assert.equal(isVault({ ...sealed, v: 2 }), false, 'a future format')
  assert.equal(isVault({ ...sealed, kdf: 'md5' }), false)
  assert.equal(isVault({ ...sealed, ct: '' }), false)
  assert.equal(isVault({ ...sealed, iter: 0 }), false)
  assert.equal(isVault({ ...sealed, iter: 1.5 }), false)
  assert.equal(
    isVault({ ...sealed, iter: 1e12 }),
    false,
    'an absurd count would hang the phone, so it never gets tried',
  )
})

test('no published roster reads as no prompt, never as an error', async () => {
  const original = globalThis.fetch
  const respond = (body: unknown, ok = true) => {
    globalThis.fetch = (async () => ({
      ok,
      json: async () => body,
    })) as unknown as typeof fetch
  }
  try {
    respond(sealed)
    assert.equal((await fetchVault('/roster.enc'))?.ct, sealed.ct, 'a real file loads')

    respond({}, false)
    assert.equal(await fetchVault('/roster.enc'), null, '404 on a repo with no roster')

    respond('<!doctype html>')
    assert.equal(await fetchVault('/roster.enc'), null, 'an HTML error page')

    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    assert.equal(await fetchVault('/roster.enc'), null, 'no signal at the course')
  } finally {
    globalThis.fetch = original
  }
})

test('the key derivation is slow on purpose', () => {
  // The ciphertext is public forever, so an offline guess has to cost something.
  assert.ok(ITERATIONS >= 600_000, `${ITERATIONS} is too few rounds`)
})
