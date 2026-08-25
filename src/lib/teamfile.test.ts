import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchTeam, scrambleTeam, teamText, unscrambleTeam } from './teamfile.ts'

// Never the real team. These are stand ins, like everywhere else in the tests.
const TEAM = ['Avery C.', 'Rowan H.', 'Jordan B.', 'Mary Eliza D.']

test('a shipped list round trips', () => {
  const back = unscrambleTeam(scrambleTeam(TEAM))
  assert.deepEqual(back?.map((a) => a.name), TEAM)
})

test('no name is readable in the file', () => {
  const body = scrambleTeam(TEAM)
  for (const name of TEAM) {
    assert.ok(!body.includes(name), `${name} appears in the file`)
    // Also not with the space gone, which is what base64 of plain text would
    // leave lying around in fragments.
    assert.ok(!body.includes(name.replace(/\s/g, '')), `${name} appears unspaced`)
  }
  assert.ok(!body.includes('Avery'), 'a first name on its own appears')
  assert.ok(!body.includes('splitssss'), 'the header appears in the clear')
})

test('the same list rebuilds byte for byte, so a rebuild is not a diff', () => {
  assert.equal(scrambleTeam(TEAM), scrambleTeam(TEAM))
})

test('one changed name changes the file', () => {
  assert.notEqual(scrambleTeam(TEAM), scrambleTeam([...TEAM, 'Sasha C.']))
})

test('blank lines and stray spaces do not become runners', () => {
  const back = unscrambleTeam(scrambleTeam(['  Avery C.  ', '', 'Rowan H.']))
  assert.deepEqual(back?.map((a) => a.name), ['Avery C.', 'Rowan H.'])
})

test('anything that is not a team file reads as no team file', () => {
  assert.equal(unscrambleTeam(''), null, 'empty')
  assert.equal(unscrambleTeam('not base64 !!'), null, 'not base64')
  assert.equal(unscrambleTeam('QXZlcnkgQy4K'), null, 'base64 of plain text, no header')
  assert.equal(unscrambleTeam(scrambleTeam([])), null, 'a list with nobody on it')
})

test('a truncated file is rejected rather than read as a shorter team', () => {
  const body = scrambleTeam(TEAM)
  // Every cut, not just a convenient one: a half finished download must never
  // become a list ending in half a name.
  for (let cut = 1; cut < body.length; cut++) {
    assert.equal(unscrambleTeam(body.slice(0, cut)), null, `a body cut to ${cut} decoded`)
  }
})

test('a file that is not a prefix of ours is rejected', () => {
  const body = scrambleTeam(TEAM)
  // Flip a character early, where the header lives.
  const tampered = (body[0] === 'A' ? 'B' : 'A') + body.slice(1)
  assert.equal(unscrambleTeam(tampered), null)
})

test('a missing file reads as no shipped team, never as an error', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch
  try {
    assert.equal(await fetchTeam('/splitssss/team.dat'), null)
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    assert.equal(await fetchTeam('/splitssss/team.dat'), null, 'a throw is absent too')
    globalThis.fetch = (async () => ({
      ok: true,
      text: async () => scrambleTeam(TEAM),
    })) as unknown as typeof fetch
    const found = await fetchTeam('/splitssss/team.dat')
    assert.deepEqual(found?.map((a) => a.name), TEAM)
  } finally {
    globalThis.fetch = original
  }
})

test('the fingerprint is the names in order, and nothing else', () => {
  const a = [
    { id: 'x1', name: 'Avery C.' },
    { id: 'x2', name: 'Rowan H.' },
  ]
  const b = [
    { id: 'y9', name: 'Avery C.' },
    { id: 'y8', name: 'Rowan H.' },
  ]
  assert.equal(teamText(a), teamText(b), 'ids are not part of it')
  assert.notEqual(teamText(a), teamText([...b].reverse()), 'order is')
})
