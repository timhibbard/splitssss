import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Meet } from './meet.ts'
import { PAGES, type Published, type ResultsPage } from './pages.ts'
import {
  firstRace,
  hasResults,
  isHandedOut,
  markIndex,
  racesOf,
  type SeasonMeet,
  seasonLabels,
  seasonMarks,
  seasonRows,
  shareAddress,
} from './season.ts'

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

/* ---------- one runner's season, for the coach ---------- */

const mark = (label: string, meters: number) => ({ label, meters })
const HALF = mark('0.5 mi', 804.672)
const ONE = mark('1 mi', 1609.344)
const TWO = mark('2 mi', 3218.688)

function timedMeet(name: string, events: { squad: 'varsity' | 'jv'; markers: { label: string; meters: number }[]; labels: string[] }[]): Meet {
  return {
    name,
    date: '2026-09-12',
    team: 'girls',
    events: events.map(({ squad, markers, labels }) => ({
      squad,
      distance: 5000,
      markers,
      runners: labels.map((label) => ({
        label,
        times: markers.map((m) => (1_200_000 * m.meters) / 5000),
        finish: 1_200_000,
        derived: [],
      })),
    })),
  }
}

const TIMED: SeasonMeet[] = [
  { published: ROCK, meet: timedMeet('Rockingham', [{ squad: 'jv', markers: [ONE, TWO], labels: ['Rowan H.'] }]) },
  {
    published: YJ,
    meet: timedMeet('Yellow Jacket', [
      { squad: 'varsity', markers: [HALF, TWO], labels: ['Rowan H.', 'Marlowe H.'] },
      { squad: 'jv', markers: [ONE, TWO], labels: ['Jordan B.'] },
    ]),
  },
]

test("a runner's season is her rows, newest first, with the race each was in", () => {
  const races = seasonRows('Rowan H.', TIMED)
  assert.deepEqual(
    races.map((r) => [r.published.slug, r.row.event.squad, r.row.observed.label]),
    [
      ['rockingham', 'jv', 'Rowan H.'],
      ['yellow-jacket', 'varsity', 'Rowan H.'],
    ],
  )
})

test('a mark timed at any meet is one column, in course order', () => {
  const races = seasonRows('Rowan H.', TIMED)
  assert.deepEqual(
    seasonMarks(races).map((m) => m.label),
    ['0.5 mi', '1 mi', '2 mi'],
  )
})

test('a mark a meet did not time is not found in it, never estimated', () => {
  const [rock, yj] = seasonRows('Rowan H.', TIMED)
  assert.equal(markIndex(rock.row, HALF), -1)
  assert.equal(markIndex(yj.row, HALF), 0)
  assert.equal(markIndex(yj.row, ONE), -1)
  assert.equal(markIndex(yj.row, TWO), 1)
})

test('a runner who raced nowhere has no season', () => {
  assert.deepEqual(seasonRows('Nobody Z.', TIMED), [])
})

test('a meet published ahead with only plans is there to pick but does not open', () => {
  const ahead: Meet = {
    ...meet('Upcoming', ['Rowan H.']),
    events: [
      {
        squad: 'varsity',
        distance: 5000,
        markers: [],
        runners: [{ label: 'Rowan H.', times: [], derived: [], plan: { times: [], finish: 1_140_000 } }],
      },
    ],
  }
  const withAhead: SeasonMeet[] = [{ published: published('upcoming', '2026-10-03'), meet: ahead }, ...SEASON]
  assert.equal(hasResults(ahead), false)
  assert.equal(hasResults(SEASON[0].meet), true)
  assert.deepEqual(racesOf('Rowan H.', withAhead).map((r) => r.published.slug), ['upcoming', 'rockingham', 'yellow-jacket'])
  assert.equal(firstRace(seasonPage, racesOf('Rowan H.', withAhead))?.published.slug, 'rockingham')
  // Nothing with results at all, and the newest is still what opens.
  assert.equal(firstRace(seasonPage, withAhead.slice(0, 1))?.published.slug, 'upcoming')
  // And it is not a race in the season's comparisons.
  assert.deepEqual(seasonRows('Rowan H.', withAhead).map((r) => r.published.slug), ['rockingham', 'yellow-jacket'])
})
