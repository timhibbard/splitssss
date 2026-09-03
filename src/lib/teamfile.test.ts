import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchTeam, scrambleTeam, teamText, unscrambleTeam } from './teamfile.ts'

// Never the real team. These are stand ins, like everywhere else in the tests.
const TEAM = ['Marlowe H.', 'Rowan H.', 'Jordan B.', 'Anna Grace F.']

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
  assert.ok(!body.includes('Marlowe'), 'a first name on its own appears')
  assert.ok(!body.includes('splitssss'), 'the header appears in the clear')
})

test('the same list rebuilds byte for byte, so a rebuild is not a diff', () => {
  assert.equal(scrambleTeam(TEAM), scrambleTeam(TEAM))
})

test('one changed name changes the file', () => {
  assert.notEqual(scrambleTeam(TEAM), scrambleTeam([...TEAM, 'Quinn D.']))
})

test('a best time survives the scramble with the label it belongs to', () => {
  // A PR that had to be sent to a volunteer would never reach their phone, so
  // the shipped file carries the numbers too.
  const lines = ['Marlowe H.\t21:34.60', 'Rowan H.', 'Jordan B.\t24:00.00']
  const back = unscrambleTeam(scrambleTeam(lines))
  assert.deepEqual(
    back?.map((a) => [a.name, a.pr]),
    [
      ['Marlowe H.', 21 * 60_000 + 34_600],
      ['Rowan H.', undefined],
      ['Jordan B.', 24 * 60_000],
    ],
  )
})

test('one shipped file holds both teams', () => {
  // The whole point of the headings: one build, one file, and either coach's race
  // can be covered by whichever phone is at the marker.
  const lines = ['# Girls', 'Marlowe H.\t21:34.60', 'Rowan H.', '# Boys', 'Jordan B.\t17:12.40']
  const back = unscrambleTeam(scrambleTeam(lines))
  assert.deepEqual(
    back?.map((a) => [a.name, a.team, a.pr]),
    [
      ['Marlowe H.', 'girls', 21 * 60_000 + 34_600],
      ['Rowan H.', 'girls', undefined],
      ['Jordan B.', 'boys', 17 * 60_000 + 12_400],
    ],
  )
})

test('no heading is readable in the file either', () => {
  const body = scrambleTeam(['# Girls', 'Rowan H.', '# Boys', 'Jordan B.'])
  assert.ok(!body.includes('Girls'), 'a heading appears in the clear')
  assert.ok(!body.includes('Boys'))
})

test('moving a runner between teams changes the fingerprint', () => {
  // A phone compares the shipped text against what it holds. A runner who moved
  // up to the varsity list of the other team has to reach the phones.
  const girls = [{ id: 'x1', name: 'Rowan H.', team: 'girls' as const }]
  const boys = [{ id: 'x1', name: 'Rowan H.', team: 'boys' as const }]
  assert.notEqual(teamText(girls), teamText(boys))
  assert.notEqual(teamText(girls), teamText([{ id: 'x1', name: 'Rowan H.' }]))
})

test('a changed best time changes the fingerprint, so the phone picks it up', () => {
  // The app compares the shipped text against what it already has. A rebuild that
  // only moved a PR has to read as a change or nobody ever sees the new one.
  const before = [{ id: 'x1', name: 'Marlowe H.', pr: 21 * 60_000 + 34_600 }]
  const after = [{ id: 'x1', name: 'Marlowe H.', pr: 20 * 60_000 + 51_240 }]
  assert.notEqual(teamText(before), teamText(after))
  assert.notEqual(teamText(before), teamText([{ id: 'x1', name: 'Marlowe H.' }]))
})

test('blank lines and stray spaces do not become runners', () => {
  const back = unscrambleTeam(scrambleTeam(['  Marlowe H.  ', '', 'Rowan H.']))
  assert.deepEqual(back?.map((a) => a.name), ['Marlowe H.', 'Rowan H.'])
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
    { id: 'x1', name: 'Marlowe H.' },
    { id: 'x2', name: 'Rowan H.' },
  ]
  const b = [
    { id: 'y9', name: 'Marlowe H.' },
    { id: 'y8', name: 'Rowan H.' },
  ]
  assert.equal(teamText(a), teamText(b), 'ids are not part of it')
  assert.notEqual(teamText(a), teamText([...b].reverse()), 'order is')
})
