import assert from 'node:assert/strict'
import { test } from 'node:test'
import { meetText, parseMeet } from './meet.ts'
import { scrambleMeet, unscrambleMeet } from './meetfile.ts'
import { scrambleTeam } from './teamfile.ts'

// Invented runners, like everywhere else in these tests.
const MEET = parseMeet(
  [
    '# meet Yellow Jacket Invitational',
    '# date 2026-09-12',
    '# team girls',
    '# event Varsity',
    '# marks 0.5mi 1mi 2mi 2.6mi',
    'Rowan H.\t2:53.30\t5:52.90\t12:04.60\t15:58.20\t19:08.66\t18:42.53',
    '# event JV',
    '# marks 1mi 2mi',
    'Jordan B.\t7:54.40\t16:54.80\t27:04.84\t22:40.25',
  ].join('\n'),
)

test('a meet round trips through the file', () => {
  const back = unscrambleMeet(scrambleMeet(MEET))
  assert.ok(back)
  assert.equal(meetText(back), meetText(MEET))
})

test('nothing in the file is readable', () => {
  const body = scrambleMeet(MEET)
  for (const label of ['Rowan H.', 'Jordan B.', 'Rowan', 'RowanH.']) {
    assert.ok(!body.includes(label), `${label} appears in the file`)
  }
  assert.ok(!body.includes('19:08.66'), 'a finish time appears in the clear')
  assert.ok(!body.includes('Yellow Jacket'), 'the meet name appears in the clear')
  assert.ok(!body.includes('splitssss'), 'the header appears in the clear')
})

test('the same meet rebuilds byte for byte, so a rebuild is not a diff', () => {
  assert.equal(scrambleMeet(MEET), scrambleMeet(MEET))
})

test('half a file is nothing, not half a results table', () => {
  // The failure this is guarding against is quiet: an athlete scrolling a truncated
  // dropdown and not finding her name would conclude she was left out of the
  // results, when in fact the download was cut short.
  const body = scrambleMeet(MEET)
  for (const cut of [1, 4, 20, body.length - 1]) {
    assert.equal(unscrambleMeet(body.slice(0, cut)), null, `${cut} characters decoded to a meet`)
  }
  assert.equal(unscrambleMeet(''), null)
  assert.equal(unscrambleMeet('   '), null)
})

test('a team file served as a results file is refused outright', () => {
  // The whole reason each file type has its own key and its own header. With a
  // shared keystream this would decode to plausible-looking text and half parse.
  const team = scrambleTeam(['Rowan H.', 'Jordan B.'])
  assert.equal(unscrambleMeet(team), null)
})

test('anything that is not one of our files is refused', () => {
  for (const junk of ['hello', 'not base64 at all!!', '####', 'AAAA']) {
    assert.equal(unscrambleMeet(junk), null, `${junk} decoded to a meet`)
  }
})

test('a meet with no runners in it is not a meet', () => {
  const empty = scrambleMeet({ name: 'Nothing', date: '2026-09-12', team: 'girls', events: [] })
  assert.equal(unscrambleMeet(empty), null)
})

test('trailing whitespace from a file read does not break it', () => {
  // The tool writes a trailing newline, because a text file should end in one.
  const back = unscrambleMeet(`${scrambleMeet(MEET)}\n`)
  assert.ok(back)
  assert.equal(back.events.flatMap((e) => e.runners).length, 2)
})
