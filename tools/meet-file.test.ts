import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { unscrambleMeet } from '../src/lib/meetfile.ts'

// The tool itself, run the way `npm run meet-file` runs it, in a scratch directory
// so what it writes under public/ lands there and nowhere near the real one.
const TOOL = fileURLToPath(new URL('./meet-file.ts', import.meta.url))

function run(name: string, text: string, dir = mkdtempSync(join(tmpdir(), 'meet-file-'))) {
  mkdirSync(join(dir, 'meets'), { recursive: true })
  writeFileSync(join(dir, 'meets', name), text)
  const out = spawnSync(process.execPath, [TOOL, `meets/${name}`], { cwd: dir, encoding: 'utf8' })
  return { dir, status: out.status, says: out.stderr }
}

const HEAD = '# meet Rockingham Invitational\n# date 2026-09-26\n# team girls\n\n# event Varsity\n# marks 1mi 2mi\n'
const ROWAN = 'Rowan Hayes\t6:10.0\t12:30.0\t19:40.00\t20:00.00\n'
const JORDAN = 'Jordan Bell\t6:20.0\t12:50.0\t20:10.00\t20:30.00\n'

test('a row of the wrong width exits non-zero and writes nothing', () => {
  // The guard that keeps a shifted column from becoming somebody's split.
  const { dir, status, says } = run('rockingham-girls.txt', `${HEAD}${ROWAN}Jordan Bell\t6:20.0\t20:10.00\t20:30.00\n`)
  assert.notEqual(status, 0)
  assert.match(says, /line 8/)
  assert.equal(existsSync(join(dir, 'public')), false)
})

test('a DNF publishes, with her marks and no finish, and says whose', () => {
  // One DNF must not strand the rest of a reconciled meet.
  const dnf = 'Marlowe Holloway\t6:40.0\t13:30.0\t-\t21:00.00\n'
  const { dir, status, says } = run('rockingham-girls.txt', `${HEAD}${ROWAN}${dnf}`)
  assert.equal(status, 0, says)
  assert.match(says, /No finish time for Marlowe H\./)
  const meet = unscrambleMeet(readFileSync(join(dir, 'public/meets/2026/girls/rockingham.dat'), 'utf8'))
  const her = meet?.events[0].runners.find((r) => r.label === 'Marlowe H.')
  assert.equal(her?.finish, undefined)
  assert.deepEqual(her?.times, [400_000, 810_000])
})

test('the team suffix comes off the slug, so both teams publish side by side', () => {
  const girls = run('rockingham-girls.txt', `${HEAD}${ROWAN}`)
  assert.equal(girls.status, 0, girls.says)
  assert.ok(existsSync(join(girls.dir, 'public/meets/2026/girls/rockingham.dat')))
  const boys = run('rockingham-boys.txt', `${HEAD.replace('team girls', 'team boys')}${ROWAN}`, girls.dir)
  assert.equal(boys.status, 0, boys.says)
  assert.ok(existsSync(join(girls.dir, 'public/meets/2026/boys/rockingham.dat')))
})

test('a suffix that disagrees with the team line is refused', () => {
  const { dir, status, says } = run('rockingham-boys.txt', `${HEAD}${ROWAN}`)
  assert.notEqual(status, 0)
  assert.match(says, /named for the boys/)
  assert.equal(existsSync(join(dir, 'public')), false)
})

test('a slug that would sit on a season page is refused', () => {
  const { status } = run('girls.txt', `${HEAD}${ROWAN}`)
  assert.notEqual(status, 0)
})

test('a label that drifted between meets is pointed out', () => {
  // A second Emma L. joining grows the first one's label, and without this her
  // season splits into two people with nobody told.
  const first = run('yellow-jacket-girls.txt', `${HEAD.replace('Rockingham', 'Yellow Jacket')}${ROWAN}Emma Lane\t6:30.0\t13:00.0\t20:30.00\t21:00.00\n`)
  assert.equal(first.status, 0, first.says)
  assert.match(first.says, /First girls meet of 2026/)
  const second = run(
    'rockingham-girls.txt',
    `${HEAD}${ROWAN}${JORDAN}Emma Lane\t6:30.0\t13:00.0\t20:30.00\t21:00.00\nEmma Larkin\t6:35.0\t13:10.0\t20:45.00\t21:00.00\n`,
    first.dir,
  )
  assert.equal(second.status, 0, second.says)
  assert.match(second.says, /First time this season: .*Jordan B\./)
  assert.match(second.says, /Same runner\? "Emma La[a-z]*\." here and "Emma L\." at Yellow Jacket Invitational/)
})
