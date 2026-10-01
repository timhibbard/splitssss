// Explicit extensions: see the note in link.ts.
import { type Marker, type Meet, meetRows, notRunYet, type Row } from './meet.ts'
import { HANDED_OUT, type Published, type ResultsPage, type Season, seasonMeets, seasonPath } from './pages.ts'

/**
 * One published meet of a season and its file, which is `undefined` while it is
 * still being looked for and `null` if this build does not have it.
 */
export type SeasonMeet = { published: Published; meet: Meet | null | undefined }

/** The season's meets, newest first, each with whatever has loaded for it so far. */
export function seasonFiles(
  season: Season,
  loaded: (published: Published) => Meet | null | undefined,
): SeasonMeet[] {
  return seasonMeets(season).map((published) => ({ published, meet: loaded(published) }))
}

/** Whether a meet in the list is the same published meet, compared by what makes it one. */
export function sameMeet(a: Published, b: Published): boolean {
  return a.year === b.year && a.team === b.team && a.slug === b.slug
}

/**
 * Every runner who raced at any loaded meet this season, once each, in the order
 * the picker lists them. Joined by label, which is what a runner is from one file
 * to the next.
 */
export function seasonLabels(meets: SeasonMeet[]): string[] {
  const labels = new Set<string>()
  for (const { meet } of meets) {
    for (const event of meet?.events ?? []) {
      for (const runner of event.runners) labels.add(runner.label)
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b))
}

/** The meets this runner raced, newest first. A meet she was not at is not hers to pick. */
export function racesOf(label: string, meets: SeasonMeet[]): SeasonMeet[] {
  return meets.filter(({ meet }) =>
    meet?.events.some((event) => event.runners.some((runner) => runner.label === label)),
  )
}

/**
 * Whether this is one of the meet addresses that was texted out, as opposed to a
 * season. A handed-out address is about its meet, so it opens there.
 */
export function isHandedOut(page: ResultsPage): boolean {
  return HANDED_OUT.some((alias) => alias.path === page.athlete)
}

/**
 * Which of a runner's races to show first: the meet a handed-out address was
 * about, if she ran it, and otherwise her most recent. `null` if she ran none.
 */
export function firstRace(page: ResultsPage, races: SeasonMeet[]): SeasonMeet | null {
  if (isHandedOut(page) && page.meet) {
    const named = races.find((r) => sameMeet(r.published, page.meet as Published))
    if (named) return named
  }
  return races[0] ?? null
}

/**
 * The address the coach page texts, for the meet it is showing. The handed-out
 * address when that is the meet it was about, so a link sent from there keeps
 * meaning that race; the season otherwise, which opens each runner on her most
 * recent race — the one just picked, on the day it is sent.
 */
export function shareAddress(page: ResultsPage, showing: Published): string {
  return page.meet && sameMeet(page.meet, showing) ? page.athlete : seasonPath(page.season)
}

/** One race of one runner's season: the meet, and her row in it. */
export type SeasonRace = { published: Published; row: Row }

/**
 * Every race this runner ran this season, newest first, each as the row the race
 * table has for her. A meet she ran twice, varsity and JV, is two races. One not
 * run yet is not a race to compare, only a plan.
 */
export function seasonRows(label: string, meets: SeasonMeet[]): SeasonRace[] {
  return racesOf(label, meets).flatMap(({ published, meet }) =>
    meetRows(meet!).flatMap((e) =>
      e.rows.filter((r) => r.observed.label === label && !notRunYet(r)).map((row) => ({ published, row })),
    ),
  )
}

/**
 * Every mark any of these races was timed at, once each and in course order, so
 * the same mark from two meets sits in one column. Matched by label, which is the
 * distance as the meet file wrote it.
 */
export function seasonMarks(races: SeasonRace[]): Marker[] {
  const marks = new Map<string, Marker>()
  for (const { row } of races) {
    for (const m of row.event.markers) if (!marks.has(m.label)) marks.set(m.label, m)
  }
  return [...marks.values()].sort((a, b) => a.meters - b.meters)
}

/** Where a mark sits in this race's own markers, or -1 for a mark this meet did not time. */
export function markIndex(row: Row, mark: Marker): number {
  return row.event.markers.findIndex((m) => m.label === mark.label)
}
