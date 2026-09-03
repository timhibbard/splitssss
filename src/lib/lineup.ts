import type { Athlete, Team } from './types'

/**
 * Who is in a race.
 *
 * The team list is everyone on the phone for the season, both teams. A race is
 * run by some of them: one team, seven in the varsity race, the rest in the JV
 * race, and that split moves week to week. The race carries its own lineup so
 * the buttons on the capture screen are the runners actually out on the course.
 */

/** How many run varsity. Team of seven scoring, so this is the number that moves. */
export const VARSITY_SIZE = 7

/**
 * Where a varsity race starts, per team, because the two lists are not the same
 * kind of list.
 *
 * The girls' list is the whole team, so varsity starts as the fastest seven of it
 * and JV gets the rest. The boys' list is the varsity squad and nothing else, so
 * varsity starts as all of them.
 *
 * `'all'` rather than the number nine on purpose: it records the reason, so a
 * tenth varsity boy does not need this line edited. Putting JV boys on the roster
 * is what makes this the wrong default, and that is the moment it should say
 * VARSITY_SIZE again.
 *
 * A starting point and nothing more. Every lineup is set by hand before the race
 * and remembered under the race name afterwards, so this only decides the first
 * time a race name is used.
 */
export const VARSITY_START: Record<Team, number | 'all'> = {
  girls: VARSITY_SIZE,
  boys: 'all',
}

/**
 * The varsity number for one team's list. `'all'` is resolved against the list
 * that was passed, so it is whoever is actually on the phone rather than a count
 * to keep in step with the roster.
 *
 * A phone still holding an untagged list gets the plain seven, since there is
 * nothing there to say which team the names belong to.
 */
export function varsitySize(team: Athlete[], which: Team | undefined): number {
  const rule = which == null ? VARSITY_SIZE : VARSITY_START[which]
  return rule === 'all' ? team.length : rule
}

/**
 * Reads a team out of a name: a race name, or a `#` header on the roster text.
 * The same two words in the same order, so "Varsity Boys" the race and
 * "# Boys" the header cannot disagree about which team they mean.
 *
 * Undefined for anything that names neither, which is what "Eye Opener Open"
 * gets, and what a caller reads as "no team, so no filtering".
 */
export function sniffTeam(text: string): Team | undefined {
  if (/\bboys?\b/i.test(text)) return 'boys'
  if (/\bgirls?\b/i.test(text)) return 'girls'
  return undefined
}

/**
 * The runners a race can draw from.
 *
 * An untagged runner matches every team on purpose. A phone that has not yet
 * taken the two team list holds nothing but untagged runners, and it has to keep
 * working exactly as it did: showing a volunteer an empty grid because their
 * copy of the list predates the boys team would be a worse answer than showing
 * them the names they have.
 */
export function forTeam(team: Athlete[], which: Team | undefined): Athlete[] {
  if (which == null) return team
  return team.filter((a) => a.team == null || a.team === which)
}

/** The team list is kept in the coach's order, so varsity is the top of it. */
export function topOfList(team: Athlete[], size = VARSITY_SIZE): string[] {
  return team.slice(0, size).map((a) => a.id)
}

export function restOfList(team: Athlete[], size = VARSITY_SIZE): string[] {
  return team.slice(size).map((a) => a.id)
}

function isJv(raceName: string): boolean {
  return /\bjv\b|junior varsity/i.test(raceName)
}

/**
 * A starting point, not a decision. Picking the varsity race offers the top of
 * the list and the JV race offers the rest, which is right often enough to save
 * fourteen taps and wrong often enough that the screen to change it is one tap
 * away.
 *
 * The size is that team's varsity number, so a list which *is* the varsity squad
 * offers all of it. See varsitySize.
 *
 * A team where "the rest" is nobody offers everyone instead: an empty lineup is a
 * capture screen with no buttons on it, which is the one outcome with nothing a
 * volunteer can do about it. That is what a JV race for a squad with no JV
 * runners on the list gets, and the picker is one tap away.
 */
export function defaultLineup(team: Athlete[], raceName: string, size = VARSITY_SIZE): string[] {
  const everyone = team.map((a) => a.id)
  if (isJv(raceName)) {
    const rest = restOfList(team, size)
    return rest.length > 0 ? rest : everyone
  }
  if (/varsity/i.test(raceName)) return topOfList(team, size)
  return everyone
}

export function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((held) => held !== id) : [...ids, id]
}

/** The chosen runners, in team order, so the grid does not follow tap order. */
export function lineupOf(team: Athlete[], ids: string[]): Athlete[] {
  const chosen = new Set(ids)
  return team.filter((a) => chosen.has(a.id))
}
