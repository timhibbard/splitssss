import assert from 'node:assert/strict'
import { test } from 'node:test'
import { movePresets, resolveStation } from './stations.ts'

test('moving offers the markers further along first, and not the one you are at', () => {
  assert.deepEqual(
    movePresets({ label: 'Mile 1', meters: 1609 }).map((s) => s.label),
    ['Mile 2', '2.6 mi', '0.5 mi'],
  )
})

test('a custom spot with no distance keeps every preset, in order', () => {
  assert.deepEqual(
    movePresets({ label: 'Bridge' }).map((s) => s.label),
    ['0.5 mi', 'Mile 1', 'Mile 2', '2.6 mi'],
  )
})

test('a custom distance is not a station until it is a number', () => {
  assert.equal(resolveStation({ pick: 'custom', value: '', unit: 'm' }), null)
  assert.deepEqual(resolveStation({ pick: 'custom', value: '1200', unit: 'm' })?.meters, 1200)
  assert.equal(resolveStation({ pick: 'Mile 2', value: '', unit: 'm' })?.meters, 3219)
})
