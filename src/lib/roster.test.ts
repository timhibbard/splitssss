import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRoster } from './roster.ts'
import type { Athlete } from './types.ts'

const avery: Athlete = { id: 'a1', name: 'Avery Collins' }
const rowan: Athlete = { id: 'a2', name: 'Rowan Hayes' }
const jordan: Athlete = { id: 'a3', name: 'Jordan Blake' }

test('a runner added mid race joins the grid', () => {
  const merged = mergeRoster([avery], [avery, rowan], new Set())
  assert.deepEqual(
    merged.map((a) => a.name),
    ['Avery Collins', 'Rowan Hayes'],
  )
})

test('a scratch with no crossing leaves the grid', () => {
  const merged = mergeRoster([avery, rowan], [avery], new Set())
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1'],
  )
})

test('a runner who already crossed stays even after being removed', () => {
  // She passed the split point, then got taken off the roster by mistake. Her
  // time is recorded, so dropping her would orphan it.
  const merged = mergeRoster([avery, rowan], [avery], new Set(['a2']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1', 'a2'],
    'kept, and after the roster so the grid order still matches the list',
  )
})

test('the roster order wins, and nobody is duplicated', () => {
  const reordered = [rowan, jordan, avery]
  const merged = mergeRoster([avery, rowan, jordan], reordered, new Set(['a1', 'a2']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a2', 'a3', 'a1'],
  )
})

test('an edited name reaches a runner who has already crossed', () => {
  const fixed: Athlete = { id: 'a1', name: 'Avery Collins-Reed' }
  const merged = mergeRoster([avery], [fixed], new Set(['a1']))
  assert.equal(merged.length, 1, 'the same id is not kept twice')
  assert.equal(merged[0].name, 'Avery Collins-Reed')
})

test('clearing the roster keeps only the runners with times', () => {
  const merged = mergeRoster([avery, rowan, jordan], [], new Set(['a3']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a3'],
  )
})
