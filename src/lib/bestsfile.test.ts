import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bestsFilePath, bestsText, parseBests, scrambleBests, unscrambleBests } from './bestsfile.ts'

// Never the real team. These are stand ins, like everywhere else in the tests.
const BESTS = [
  { label: 'Marlowe H.', pr: 1294600, sb: 1306000 },
  { label: 'Rowan H.', pr: 1349150, sb: 1349150 },
  { label: 'Jordan B.', pr: 1440000 },
]

test('a season list round trips, numbers with the label they belong to', () => {
  assert.deepEqual(unscrambleBests(scrambleBests(BESTS)), BESTS)
})

test('no name is readable in the file', () => {
  const body = scrambleBests(BESTS)
  for (const { label } of BESTS) assert.ok(!body.includes(label), `${label} appears in the file`)
  assert.ok(!body.includes('splitssss'), 'the header appears in the clear')
})

test('a time is written as given, to the hundredth', () => {
  assert.equal(bestsText(BESTS), 'Marlowe H.\t21:34.60\t21:46.00\nRowan H.\t22:29.15\t22:29.15\nJordan B.\t24:00.00\t-')
  assert.deepEqual(parseBests(bestsText(BESTS)), BESTS)
})

test('a truncated or foreign file is refused, not half read', () => {
  const body = scrambleBests(BESTS)
  assert.equal(unscrambleBests(body.slice(0, body.length - 6)), null)
  assert.equal(unscrambleBests('not a file'), null)
})

test('the file sits beside its season of meets', () => {
  assert.equal(bestsFilePath({ year: 2026, team: 'girls' }), 'meets/2026/girls/bests.dat')
})
