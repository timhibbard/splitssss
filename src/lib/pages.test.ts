import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  coachPath,
  HELP_PATH,
  meetFilePath,
  PAGES,
  pageAt,
  PUBLISHED,
  resultsPath,
} from './pages.ts'

const BASE = '/splitssss/'
const MEET = { slug: 'yellow-jacket', year: 2026, name: 'Yellow Jacket Invitational' }

test('a meet address carries its season', () => {
  assert.equal(resultsPath(MEET), 'meets/2026/yellow-jacket/')
  assert.equal(coachPath(MEET), 'meets/2026/yellow-jacket/coach/')
  assert.equal(meetFilePath(MEET), 'meets/2026/yellow-jacket.dat')
})

test('the same invitational in two seasons is two addresses', () => {
  // The whole reason the year is in the path. Without it, next September's file
  // would overwrite this one and every link already texted out would silently start
  // showing a different race.
  const next = { ...MEET, year: 2027 }
  assert.notEqual(resultsPath(next), resultsPath(MEET))
  assert.notEqual(meetFilePath(next), meetFilePath(MEET))
})

test('a pathname resolves to the page it names', () => {
  const results = pageAt('/splitssss/meets/2026/yellow-jacket/', BASE)
  assert.equal(results?.kind, 'results')
  assert.equal(results?.kind === 'results' && results.meet.slug, 'yellow-jacket')

  const coach = pageAt('/splitssss/meets/2026/yellow-jacket/coach/', BASE)
  assert.equal(coach?.kind, 'coach')

  assert.equal(pageAt('/splitssss/help/', BASE)?.kind, 'help')
})

test('the trailing slash is optional', () => {
  // Pages redirects the slashless form to the directory, but a person who types the
  // URL, or a messaging app that trims it, must still land on the page.
  assert.equal(pageAt('/splitssss/meets/2026/yellow-jacket', BASE)?.kind, 'results')
  assert.equal(pageAt('/splitssss/meets/2026/yellow-jacket/coach', BASE)?.kind, 'coach')
  assert.equal(pageAt('/splitssss/help', BASE)?.kind, 'help')
})

test('the coach page and the athlete page are never each other', () => {
  // The coach page sits underneath the athlete page, so a prefix match would read
  // one as the other. The coach page is the only thing on this site with the whole
  // team's numbers side by side, and a link texted to a team landing there instead
  // would be the one mistake that actually matters.
  assert.equal(pageAt('/splitssss/meets/2026/yellow-jacket/', BASE)?.kind, 'results')
  assert.equal(pageAt('/splitssss/meets/2026/yellow-jacket/coach/', BASE)?.kind, 'coach')
})

test('the app itself is not an addressed page', () => {
  // The home screen is where a volunteer works. It must not be mistaken for one of
  // these, or Back from a results page would have nowhere to go.
  assert.equal(pageAt('/splitssss/', BASE), null)
  assert.equal(pageAt('/splitssss', BASE), null)
})

test('an address that is not one of ours is nothing', () => {
  for (const path of [
    '/splitssss/meets/',
    '/splitssss/meets/2026/',
    '/splitssss/meets/2027/yellow-jacket/',
    '/splitssss/meets/2026/region-meet/',
    '/splitssss/meets/2026/yellow-jacket/coach/extra/',
    '/splitssss/helping/',
    '/splitssss/yellow-jacket/',
    '/other/meets/2026/yellow-jacket/',
    '/meets/2026/yellow-jacket/',
    '',
  ]) {
    assert.equal(pageAt(path, BASE), null, path)
  }
})

test('a custom domain at the root would work the same', () => {
  // base is '/splitssss/' only because of GitHub Pages. Moving off it should not
  // touch the router.
  assert.equal(pageAt('/meets/2026/yellow-jacket/', '/')?.kind, 'results')
  assert.equal(pageAt('/help/', '/')?.kind, 'help')
  assert.equal(pageAt('/', '/'), null)
})

test('every published meet has both of its pages, and help has one', () => {
  // PAGES is what the build writes files for. A meet in PUBLISHED with no page here
  // would be a results file nothing can reach; a page here with no file written
  // would be a 404 for whoever was sent the link.
  assert.ok(PAGES.some((p) => p.kind === 'help' && p.path === HELP_PATH))
  for (const meet of PUBLISHED) {
    assert.ok(
      PAGES.some((p) => p.kind === 'results' && p.path === resultsPath(meet)),
      `${meet.slug} has an athlete page`,
    )
    assert.ok(
      PAGES.some((p) => p.kind === 'coach' && p.path === coachPath(meet)),
      `${meet.slug} has a coach page`,
    )
  }
  assert.equal(PAGES.length, 1 + PUBLISHED.length * 2)
})

test('every page in the list is reachable through the router', () => {
  // The round trip that matters: the address the build writes a file at is the
  // address the app answers on. These are read off one list precisely so they cannot
  // drift, and this is the assertion that says so.
  for (const page of PAGES) {
    const found = pageAt(`${BASE}${page.path}`, BASE)
    assert.equal(found?.path, page.path)
    assert.equal(found?.kind, page.kind)
  }
})

test('every page path is relative and ends in a slash', () => {
  // Relative because it is joined onto the base, and slash-terminated because the
  // file on disk is an index.html inside a directory of that name.
  for (const page of PAGES) {
    assert.equal(page.path.startsWith('/'), false, page.path)
    assert.ok(page.path.endsWith('/'), page.path)
  }
})
