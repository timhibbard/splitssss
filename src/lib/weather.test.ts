import assert from 'node:assert/strict'
import { test } from 'node:test'
import { meetText, parseMeet } from './meet.ts'
import { clockTime, feelsLike, parseReading, readingAt, sky, wind } from './weather.ts'

const SOURCE = [
  '# meet Rockingham',
  '# date 2026-09-26',
  '# team girls',
  '# station KGSP\tGreenville-Spartanburg International Airport',
  '# reading 07:53\t70\t68\t93\t70\t180\t3\tBKN',
  '# reading 08:53\t71\t69\t93\t71\t0\t0\tOVC',
  '# reading 09:46\t72\t70\t93\t-\t-\t-\t-',
  '',
  '# event Varsity',
  '# marks 1mi 2mi',
  '# gun 08:28:51',
  'Rowan H.\t6:00.0\t12:30.0\t19:08.66\t18:42.53',
  '',
  '# event JV',
  '# marks 1mi 2mi',
  '# gun 09:41:36',
  'Jordan B.\t7:54.4\t16:54.8\t27:04.84\t-',
].join('\n')

test('the station, its readings and each gun survive the round trip', () => {
  const meet = parseMeet(SOURCE)
  assert.equal(meet.weather?.station, 'KGSP')
  assert.equal(meet.weather?.readings.length, 3)
  assert.deepEqual(meet.weather?.readings[2], { time: '09:46', tempF: 72, dewF: 70, humidity: 93 })
  assert.deepEqual(meet.events.map((e) => e.gun), ['08:28:51', '09:41:36'])
  assert.deepEqual(parseMeet(meetText(meet)), meet)
})

test('a meet with no weather has none, and writes none', () => {
  const plain = SOURCE.split('\n').filter((l) => !/^# (station|reading|gun)/.test(l)).join('\n')
  const meet = parseMeet(plain)
  assert.equal(meet.weather, undefined)
  assert.equal(meet.events[0].gun, undefined)
  assert.ok(!/station|reading|gun/.test(meetText(meet)))
})

test('a prose comment that starts with the word Weather is still a comment', () => {
  const meet = parseMeet(SOURCE.replace('# team girls', '# team girls\n# Weather, KGSP ASOS, gun 08:28 EDT:'))
  assert.equal(meet.weather?.readings.length, 3)
})

test('bad weather lines are refused with the line', () => {
  const swap = (from: string, to: string) => () => parseMeet(SOURCE.replace(from, to))
  assert.throws(swap('\t180\t3\tBKN', '\t180\tBKN'), /line 5: a reading has 7 cells/)
  assert.throws(swap('08:53\t71', '07:00\t71'), /line 6: .*time order/)
  assert.throws(swap('\tOVC\n# reading 09:46', '\tFOG\n# reading 09:46'), /line 6: the sky is "FOG"/)
  assert.throws(swap('# gun 08:28:51', '# gun 8:28'), /line 11: "8:28" is not a gun time/)
  assert.throws(swap('# station KGSP\tGreenville-Spartanburg International Airport\n', ''), /no "# station"/)
  assert.throws(swap('# marks 1mi 2mi\n# gun 08:28:51', '# marks 1mi 2mi\n# gun 08:28:51\n# reading 10:00\t1\t1\t1\t1\t1\t1\tCLR'), /inside an event/)
})

test('the reading at the gun is the nearest one, the earlier on a tie', () => {
  const { weather } = parseMeet(SOURCE)
  assert.equal(readingAt(weather, '08:28:51')?.time, '08:53')
  assert.equal(readingAt(weather, '09:41:36')?.time, '09:46')
  assert.equal(readingAt(weather, '08:23:00')?.time, '07:53')
  assert.equal(readingAt(weather, undefined), undefined)
  assert.equal(readingAt(undefined, '08:28:51'), undefined)
})

test('how a reading reads', () => {
  assert.equal(clockTime('17:23:46'), '5:23 pm')
  assert.equal(clockTime('00:05'), '12:05 am')
  assert.equal(clockTime('12:00'), '12:00 pm')
  const hot = parseReading(['17:15', '82.4', '69.8', '66', '86.2', '70', '4', 'SCT'])
  const cool = parseReading(['08:35', '62.6', '53.6', '72', '62.6', '330', '4', 'CLR'])
  assert.ok(typeof hot !== 'string' && typeof cool !== 'string')
  assert.equal(feelsLike(hot), 'feels like 86°F')
  assert.equal(feelsLike(cool), undefined, 'not below 80°F')
  assert.equal(wind(hot), 'wind E 4 kt')
  assert.equal(wind(cool), 'wind NW 4 kt')
  assert.equal(wind({ time: '08:53', tempF: 71, windDeg: 0, windKt: 0 }), 'calm')
  assert.equal(sky(hot), 'scattered clouds')
})
