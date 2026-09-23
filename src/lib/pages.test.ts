import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HANDED_OUT,
  HELP_PATH,
  meetFilePath,
  PAGES,
  pageAt,
  PUBLISHED,
  SEASONS,
  seasonCoachPath,
  seasonMeets,
  seasonName,
  seasonPath,
} from './pages.ts'

const BASE = '/splitssss/'
const MEET = {
  slug: 'yellow-jacket',
  year: 2026,
  team: 'girls' as const,
  date: '2026-09-12',
  name: 'Yellow Jacket Invitational',
}
const GIRLS = { year: 2026, team: 'girls' as const }

test('a season address carries its year and its team', () => {
  assert.equal(seasonPath(GIRLS), 'meets/2026/girls/')
  assert.equal(seasonCoachPath(GIRLS), 'meets/2026/girls/coach/')
  assert.equal(seasonPath({ ...GIRLS, team: 'boys' }), 'meets/2026/boys/')
  assert.equal(meetFilePath(MEET), 'meets/2026/girls/yellow-jacket.dat')
})

test('the same invitational in two seasons is two addresses', () => {
  // The whole reason the year is in the path. Without it, next September's file
  // would overwrite this one and every link already texted out would silently start
  // showing a different race.
  const next = { ...MEET, year: 2027 }
  assert.notEqual(seasonPath(next), seasonPath(MEET))
  assert.notEqual(meetFilePath(next), meetFilePath(MEET))
})

test("the girls' and boys' files from one invitational do not collide", () => {
  assert.notEqual(meetFilePath({ ...MEET, team: 'boys' }), meetFilePath(MEET))
})

test('the new file is not at the v1 path, which old phones still ask for', () => {
  // A phone mid-update runs the old bundle, which reads the old path as v1. Putting
  // the v2 file there would break it; putting it anywhere else leaves it working.
  assert.notEqual(meetFilePath(MEET), 'meets/2026/yellow-jacket.dat')
})

test('the Yellow Jacket links were handed out, and they stay for good', () => {
  // These two addresses were texted to parents and to the team before seasons had
  // pages. They are in people's message threads for good, so they are not dead
  // routes to tidy away: deleting either one breaks a link somebody already has.
  for (const path of ['/splitssss/meets/2026/yellow-jacket/', '/splitssss/meets/2026/yellow-jacket']) {
    const page = pageAt(path, BASE)
    assert.equal(page?.kind, 'results', path)
    assert.equal(page?.kind === 'results' && page.meet?.slug, 'yellow-jacket', path)
    assert.deepEqual(page?.kind === 'results' && page.season, GIRLS, path)
  }
  for (const path of ['/splitssss/meets/2026/yellow-jacket/coach/', '/splitssss/meets/2026/yellow-jacket/coach']) {
    const page = pageAt(path, BASE)
    assert.equal(page?.kind, 'coach', path)
    assert.equal(page?.kind === 'coach' && page.meet?.slug, 'yellow-jacket', path)
  }
  assert.ok(HANDED_OUT.some((a) => a.path === 'meets/2026/yellow-jacket/'))
})

test('every handed-out address names a meet that is still published', () => {
  for (const alias of HANDED_OUT) {
    assert.ok(
      PUBLISHED.some((m) => m.year === alias.year && m.team === alias.team && m.slug === alias.slug),
      alias.path,
    )
  }
})

test('a season page opens on its newest meet', () => {
  const page = pageAt('/splitssss/meets/2026/girls/', BASE)
  assert.equal(page?.kind, 'results')
  assert.equal(page?.kind === 'results' && page.meet?.slug, seasonMeets(GIRLS)[0].slug)
})

test('a season is ordered by date, whatever order PUBLISHED is in', () => {
  const dates = seasonMeets(GIRLS).map((m) => m.date)
  assert.deepEqual(dates, [...dates].sort().reverse())
})

test('a season with nothing published is a page, and it opens on no meet', () => {
  // The boys are still onboarding. Their season link can go out before their data
  // does, so it has to be a real page that says there is nothing yet, not a 404.
  for (const path of ['/splitssss/meets/2026/boys/', '/splitssss/meets/2026/boys/coach/']) {
    const page = pageAt(path, BASE)
    assert.ok(page && page.kind !== 'help', path)
    assert.equal(page.meet, null, path)
    assert.equal(seasonName(page), 'Boys 2026')
  }
})

test('a pathname resolves to the page it names', () => {
  assert.equal(pageAt('/splitssss/meets/2026/girls/', BASE)?.kind, 'results')
  assert.equal(pageAt('/splitssss/meets/2026/girls/coach/', BASE)?.kind, 'coach')
  assert.equal(pageAt('/splitssss/help/', BASE)?.kind, 'help')
})

test('the trailing slash is optional', () => {
  // Pages redirects the slashless form to the directory, but a person who types the
  // URL, or a messaging app that trims it, must still land on the page.
  assert.equal(pageAt('/splitssss/meets/2026/girls', BASE)?.kind, 'results')
  assert.equal(pageAt('/splitssss/meets/2026/girls/coach', BASE)?.kind, 'coach')
  assert.equal(pageAt('/splitssss/help', BASE)?.kind, 'help')
})

test('the coach page and the athlete page are never each other', () => {
  // The coach page sits underneath the athlete page, so a prefix match would read
  // one as the other. The coach page is the only thing on this site with the whole
  // team's numbers side by side, and a link texted to a team landing there instead
  // would be the one mistake that actually matters.
  for (const athlete of ['meets/2026/girls/', 'meets/2026/boys/', 'meets/2026/yellow-jacket/']) {
    assert.equal(pageAt(`${BASE}${athlete}`, BASE)?.kind, 'results', athlete)
    assert.equal(pageAt(`${BASE}${athlete}coach/`, BASE)?.kind, 'coach', athlete)
  }
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
    '/splitssss/meets/2027/girls/',
    '/splitssss/meets/2026/coed/',
    '/splitssss/meets/2026/girls/yellow-jacket/',
    '/splitssss/meets/2026/girls/coach/extra/',
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
  assert.equal(pageAt('/meets/2026/girls/', '/')?.kind, 'results')
  assert.equal(pageAt('/meets/2026/yellow-jacket/', '/')?.kind, 'results')
  assert.equal(pageAt('/help/', '/')?.kind, 'help')
  assert.equal(pageAt('/', '/'), null)
})

test('both teams have a season page in every year with a meet, and no other year', () => {
  // PAGES is what the build writes files for. A season with no page here would be
  // results nothing can reach; a page here with no file written would be a 404 for
  // whoever was sent the link.
  assert.ok(PAGES.some((p) => p.kind === 'help' && p.path === HELP_PATH))
  const years = new Set(PUBLISHED.map((m) => m.year))
  assert.equal(SEASONS.length, years.size * 2)
  for (const season of SEASONS) {
    assert.ok(years.has(season.year))
    assert.ok(PAGES.some((p) => p.kind === 'results' && p.path === seasonPath(season)))
    assert.ok(PAGES.some((p) => p.kind === 'coach' && p.path === seasonCoachPath(season)))
  }
  for (const meet of PUBLISHED) {
    assert.ok(
      SEASONS.some((s) => s.year === meet.year && s.team === meet.team),
      `${meet.slug} is in a season`,
    )
  }
  assert.equal(PAGES.length, 1 + SEASONS.length * 2 + HANDED_OUT.length * 2)
})

test('every page path is unique', () => {
  // A meet slug of "girls" would otherwise put a handed-out address on top of a
  // season, and the router would answer with whichever came first.
  const paths = PAGES.map((p) => p.path)
  assert.equal(new Set(paths).size, paths.length)
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
