import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeLineup, parseRoster, rosterText } from './roster.ts'
import type { Athlete } from './types.ts'

const marlowe: Athlete = { id: 'a1', name: 'Marlowe Holloway' }
const rowan: Athlete = { id: 'a2', name: 'Rowan Hayes' }
const jordan: Athlete = { id: 'a3', name: 'Jordan Blake' }

test('a runner added to the team mid race joins the race', () => {
  const merged = mergeLineup([marlowe], [marlowe], [marlowe, rowan], new Set())
  assert.deepEqual(
    merged.map((a) => a.name),
    ['Marlowe Holloway', 'Rowan Hayes'],
  )
})

test('a runner left out of this race stays out when the team list is edited', () => {
  // Rowan is on the team and was not picked for this race. Adding Jordan to the
  // team must not put Rowan on the course.
  const merged = mergeLineup([marlowe], [marlowe, rowan], [marlowe, rowan, jordan], new Set())
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1', 'a3'],
  )
})

test('a scratch with no crossing leaves the race', () => {
  const merged = mergeLineup([marlowe, rowan], [marlowe, rowan], [marlowe], new Set())
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1'],
  )
})

test('a runner who already crossed stays even after being removed', () => {
  // Passed the split point, then got taken off the team list by mistake. The
  // time is recorded, so dropping the name would orphan it.
  const merged = mergeLineup([marlowe, rowan], [marlowe, rowan], [marlowe], new Set(['a2']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1', 'a2'],
    'kept, and after the team so the grid order still matches the list',
  )
})

test('the team order wins, and nobody is duplicated', () => {
  const reordered = [rowan, jordan, marlowe]
  const merged = mergeLineup(
    [marlowe, rowan, jordan],
    [marlowe, rowan, jordan],
    reordered,
    new Set(['a1', 'a2']),
  )
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a2', 'a3', 'a1'],
  )
})

test('an edited name reaches a runner who has already crossed', () => {
  const fixed: Athlete = { id: 'a1', name: 'Marlowe Holloway-Reed' }
  const merged = mergeLineup([marlowe], [marlowe], [fixed], new Set(['a1']))
  assert.equal(merged.length, 1, 'the same id is not kept twice')
  assert.equal(merged[0].name, 'Marlowe Holloway-Reed')
})

test('clearing the team list keeps only the runners with times', () => {
  const merged = mergeLineup([marlowe, rowan, jordan], [marlowe, rowan, jordan], [], new Set(['a3']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a3'],
  )
})

test('a name typed in during the race survives a team edit', () => {
  const guest: Athlete = { id: 'g1', name: 'Someone Else' }
  const merged = mergeLineup([marlowe, guest], [marlowe], [marlowe, rowan], new Set(['g1']))
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1', 'a2', 'g1'],
    'the new team name joins, and the typed name keeps its time',
  )
})

test('a typed name whose time was taken back off is not kept', () => {
  const guest: Athlete = { id: 'g1', name: 'Someone Else' }
  const merged = mergeLineup([marlowe, guest], [marlowe], [marlowe], new Set())
  assert.deepEqual(
    merged.map((a) => a.id),
    ['a1'],
  )
})

test('a pasted list becomes runners, one per line', () => {
  const parsed = parseRoster('Marlowe Holloway\n  Rowan Hayes  \n\nJordan Blake\n')
  assert.deepEqual(
    parsed.map((a) => a.name),
    ['Marlowe Holloway', 'Rowan Hayes', 'Jordan Blake'],
    'blank lines and stray spaces are dropped',
  )
  assert.equal(new Set(parsed.map((a) => a.id)).size, 3, 'each gets its own id')
})

test('bib numbers on a pasted entry list are stripped, not stored', () => {
  // We know the runners by name and face. An entry list still ships numbers, and
  // a list should paste in as it came out.
  const parsed = parseRoster(
    '14 Rowan Hayes\nJordan Blake, 22\nMarlowe Holloway 7\n101 Chloe Ramirez',
  )
  assert.deepEqual(
    parsed.map((a) => a.name),
    ['Rowan Hayes', 'Jordan Blake', 'Marlowe Holloway', 'Chloe Ramirez'],
  )
  assert.equal(Object.hasOwn(parsed[0], 'bib'), false, 'no bib field survives')
})

test('a name that is only a number is not a runner', () => {
  assert.deepEqual(parseRoster('42\n\n  \n'), [])
})

test('a best time after the name comes in with the runner', () => {
  const parsed = parseRoster(
    'Marlowe Holloway\t21:34.60\nRowan Hayes  22:29.15\nJordan Blake, 24:00\nPriya Whitaker',
  )
  assert.deepEqual(
    parsed.map((a) => a.name),
    ['Marlowe Holloway', 'Rowan Hayes', 'Jordan Blake', 'Priya Whitaker'],
    'a tab, spaces or a comma all separate a name from a time',
  )
  assert.deepEqual(
    parsed.map((a) => a.pr),
    [21 * 60_000 + 34_600, 22 * 60_000 + 29_150, 24 * 60_000, undefined],
    'and a runner with no best time simply has none',
  )
})

test('a bib is still a bib and a time is still a time', () => {
  // The colon is what tells them apart, and a line can carry both.
  const parsed = parseRoster('14 Rowan Hayes 21:34.60\nJordan Blake, 22\n7 Priya Whitaker')
  assert.deepEqual(
    parsed.map((a) => a.name),
    ['Rowan Hayes', 'Jordan Blake', 'Priya Whitaker'],
  )
  assert.deepEqual(parsed.map((a) => a.pr), [21 * 60_000 + 34_600, undefined, undefined])
})

test('a line that is only a time is not a runner', () => {
  assert.deepEqual(parseRoster('21:34.60\n\n  \n'), [])
})

test('the list is text, and the text parses back to the list', () => {
  // One format for a paste, a link, the encrypted roster and the shipped file, so
  // no two of them can drift into disagreeing about what a line means.
  const text = 'Marlowe Holloway\t21:34.60\nRowan Hayes\t22:29.15\nPriya Whitaker'
  const back = parseRoster(text)
  assert.equal(rosterText(back), text)
  assert.equal(
    rosterText(parseRoster('Rowan Hayes  22:29.1')),
    'Rowan Hayes\t22:29.10',
    'a time given loosely comes back in one canonical shape',
  )
})

test('an edited best time reaches a runner who already crossed', () => {
  // A PR set on Saturday morning, typed in before the afternoon race, on a runner
  // who already has a time at this station.
  const faster: Athlete = { id: 'a1', name: 'Marlowe Holloway', pr: 20 * 60_000 }
  const merged = mergeLineup([marlowe], [marlowe], [faster], new Set(['a1']))
  assert.deepEqual(merged, [faster])
})

test('hyphenated and apostrophe names are left alone', () => {
  const parsed = parseRoster("Bex O'Neal-Ruiz\nAnne-Marie St. James")
  assert.deepEqual(
    parsed.map((a) => a.name),
    ["Bex O'Neal-Ruiz", 'Anne-Marie St. James'],
  )
})
