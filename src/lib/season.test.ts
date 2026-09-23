import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Meet } from './meet.ts'
import { PAGES, type Published, type ResultsPage } from './pages.ts'
import { firstRace, isHandedOut, racesOf, type SeasonMeet, seasonLabels, shareAddress } from './season.ts'

function runner(label: string) {
  return { label, times: [], finish: 1_200_000, derived: [] }
}

function meet(name: string, labels: string[]): Meet {
  return {
    name,
    date: '2026-09-12',
    team: 'girls',
    events: [{ squad: 'varsity', distance: 5000, markers: [], runners: labels.map(runner) }],
  }
}

function published(slug: string, date: string): Published {
  return { slug, year: 2026, team: 'girls', date, name: slug }
}

const YJ = published('yellow-jacket', '2026-09-12')
const ROCK = published('rockingham', '2026-09-26')
// Newest first, the way seasonFiles hands them over.
const SEASON: SeasonMeet[] = [
  { published: ROCK, meet: meet('Rockingham', ['Rowan H.', 'Jordan B.']) },
  { published: YJ, meet: meet('Yellow Jacket', ['Rowan H.', 'Marlowe H.']) },
]

const seasonPage = PAGES.find((p) => p.path === 'meets/2026/girls/') as ResultsPage
const handedOut = PAGES.find((p) => p.path === 'meets/2026/yellow-jacket/') as ResultsPage

test('the name picker lists everybody who raced any meet, once', () => {
  assert.deepEqual(seasonLabels(SEASON), ['Jordan B.', 'Marlowe H.', 'Rowan H.'])
})

test('a meet still loading or missing adds no names', () => {
  assert.deepEqual(seasonLabels([{ published: ROCK, meet: undefined }, { published: YJ, meet: null }]), [])
})

test('a runner can only pick the meets she ran', () => {
  assert.deepEqual(racesOf('Rowan H.', SEASON).map((r) => r.published.slug), ['rockingham', 'yellow-jacket'])
  assert.deepEqual(racesOf('Marlowe H.', SEASON).map((r) => r.published.slug), ['yellow-jacket'])
  assert.deepEqual(racesOf('Nobody', SEASON), [])
})

test('the season opens a runner on her most recent race', () => {
  assert.equal(firstRace(seasonPage, racesOf('Rowan H.', SEASON))?.published.slug, 'rockingham')
  assert.equal(firstRace(seasonPage, racesOf('Marlowe H.', SEASON))?.published.slug, 'yellow-jacket')
})

test('a handed-out meet address opens on its meet when she ran it', () => {
  // Somebody who taps the Yellow Jacket link from September's text is asking about
  // Yellow Jacket, even after a newer meet is published.
  assert.ok(isHandedOut(handedOut))
  assert.ok(!isHandedOut(seasonPage))
  assert.equal(firstRace(handedOut, racesOf('Rowan H.', SEASON))?.published.slug, 'yellow-jacket')
  // And her own most recent when she did not run it.
  assert.equal(firstRace(handedOut, racesOf('Jordan B.', SEASON))?.published.slug, 'rockingham')
  assert.equal(firstRace(handedOut, []), null)
})

test('the coach texts the handed-out address only for its own meet', () => {
  assert.equal(shareAddress(handedOut, YJ), 'meets/2026/yellow-jacket/')
  assert.equal(shareAddress(handedOut, ROCK), 'meets/2026/girls/')
  assert.equal(shareAddress(seasonPage, ROCK), 'meets/2026/girls/')
  assert.equal(shareAddress(seasonPage, YJ), 'meets/2026/girls/')
})
