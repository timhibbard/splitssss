// Explicit extensions: see the note in link.ts.
import type { Team } from './types.ts'

/**
 * Every address this app answers on, and the meets whose results are published
 * behind them.
 *
 * These are real paths and not fragments. A static site on GitHub Pages has no
 * server to route anything, so a path only works if a file is actually sitting at
 * it — which is why this list has three readers and one source: the router below
 * decides what a URL means, the build writes an index.html at each of these paths,
 * and the service worker precaches whatever the build wrote. A page in this list
 * with no file behind it would be a 404 for exactly the person who was sent the
 * link, so the list is what makes the file, rather than the two being kept in step
 * by hand.
 *
 * A roster still travels in the fragment, and always will: a fragment is never
 * sent to a server, which is the only reason it is safe to put the names of minors
 * in a link at all. That is a payload, not an address. See link.ts.
 *
 * Results are addressed by season, `/meets/2026/girls/`, because a season is the
 * unit a coach thinks in and because the same invitational comes back every
 * September: /meets/2026/ and /meets/2027/ are different races with the same name,
 * and neither one's link quietly starts showing the other's splits. The team is in
 * it because the girls and the boys run the same meets.
 */

/** A meet whose reconciled results ship with the build. */
export type Published = {
  /**
   * Whose meet this is. A file is one meet for one team, so the girls' and the
   * boys' results from the same invitational are two files side by side.
   */
  team: Team
  /** The day it was run, yyyy-mm-dd, so a season can be put in order. */
  date: string
  /** The last segment of the address, and the name of the data file. */
  slug: string
  /** The season, which is the year in the address and in the data file's path. */
  year: number
  /** What the meet is called, shown before the file has loaded. */
  name: string
  /**
   * How this meet's times were put right before the file was built, for the coach
   * page. Kept here because the file has no memory of it, and per meet because a
   * note about one day's volunteers printed under every meet would be false.
   */
  reconciled?: { title: string; body: string }
}

/**
 * Newest first. Adding a meet is adding a line here and committing the `.dat`
 * that `npm run meet-file` wrote; the tool prints the line to add.
 */
export const PUBLISHED: Published[] = [
  {
    slug: 'yellow-jacket',
    year: 2026,
    team: 'girls',
    date: '2026-09-12',
    name: 'Yellow Jacket Invitational',
    reconciled: {
      title: "Every station's gun was corrected by hand.",
      body:
        'Three of the four volunteers started late — by 2.3 s, 6.6 s and 9.5 s — and the ' +
        'offsets came out of the absolute clock times, not out of what anyone remembered ' +
        'pressing. The 2.6 mile operator reported being "3 to 4 seconds" late and the ' +
        'phone recorded 9.5. This table is the corrected version; the raw exports are not in it.',
    },
  },
  { slug: 'clinton-home-meet-1', year: 2026, team: 'girls', date: '2026-09-22', name: 'Clinton Home Meet #1' },
  {
    slug: 'low-country',
    year: 2026,
    team: 'girls',
    date: '2026-09-26',
    name: 'Low Country',
    reconciled: {
      title: 'Two stations were put on the third phone’s gun.',
      body:
        'Three phones each took their own gun. The one timing 0.5 mi and 2.6 mi read 8:46:32.5, ' +
        'which is the right one; the 1 mi phone read 8:46:34.1, so its splits gained 1.6 s, and ' +
        'the 2 mi phone read 8:46:32.4, so its splits lost 0.1 s. One 2 mi time is the split ' +
        'taker’s written note, shifted the same, and two 0.5 mi times the phone missed were ' +
        'given by the coach.',
    },
  },
]

/** One team's year of meets, which is the unit both results pages are addressed by. */
export type Season = { year: number; team: Team }

const TEAMS: Team[] = ['girls', 'boys']

/**
 * What a page is, for the router. The two results pages carry the season they
 * belong to and the meet they open on, which is `null` for a season with nothing
 * published yet. `athlete` is the athlete page that goes with this one, which is
 * the only address the coach page is allowed to hand out.
 */
export type Page =
  | { kind: 'help'; path: string }
  | { kind: 'results'; path: string; season: Season; meet: Published | null; athlete: string }
  | { kind: 'coach'; path: string; season: Season; meet: Published | null; athlete: string }

/** A results page of either kind. */
export type ResultsPage = Extract<Page, { kind: 'results' | 'coach' }>

/**
 * Paths are relative to the app's base and end in a slash, because that is the
 * form the file on disk takes: `meets/2026/girls/index.html` is what a request for
 * `meets/2026/girls/` gets served. Pages redirects the slashless form to it, and
 * the router below accepts either.
 */
export const HELP_PATH = 'help/'

export function seasonPath(season: Season): string {
  return `meets/${season.year}/${season.team}/`
}

/**
 * The coach's table lives under the athlete page rather than beside it, because it
 * is the same season seen in more detail. It is not secret — nothing here is — but
 * it is not the link that gets texted to a team either.
 */
export function seasonCoachPath(season: Season): string {
  return `${seasonPath(season)}coach/`
}

/**
 * Where a meet's scrambled results sit, relative to the base. Under the team,
 * because the girls' and boys' files from one invitational share a slug.
 *
 * Not where the v1 file sat, `meets/2026/yellow-jacket.dat`, and that is on
 * purpose: a phone mid-update is still running the old bundle out of its own
 * precache and asking the old path for the old format. That file stays committed
 * for good, like every published meet's data and address: nothing that has been
 * linked to is ever taken down.
 */
export function meetFilePath(meet: Published): string {
  return `meets/${meet.year}/${meet.team}/${meet.slug}.dat`
}

/**
 * Every season with a page: both teams, in every year anything is published for.
 * The boys get a season page before they have a meet in it, because the link can
 * go out before the data does, and an empty season is a normal state rather than
 * an error.
 */
export const SEASONS: Season[] = [...new Set(PUBLISHED.map((m) => m.year))]
  .sort((a, b) => b - a)
  .flatMap((year) => TEAMS.map((team) => ({ year, team })))

/** What a season is called on screen before there is a meet to name, `Boys 2026`. */
export function seasonName(page: { season: Season }): string {
  const { team, year } = page.season
  return `${team[0].toUpperCase()}${team.slice(1)} ${year}`
}

/** A season's meets, newest first, read off PUBLISHED rather than trusting its order. */
export function seasonMeets(season: Season): Published[] {
  return PUBLISHED.filter((m) => m.year === season.year && m.team === season.team).sort(
    (a, b) => b.date.localeCompare(a.date),
  )
}

/**
 * Addresses that were texted to parents and to the team before seasons had pages,
 * each with the meet it named. Written out rather than derived, because the string
 * that was handed out is the thing being kept, and **permanent**: a link somebody
 * already has in a message thread has to keep landing on the race it was about.
 * The coach page underneath each one is kept the same way.
 */
export const HANDED_OUT: { path: string; year: number; team: Team; slug: string }[] = [
  { path: 'meets/2026/yellow-jacket/', year: 2026, team: 'girls', slug: 'yellow-jacket' },
]

function handedOutPages(): Page[] {
  return HANDED_OUT.flatMap((alias): Page[] => {
    const meet = PUBLISHED.find(
      (m) => m.year === alias.year && m.team === alias.team && m.slug === alias.slug,
    )
    // A handed-out address whose meet left PUBLISHED is a bug, not a page to drop
    // quietly. The test for HANDED_OUT says so before a build ever gets this far.
    if (!meet) throw new Error(`${alias.path} was handed out and names no published meet`)
    const season = { year: meet.year, team: meet.team }
    return [
      { kind: 'results', path: alias.path, season, meet, athlete: alias.path },
      { kind: 'coach', path: `${alias.path}coach/`, season, meet, athlete: alias.path },
    ]
  })
}

/** Every page the build has to write a file for, and the router has to know. */
export const PAGES: Page[] = [
  { kind: 'help', path: HELP_PATH },
  ...SEASONS.flatMap((season): Page[] => {
    const meet = seasonMeets(season)[0] ?? null
    const athlete = seasonPath(season)
    return [
      { kind: 'results', path: athlete, season, meet, athlete },
      { kind: 'coach', path: seasonCoachPath(season), season, meet, athlete },
    ]
  }),
  ...handedOutPages(),
]

/** Both ends trimmed, so every comparison below is between bare segments. */
function bare(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

/**
 * Which page a pathname asks for, if any.
 *
 * Whole segments, so the coach page is never read as the athlete page despite
 * sitting underneath it, and a trailing slash is optional because Pages will
 * redirect one form to the other and a person typing a URL will leave it off.
 */
export function pageAt(pathname: string, base: string): Page | null {
  const here = bare(pathname)
  const root = bare(base)
  let rest = here
  if (root !== '') {
    if (here === root) return null
    if (!here.startsWith(`${root}/`)) return null
    rest = here.slice(root.length + 1)
  }
  return PAGES.find((page) => bare(page.path) === rest) ?? null
}

/** The full address of a page, for a link that gets texted. */
export function pageLink(origin: string, base: string, path: string): string {
  return `${origin}${base}${path}`
}
