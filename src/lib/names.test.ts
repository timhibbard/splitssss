import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import { displayNames, nameParts, shortName, shortNames, summarize } from './names.ts'
import type { Athlete } from './types.ts'

// Invented runners throughout. The real team never appears in this repository,
// which is public, and these are minors: see the note in DESIGN.md.

test('a two word name is a first name and a surname', () => {
  assert.deepEqual(nameParts('Rowan Hayes'), { first: 'Rowan', last: 'Hayes' })
})

test('three words means a two word first name', () => {
  assert.deepEqual(nameParts('Anna Grace Fielding'), { first: 'Anna Grace', last: 'Fielding' })
  assert.deepEqual(nameParts('Ruth Ann Calloway'), { first: 'Ruth Ann', last: 'Calloway' })
})

test('one word is all first name', () => {
  assert.deepEqual(nameParts('Marlowe'), { first: 'Marlowe', last: '' })
})

test('stray spaces do not become a surname', () => {
  assert.deepEqual(nameParts('  Quinn   Delgado  '), { first: 'Quinn', last: 'Delgado' })
})

test('the button says a first name and an initial', () => {
  assert.equal(shortName('Rowan Hayes'), 'Rowan H.')
  // A capital inside the first name is left where it is.
  assert.equal(shortName('MacKenzie Ford'), 'MacKenzie F.')
  assert.equal(shortName('Anna Grace Fielding'), 'Anna Grace F.')
  assert.equal(shortName('Ruth Ann Calloway'), 'Ruth Ann C.')
})

test('a one word name is left alone', () => {
  assert.equal(shortName('Marlowe'), 'Marlowe')
})

test('a surname is spelled out rather than abbreviated to itself', () => {
  // Two letters of a two letter surname is the surname, and "Li L." would be a
  // lie about how much was left off.
  assert.equal(shortName('Quinn Li', 2), 'Quinn Li')
})

test('the whole team gets a label', () => {
  const labels = shortNames(['Rowan Hayes', 'Rowan Lindgren', 'Priya Whitaker'])
  assert.deepEqual(labels, ['Rowan H.', 'Rowan L.', 'Priya W.'])
})

test('two runners never get the same label', () => {
  const labels = shortNames(['Rowan Hayes', 'Rowan Hensley', 'Priya Whitaker'])
  assert.deepEqual(labels, ['Rowan Ha.', 'Rowan He.', 'Priya W.'])
  assert.equal(new Set(labels).size, 3)
})

test('a clash only costs letters for the runners in it', () => {
  const labels = shortNames(['Jordan Blake', 'Jordan Brandt', 'Quinn Delgado'])
  assert.equal(labels[2], 'Quinn D.', 'an unrelated name keeps its initial')
})

test('two labels never differ by only a period', () => {
  // "Marlowe Ho" and "Marlowe Ho." are the same button as far as a thumb is
  // concerned, so the clash keeps growing until they read differently.
  const labels = shortNames(['Marlowe Ho', 'Marlowe Holloway'])
  assert.deepEqual(labels, ['Marlowe Ho', 'Marlowe Hol.'])
})

test('two runners with the same name both get it in full', () => {
  // Rare, and there is nothing better to show. The list order still tells them
  // apart, and neither button claims to be the other runner.
  assert.deepEqual(shortNames(['Jordan Blake', 'Jordan Blake']), ['Jordan Blake', 'Jordan Blake'])
})

test('an empty list is not a problem', () => {
  assert.deepEqual(shortNames([]), [])
})

test('labels come back by id', () => {
  const team: Athlete[] = [
    { id: 'a1', name: 'Priya Whitaker' },
    { id: 'a2', name: 'Marlowe Holloway' },
  ]
  const labels = displayNames(team)
  assert.equal(labels.get('a1'), 'Priya W.')
  assert.equal(labels.get('a2'), 'Marlowe H.')
  assert.equal(labels.get('nobody'), undefined)
})

test('a lineup summary names a few and counts the rest', () => {
  assert.equal(summarize([]), 'nobody yet')
  assert.equal(summarize(['Marlowe H.']), 'Marlowe H.')
  assert.equal(summarize(['Marlowe H.', 'Rowan H.']), 'Marlowe H. and Rowan H.')
  assert.equal(
    summarize(['Marlowe H.', 'Rowan H.', 'Jordan B.', 'Priya W.', 'Quinn D.']),
    'Marlowe H., Rowan H., Jordan B. and 2 more',
  )
})
