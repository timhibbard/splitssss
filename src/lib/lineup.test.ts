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

test('the varsity default is drawn inside one team', () => {
  // Seven of the nine boys, not seven of the thirty seven names on the phone.
  const boys: Athlete[] = Array.from({ length: 9 }, (_, i) => ({
    id: `b${i + 1}`,
    name: `Boy ${i + 1}`,
    team: 'boys' as const,
  }))
  const both = [...team, ...boys]
  assert.deepEqual(defaultLineup(forTeam(both, 'boys'), 'Varsity Boys'), [
    'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  ], 'the untagged legacy names still count, since they match any team')
  assert.deepEqual(
    defaultLineup(boys, 'Varsity Boys'),
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
    'and on a fully tagged phone it is that team\'s top seven',
  )
})
