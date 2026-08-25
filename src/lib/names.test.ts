import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import { displayNames, nameParts, shortName, shortNames, summarize } from './names.ts'
import type { Athlete } from './types.ts'

test('a two word name is a first name and a surname', () => {
  assert.deepEqual(nameParts('Caroline King'), { first: 'Caroline', last: 'King' })
})

test('three words means a two word first name', () => {
  assert.deepEqual(nameParts('Mary Eliza Duncan'), { first: 'Mary Eliza', last: 'Duncan' })
  assert.deepEqual(nameParts('Mary Ward McGee'), { first: 'Mary Ward', last: 'McGee' })
})

test('one word is all first name', () => {
  assert.deepEqual(nameParts('Adalyn'), { first: 'Adalyn', last: '' })
})

test('stray spaces do not become a surname', () => {
  assert.deepEqual(nameParts('  Zoe   Wong  '), { first: 'Zoe', last: 'Wong' })
})

test('the button says a first name and an initial', () => {
  assert.equal(shortName('Caroline King'), 'Caroline K.')
  assert.equal(shortName('MyAngel Gates'), 'MyAngel G.')
  assert.equal(shortName('Mary Eliza Duncan'), 'Mary Eliza D.')
  assert.equal(shortName('Mary Ward McGee'), 'Mary Ward M.')
})

test('a one word name is left alone', () => {
  assert.equal(shortName('Adalyn'), 'Adalyn')
})

test('a surname is spelled out rather than abbreviated to itself', () => {
  // Two letters of a two letter surname is the surname, and "Li L." would be a
  // lie about how much was left off.
  assert.equal(shortName('Joyce Li', 2), 'Joyce Li')
})

test('the whole team gets a label', () => {
  const labels = shortNames(['Emma Richard', 'Emma Leipold', 'Karen Izumi'])
  assert.deepEqual(labels, ['Emma R.', 'Emma L.', 'Karen I.'])
})

test('two runners never get the same label', () => {
  const labels = shortNames(['Emma Richard', 'Emma Rowe', 'Karen Izumi'])
  assert.deepEqual(labels, ['Emma Ri.', 'Emma Ro.', 'Karen I.'])
  assert.equal(new Set(labels).size, 3)
})

test('a clash only costs letters for the runners in it', () => {
  const labels = shortNames(['Addie Smith', 'Addie Snow', 'Zoe Wong'])
  assert.equal(labels[2], 'Zoe W.', 'an unrelated name keeps its initial')
})

test('two labels never differ by only a period', () => {
  // "Ella Hu" and "Ella Hu." are the same button as far as a thumb is
  // concerned, so the clash keeps growing until they read differently.
  const labels = shortNames(['Ella Hu', 'Ella Hugley'])
  assert.deepEqual(labels, ['Ella Hu', 'Ella Hug.'])
})

test('two runners with the same name both get it in full', () => {
  // Rare, and there is nothing better to show. The list order still tells them
  // apart, and neither button claims to be the other runner.
  assert.deepEqual(shortNames(['Addie Smith', 'Addie Smith']), ['Addie Smith', 'Addie Smith'])
})

test('an empty list is not a problem', () => {
  assert.deepEqual(shortNames([]), [])
})

test('labels come back by id', () => {
  const team: Athlete[] = [
    { id: 'a1', name: 'Niamh Novak' },
    { id: 'a2', name: 'Nasly Segura' },
  ]
  const labels = displayNames(team)
  assert.equal(labels.get('a1'), 'Niamh N.')
  assert.equal(labels.get('a2'), 'Nasly S.')
  assert.equal(labels.get('nobody'), undefined)
})

test('a lineup summary names a few and counts the rest', () => {
  assert.equal(summarize([]), 'nobody yet')
  assert.equal(summarize(['Caroline K.']), 'Caroline K.')
  assert.equal(summarize(['Caroline K.', 'Emma R.']), 'Caroline K. and Emma R.')
  assert.equal(
    summarize(['Caroline K.', 'Emma R.', 'Karen I.', 'Niamh N.', 'Sasha C.']),
    'Caroline K., Emma R., Karen I. and 2 more',
  )
})
