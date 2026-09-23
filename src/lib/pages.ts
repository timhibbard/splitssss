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
 * The year is in a meet's address because a season is the unit a coach thinks in
 * and because the same invitational comes back every September. /meets/2026/ and
 * /meets/2027/ are different races with the same name, and neither one's link
 * quietly starts showing the other's splits.
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
}

/**
 * Newest first. Adding a meet is adding a line here and committing the `.dat`
 * that `npm run meet-file` wrote; the tool prints the line to add.
 */
export const PUBLISHED: Published[] = [
  { slug: 'yellow-jacket', year: 2026, team: 'girls', date: '2026-09-12', name: 'Yellow Jacket Invitational' },
]

/** What a page is, for the router. `meet` is set on the two results pages. */
export type Page =
  | { kind: 'help'; path: string }
  | { kind: 'results'; path: string; meet: Published }
  | { kind: 'coach'; path: string; meet: Published }

/**
 * Paths are relative to the app's base and end in a slash, because that is the
 * form the file on disk takes: `meets/2026/yellow-jacket/index.html` is what a
 * request for `meets/2026/yellow-jacket/` gets served. Pages redirects the
 * slashless form to it, and the router below accepts either.
 */
export const HELP_PATH = 'help/'

export function resultsPath(meet: Published): string {
  return `meets/${meet.year}/${meet.slug}/`
}

/**
 * The coach's table lives under the athlete page rather than beside it, because it
 * is the same meet seen in more detail. It is not secret — nothing here is — but it
 * is not the link that gets texted to a team either.
 */
export function coachPath(meet: Published): string {
  return `${resultsPath(meet)}coach/`
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

/** Every page the build has to write a file for, and the router has to know. */
export const PAGES: Page[] = [
  { kind: 'help', path: HELP_PATH },
  ...PUBLISHED.flatMap((meet): Page[] => [
    { kind: 'results', path: resultsPath(meet), meet },
    { kind: 'coach', path: coachPath(meet), meet },
  ]),
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
