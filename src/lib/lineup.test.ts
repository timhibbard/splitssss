import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import {
  defaultLineup,
  forTeam,
  lineupOf,
  restOfList,
  sniffTeam,
  toggle,
  topOfList,
  VARSITY_SIZE,
  varsitySize,
} from './lineup.ts'
import type { Athlete } from './types.ts'

const team: Athlete[] = Array.from({ length: 10 }, (_, i) => ({
  id: `a${i + 1}`,
  name: `Runner ${i + 1}`,
}))

test('the top of the list is varsity', () => {
  assert.deepEqual(topOfList(team), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'])
  assert.equal(topOfList(team).length, VARSITY_SIZE)
})

test('the rest of the list is everyone else', () => {
  assert.deepEqual(restOfList(team), ['a8', 'a9', 'a10'])
})

test('a varsity race starts with the top of the list', () => {
  assert.deepEqual(defaultLineup(team, 'Varsity Girls'), topOfList(team))
})

test('a JV race starts with everyone else', () => {
  assert.deepEqual(defaultLineup(team, 'JV Girls'), restOfList(team))
})

test('junior varsity spelled out is still JV, not varsity', () => {
  assert.deepEqual(defaultLineup(team, 'Junior Varsity Girls'), restOfList(team))
})

test('any other race starts with the whole team', () => {
  assert.deepEqual(
    defaultLineup(team, 'Open 5K'),
    team.map((a) => a.id),
  )
})

test('a team too short for a JV race offers everyone rather than nobody', () => {
  const five = team.slice(0, 5)
  assert.deepEqual(
    defaultLineup(five, 'JV Girls'),
    five.map((a) => a.id),
    'an empty lineup is a capture screen with no buttons on it',
  )
})

test('an empty team gives an empty lineup, whatever the race', () => {
  assert.deepEqual(defaultLineup([], 'Varsity Girls'), [])
  assert.deepEqual(defaultLineup([], 'JV Girls'), [])
})

test('toggling adds and removes', () => {
  assert.deepEqual(toggle(['a1'], 'a2'), ['a1', 'a2'])
  assert.deepEqual(toggle(['a1', 'a2'], 'a1'), ['a2'])
})

test('the lineup follows team order, not the order it was picked in', () => {
  const chosen = lineupOf(team, ['a5', 'a1', 'a3'])
  assert.deepEqual(
    chosen.map((a) => a.id),
    ['a1', 'a3', 'a5'],
  )
})

test('an id that is no longer on the team drops out of the lineup', () => {
  assert.deepEqual(
    lineupOf(team, ['a1', 'gone']).map((a) => a.id),
    ['a1'],
  )
})

test('a race name says which team it is', () => {
  assert.equal(sniffTeam('Varsity Boys'), 'boys')
  assert.equal(sniffTeam('JV Girls'), 'girls')
  assert.equal(sniffTeam('boys open'), 'boys')
  assert.equal(sniffTeam(' Girls '), 'girls')
  assert.equal(sniffTeam('Boy 5K'), 'boys', 'singular counts')
  assert.equal(sniffTeam('# Girls'), 'girls', 'the roster heading is read the same way')
})

test('a race name that names no team gets none, not a guess', () => {
  assert.equal(sniffTeam('Eye Opener Invitational'), undefined)
  assert.equal(sniffTeam(''), undefined)
  assert.equal(sniffTeam('Cowboys'), undefined, 'a word that merely contains it does not count')
})

const mixed: Athlete[] = [
  { id: 'g1', name: 'Rowan Hayes', team: 'girls' },
  { id: 'b1', name: 'Jordan Blake', team: 'boys' },
  { id: 'x1', name: 'Someone Else' },
]

test('a race draws from its own team, and from anyone untagged', () => {
  assert.deepEqual(
    forTeam(mixed, 'boys').map((a) => a.id),
    ['b1', 'x1'],
  )
  assert.deepEqual(
    forTeam(mixed, 'girls').map((a) => a.id),
    ['g1', 'x1'],
  )
})

test('a race with no team on it draws from everyone', () => {
  // Races recorded before the phone knew there were two teams, and a phone whose
  // whole list predates the boys. Filtering either of those to nothing would take
  // away the names a volunteer actually has.
  assert.deepEqual(forTeam(mixed, undefined), mixed)
  assert.deepEqual(forTeam(team, 'boys'), team, 'an untagged list is offered whole')
})

const boys: Athlete[] = Array.from({ length: 9 }, (_, i) => ({
  id: `b${i + 1}`,
  name: `Boy ${i + 1}`,
  team: 'boys' as const,
}))

const girls: Athlete[] = team.map((a) => ({ ...a, team: 'girls' as const }))

test('the varsity default is drawn inside one team', () => {
  // Seven of the girls, not seven of the names on the whole phone.
  const both = [...girls, ...boys]
  assert.deepEqual(
    defaultLineup(forTeam(both, 'girls'), 'Varsity Girls', varsitySize(forTeam(both, 'girls'), 'girls')),
    ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
  )
})

test('varsity for the boys is all of them, since the list is the varsity squad', () => {
  // The nine boys on the phone are all varsity, so the varsity race starts with
  // nine rather than with the seven fastest of nine.
  assert.equal(varsitySize(boys, 'boys'), 9)
  assert.deepEqual(
    defaultLineup(boys, 'Varsity Boys', varsitySize(boys, 'boys')),
    boys.map((a) => a.id),
  )
})

test('varsity for the girls is still the fastest seven of the list', () => {
  assert.equal(varsitySize(girls, 'girls'), VARSITY_SIZE)
  assert.deepEqual(defaultLineup(girls, 'Varsity Girls', varsitySize(girls, 'girls')), [
    'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  ])
  assert.deepEqual(
    defaultLineup(girls, 'JV Girls', varsitySize(girls, 'girls')),
    ['a8', 'a9', 'a10'],
    'and JV is the rest of it',
  )
})

test('a phone with no teams on its list gets the plain seven', () => {
  // The migration case: nothing on the list says which team anyone is on, so
  // there is nothing to look a varsity number up by.
  assert.equal(varsitySize(team, undefined), VARSITY_SIZE)
  assert.deepEqual(defaultLineup(team, 'Varsity Girls', varsitySize(team, undefined)), topOfList(team))
})

test('a JV boys race offers the boys there are rather than nobody', () => {
  // There are no JV boys on the list, so "the rest" is empty. Everyone is a
  // grid the coach can fix in one tap; an empty grid is not.
  assert.deepEqual(
    defaultLineup(boys, 'JV Boys', varsitySize(boys, 'boys')),
    boys.map((a) => a.id),
  )
})
