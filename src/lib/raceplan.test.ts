import assert from 'node:assert/strict'
import { test } from 'node:test'
// Explicit extensions: see the note in link.ts.
import { parseMeet } from './meet.ts'
import type { Published } from './pages.ts'
import { plannedHere, publishedFor } from './raceplan.ts'

const MEET = parseMeet(
  [
    '# meet Regions',
    '# date 2026-10-24',
    '# team girls',
    '',
    '# event Varsity',
    '# marks 0.5mi 1mi 2mi 2.6mi',
    'Rowan H.\t\t\t\t\t\t19:55.65',
    '# plan Rowan H.\t03:02.5\t06:20.0\t12:55.0\t16:52.0\t19:47.0',
    'Kit M.\t\t\t\t\t\t20:17.75',
    '',
    '# event JV',
    '# marks 0.5mi 1mi 2mi 2.6mi',
    'Jordan B.\t\t\t\t\t\t21:53.03',
    '# plan Jordan B.\t03:52.5\t07:52.5\t15:52.5\t20:40.5\t24:33.0',
  ].join('\n'),
)

const race = (name: string, meters?: number) => ({
  race: name,
  station: { label: 'here', meters },
  raceMeters: 5000,
})

test('a phone at a marker gets each runner of its race at that marker, as the sheet says', () => {
  assert.deepEqual([...plannedHere(MEET, race('Varsity Girls', 805))], [['Rowan H.', 182_500]])
  assert.deepEqual([...plannedHere(MEET, race('JV Girls', 3219))], [['Jordan B.', 952_500]])
})

test('a phone at the finish gets the planned finish', () => {
  assert.deepEqual([...plannedHere(MEET, race('JV Girls', 5000))], [['Jordan B.', 1_473_000]])
})

test('nowhere the plan has a time, nowhere known, or a race the meet does not have, is nothing', () => {
  assert.equal(plannedHere(MEET, race('Varsity Girls', 1200)).size, 0)
  assert.equal(plannedHere(MEET, race('Varsity Girls')).size, 0)
  assert.equal(plannedHere(MEET, race('Fr/So Girls', 805)).size, 0)
})

test('a plan is for its own team and its own day', () => {
  const list: Published[] = [
    { slug: 'starlight', year: 2026, team: 'girls', date: '2026-10-17', name: 'Starlight' },
    { slug: 'regions', year: 2026, team: 'girls', date: '2026-10-24', name: 'Regions' },
  ]
  const on = (date: string, meet: string, team?: 'girls' | 'boys') => publishedFor({ date, meet, team }, list)?.slug
  assert.equal(on('2026-10-24', 'Region 1-5A', 'girls'), 'regions')
  assert.equal(on('2026-10-24', 'Regions', 'boys'), undefined)
  assert.equal(on('2026-10-24', 'Regions'), undefined)
  // The week before, by name, which is how the phones get tried out.
  assert.equal(on('2026-10-22', ' regions ', 'girls'), 'regions')
  assert.equal(on('2026-10-22', 'Practice', 'girls'), undefined)
  // Never a meet already run, whatever the phone calls it.
  assert.equal(on('2026-10-25', 'Regions', 'girls'), undefined)
  assert.equal(on('2026-10-22', 'Starlight', 'girls'), undefined)
})
