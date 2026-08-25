import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import { becameScroll, TAP_SLOP } from './gesture.ts'

const at = (x: number, y: number) => ({ x, y })

test('a finger that does not move is a tap', () => {
  assert.equal(becameScroll(at(100, 200), at(100, 200)), false)
})

test('a small wobble is still a tap', () => {
  // Nobody holds a phone still at the two mile mark.
  assert.equal(becameScroll(at(100, 200), at(104, 197)), false)
})

test('a drag down the grid is a scroll', () => {
  assert.equal(becameScroll(at(100, 200), at(100, 260)), true)
})

test('a drag up the grid is a scroll', () => {
  assert.equal(becameScroll(at(100, 200), at(100, 140)), true)
})

test('sideways counts too, since the slop is a radius', () => {
  assert.equal(becameScroll(at(100, 200), at(40, 200)), true)
})

test('diagonal movement adds up', () => {
  // 8 across and 8 down is 11.3 away, past the threshold, even though neither
  // axis alone would trip it.
  assert.equal(becameScroll(at(0, 0), at(8, 8)), true)
})

test('exactly at the threshold is still a tap', () => {
  assert.equal(becameScroll(at(0, 0), at(TAP_SLOP, 0)), false)
  assert.equal(becameScroll(at(0, 0), at(TAP_SLOP + 1, 0)), true)
})

test('the threshold is adjustable', () => {
  assert.equal(becameScroll(at(0, 0), at(20, 0), 30), false)
  assert.equal(becameScroll(at(0, 0), at(20, 0), 5), true)
})
