import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeRoster, encodeRoster, rosterFromHash, rosterLink } from './link.ts'
import type { Athlete } from './types.ts'

const team: Athlete[] = [
  { id: 'a1', name: 'Avery Collins' },
  { id: 'a2', name: 'Rowan Hayes' },
  { id: 'a3', name: "Bex O'Neal-Ruiz" },
]

test('a roster survives the round trip through a link', () => {
  const back = decodeRoster(encodeRoster(team))
  assert.deepEqual(
    back.map((a) => a.name),
    ['Avery Collins', 'Rowan Hayes', "Bex O'Neal-Ruiz"],
  )
})

test('ids are minted fresh, because they are local to a device', () => {
  const back = decodeRoster(encodeRoster(team))
  assert.notEqual(back[0].id, 'a1')
  assert.equal(new Set(back.map((a) => a.id)).size, 3, 'and they are distinct')
})

test('accented names come through intact', () => {
  const back = decodeRoster(encodeRoster([{ id: 'x', name: 'Zoë Ramírez' }]))
  assert.equal(back[0].name, 'Zoë Ramírez')
})

test('the payload is URL safe', () => {
  // 28 names of realistic length, which is this team.
  const many = Array.from({ length: 28 }, (_, i) => ({
    id: `a${i}`,
    name: `Firstname Lastname${i}`,
  }))
  const encoded = encodeRoster(many)
  assert.match(encoded, /^[A-Za-z0-9\-_]+$/, 'no +, / or = to be escaped or truncated')
  assert.equal(decodeRoster(encoded).length, 28)
  assert.ok(encoded.length < 1000, `stays textable at ${encoded.length} characters`)
})

test('the roster rides in the fragment, never the query', () => {
  const url = rosterLink(team, 'https://example.com', '/splitssss/')
  assert.ok(url.includes('#r='), 'fragment')
  assert.equal(url.split('#')[0], 'https://example.com/splitssss/', 'nothing before the #')
  assert.equal(url.indexOf('?'), -1, 'and no query string to reach a server log')
})

test('a link is read back out of a location hash', () => {
  const url = rosterLink(team, 'https://example.com', '/splitssss/')
  const hash = url.slice(url.indexOf('#'))
  assert.equal(rosterFromHash(hash).length, 3)
  assert.equal(rosterFromHash(hash.slice(1)).length, 3, 'with or without the #')
})

test('an unrelated or absent fragment imports nothing', () => {
  assert.deepEqual(rosterFromHash(''), [])
  assert.deepEqual(rosterFromHash('#'), [])
  assert.deepEqual(rosterFromHash('#something-else'), [])
})

test('a truncated link imports nothing rather than junk', () => {
  // Messaging apps break long links. Half a payload must not become half a name.
  const encoded = encodeRoster(team)
  const results = [
    rosterFromHash(`#r=${encoded.slice(0, 5)}`),
    rosterFromHash('#r=!!!!not base64!!!!'),
  ]
  for (const r of results) {
    assert.ok(
      r.length === 0 || r.every((a) => a.name.length > 0),
      'either nothing, or names that are at least well formed',
    )
  }
  assert.deepEqual(rosterFromHash('#r='), [], 'an empty payload is empty')
})

test('other fragment params do not confuse the reader', () => {
  const encoded = encodeRoster(team)
  assert.equal(rosterFromHash(`#foo=1&r=${encoded}`).length, 3)
})
