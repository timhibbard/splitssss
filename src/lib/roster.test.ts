import assert from 'node:assert/strict'
import { test } from 'node:test'
import { byTeam, mergeLineup, parseRoster, rosterText } from './roster.ts'
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

test('a heading puts the runners under it on that team', () => {
  const parsed = parseRoster(
    '# Girls\nMarlowe Holloway\t21:34.60\nRowan Hayes\n\n# Boys\nJordan Blake\t17:12.40\nQuinn Delgado',
  )
  assert.deepEqual(
    parsed.map((a) => [a.name, a.team]),
    [
      ['Marlowe Holloway', 'girls'],
      ['Rowan Hayes', 'girls'],
      ['Jordan Blake', 'boys'],
      ['Quinn Delgado', 'boys'],
    ],
    'a heading is never a runner, and it holds until the next one',
  )
  assert.deepEqual(parsed.map((a) => a.pr), [
    21 * 60_000 + 34_600,
    undefined,
    17 * 60_000 + 12_400,
    undefined,
  ])
})

test('a list with no headings parses exactly as it always did', () => {
  // The migration case. A link texted last week and a phone holding last
  // season's paste both have to keep working, untagged.
  const parsed = parseRoster('Marlowe Holloway\t21:34.60\nRowan Hayes')
  assert.deepEqual(
    parsed.map((a) => a.team),
    [undefined, undefined],
  )
  assert.equal(Object.hasOwn(parsed[0], 'team'), false, 'and no empty field rides along')
})

test('a heading with nobody under it is not an error', () => {
  assert.deepEqual(parseRoster('# Boys\n\n# Girls\nRowan Hayes').map((a) => [a.name, a.team]), [
    ['Rowan Hayes', 'girls'],
  ])
  assert.deepEqual(parseRoster('# Boys\n'), [], 'and a file of nothing but a heading is empty')
})

test('a heading naming neither team leaves the runners untagged', () => {
  // Untagged matches every race, so an unrecognized heading loses the grouping
  // and never loses the runners.
  const parsed = parseRoster('# Freshmen\nRowan Hayes\n# Boys\nJordan Blake')
  assert.deepEqual(
    parsed.map((a) => [a.name, a.team]),
    [
      ['Rowan Hayes', undefined],
      ['Jordan Blake', 'boys'],
    ],
  )
})

test('a hash on a runner line is still a heading, not a name', () => {
  // Nothing produces "#14 Rowan Hayes", and reading it as a runner named
  // "#14 Rowan Hayes" would put that on a button. Dropped instead.
  assert.deepEqual(parseRoster('#14 Rowan Hayes').length, 0)
})

test('two teams round trip through the text, grouped', () => {
  const text = '# Girls\nMarlowe Holloway\t21:34.60\nRowan Hayes\n# Boys\nJordan Blake\t17:12.40'
  assert.equal(rosterText(parseRoster(text)), text)
})

test('untagged runners come first, with no heading over them', () => {
  // What a phone looks like halfway through adopting: a shipped list taken up
  // alongside a name somebody typed in. The plain lines have to stay plain, or
  // the next parse would read them as belonging to whichever team came last.
  const mixed: Athlete[] = [
    { id: 'b1', name: 'Jordan Blake', team: 'boys' },
    { id: 'x1', name: 'Someone Else' },
    { id: 'g1', name: 'Rowan Hayes', team: 'girls' },
  ]
  assert.equal(rosterText(mixed), 'Someone Else\n# Boys\nJordan Blake\n# Girls\nRowan Hayes')
  assert.deepEqual(
    parseRoster(rosterText(mixed)).map((a) => [a.name, a.team]),
    [
      ['Someone Else', undefined],
      ['Jordan Blake', 'boys'],
      ['Rowan Hayes', 'girls'],
    ],
  )
})

test('the race at the end of a line comes in with the runner', () => {
  const parsed = parseRoster(
    'Karen Izumi\t20:17.75\tVarsity\nJoyce Chen\t22:40.16\tJV\nPriya Whitaker\t24:00.00',
  )
  assert.deepEqual(
    parsed.map((a) => [a.name, a.squad]),
    [
      ['Karen Izumi', 'varsity'],
      ['Joyce Chen', 'jv'],
      ['Priya Whitaker', undefined],
    ],
  )
  assert.deepEqual(parsed.map((a) => a.pr), [
    20 * 60_000 + 17_750,
    22 * 60_000 + 40_160,
    24 * 60_000,
  ])
})

test('the race and the time come off the line in either order', () => {
  // A list lives in a spreadsheet and a spreadsheet's columns come out in
  // whatever order they sit in. The alternative is "Varsity" ending up in a name.
  assert.deepEqual(
    parseRoster('Karen Izumi  Varsity  20:17.75').map((a) => [a.name, a.squad, a.pr]),
    [['Karen Izumi', 'varsity', 20 * 60_000 + 17_750]],
  )
  assert.deepEqual(
    parseRoster('Joyce Chen  JV').map((a) => [a.name, a.squad, a.pr]),
    [['Joyce Chen', 'jv', undefined]],
    'and a race with no time is still a race',
  )
})

test('junior varsity spelled out on a line is JV', () => {
  assert.deepEqual(
    parseRoster('Joyce Chen  22:40.16  Junior Varsity').map((a) => [a.name, a.squad]),
    [['Joyce Chen', 'jv']],
    'and the word varsity inside it does not win',
  )
})

test('a line with a race and a bib keeps neither in the name', () => {
  const parsed = parseRoster('14 Karen Izumi 20:17.75 Varsity\nJoyce Chen, 22, JV')
  assert.deepEqual(
    parsed.map((a) => [a.name, a.squad]),
    [
      ['Karen Izumi', 'varsity'],
      ['Joyce Chen', 'jv'],
    ],
  )
})

test('a line that is only a race is not a runner', () => {
  assert.deepEqual(parseRoster('Varsity\nJV\n'), [], 'a header row out of a spreadsheet')
})

test('the races round trip through the text', () => {
  // The channel that matters: this is the format the shipped file and a shared
  // link both carry, so the lineup a coach set on Thursday reaches every phone.
  const text = '# Girls\nKaren Izumi\t20:17.75\tVarsity\nJoyce Chen\t22:40.16\tJV\nPriya Whitaker'
  assert.equal(rosterText(parseRoster(text)), text)
})

test('a list with no races parses and writes exactly as it always did', () => {
  // The boys' list, and any phone holding one from before. Nothing gains a field.
  const text = '# Boys\nJordan Blake\t17:12.40\nQuinn Delgado'
  const parsed = parseRoster(text)
  assert.equal(Object.hasOwn(parsed[0], 'squad'), false, 'no empty field rides along')
  assert.equal(rosterText(parsed), text)
})

test('grouping is the same for the text and the screen', () => {
  const groups = byTeam([
    { id: 'g1', name: 'Rowan Hayes', team: 'girls' },
    { id: 'b1', name: 'Jordan Blake', team: 'boys' },
    { id: 'g2', name: 'Marlowe Holloway', team: 'girls' },
  ])
  assert.deepEqual(
    groups.map((g) => [g.team, g.athletes.map((a) => a.id)]),
    [
      ['girls', ['g1', 'g2']],
      ['boys', ['b1']],
    ],
    'first appearance order, and nobody appears twice',
  )
  assert.deepEqual(byTeam([]), [], 'an empty list is no groups, not one empty one')
})
