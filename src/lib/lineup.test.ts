import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import { defaultLineup, lineupOf, restOfList, toggle, topOfList, VARSITY_SIZE } from './lineup.ts'
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
