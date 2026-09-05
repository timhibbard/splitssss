import type { Athlete, Squad, Team } from './types'

/**
 * Who is in a race.
 *
 * The team list is everyone on the phone for the season, both teams. A race is
 * run by some of them: one team, split between the varsity race and the JV race,
 * and that split moves week to week. The race carries its own lineup so the
 * buttons on the capture screen are the runners actually out on the course.
 *
 * Which runner is in which race is a decision, not a computation. The coach makes
 * it before each meet and it arrives on the roster line, so nothing here works it
 * out from PR order. What is left of the order-based rules below is the fallback
 * for a list that says nothing, which is the boys' list and any phone still
 * holding one from before the roster carried races.
 */

/** How many run varsity. Team of seven scoring, so this is the number that moves. */
export const VARSITY_SIZE = 7

/**
 * Where a varsity race starts on a list that does not say, per team, because the
 * two lists are not the same kind of list.
 *
 * An untagged girls' list is the whole team, so varsity starts as the fastest
 * seven of it and JV gets the rest. The boys' list is the varsity squad and
 * nothing else, so varsity starts as all of them.
 *
 * `'all'` rather than the number nine on purpose: it records the reason, so a
 * tenth varsity boy does not need this line edited. Putting JV boys on the roster
 * is what makes this the wrong default, and that is the moment it should say
 * VARSITY_SIZE again — or, better, the moment the boys' list starts carrying a
 * race per runner the way the girls' does.
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
 * Reads a race out of a name: a race name, or the tag at the end of a roster
 * line. The same words in both places, so "JV Girls" the race and a runner
 * marked "JV" cannot disagree about which race they mean.
 *
 * JV is tested first because "Junior Varsity" contains the other word, and a JV
 * runner read as varsity is a runner on the wrong grid.
 *
 * Undefined for anything naming neither, which is what "Eye Opener Open" gets and
 * what an untagged roster line gets.
 */
export function sniffSquad(text: string): Squad | undefined {
  if (/\bjv\b|junior\s+varsity/i.test(text)) return 'jv'
  if (/varsity/i.test(text)) return 'varsity'
  return undefined
}

/**
 * Whether this list says who is in which race. One runner marked is enough: a
 * list is either the coach's assignment for this week or it is not, and a single
 * tag is the difference between reading the assignment and guessing at it.
 *
 * False for the boys, whose list is the varsity squad and carries no tags, and
 * for any phone holding a list from before roster lines carried a race.
 */
export function hasSquads(team: Athlete[]): boolean {
  return team.some((a) => a.squad != null)
}

/** The ids of everyone the list puts in one race, in team order. */
export function inSquad(team: Athlete[], squad: Squad): string[] {
  return team.filter((a) => a.squad === squad).map((a) => a.id)
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

/**
 * The top of the list, for a list that does not say who is in which race. It is
 * kept in the coach's order, so the top of it is the best guess available when
 * there is nothing to read.
 */
export function topOfList(team: Athlete[], size = VARSITY_SIZE): string[] {
  return team.slice(0, size).map((a) => a.id)
}

export function restOfList(team: Athlete[], size = VARSITY_SIZE): string[] {
  return team.slice(size).map((a) => a.id)
}

/**
 * Who this race starts with.
 *
 * On a list that says which race each runner is in, this is a reading and not a
 * guess: the varsity race gets the runners marked varsity and the JV race gets
 * the ones marked JV. Nobody is put in a race by being fast, and a runner the
 * list marks for neither race starts out of both.
 *
 * On a list that says nothing, the old rule stands: the top of the coach's order
 * for varsity and the rest for JV, sized by that team's varsity number, so a list
 * which *is* the varsity squad offers all of it. See varsitySize.
 *
 * A race whose name says neither offers everyone, which is what an open race or a
 * time trial gets.
 *
 * Either way a race that would come out empty offers everyone instead: an empty
 * lineup is a capture screen with no buttons on it, which is the one outcome with
 * nothing a volunteer can do about it. That is what a JV race for a squad with no
 * JV runners gets.
 *
 * A starting point in all cases. The picker is one tap away and the tap wins.
 */
export function defaultLineup(team: Athlete[], raceName: string, size = VARSITY_SIZE): string[] {
  const everyone = team.map((a) => a.id)
  const squad = sniffSquad(raceName)
  if (squad == null) return everyone
  if (hasSquads(team)) {
    const named = inSquad(team, squad)
    return named.length > 0 ? named : everyone
  }
  if (squad === 'jv') {
    const rest = restOfList(team, size)
    return rest.length > 0 ? rest : everyone
  }
  return topOfList(team, size)
}

export function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((held) => held !== id) : [...ids, id]
}

/** The chosen runners, in team order, so the grid does not follow tap order. */
export function lineupOf(team: Athlete[], ids: string[]): Athlete[] {
  const chosen = new Set(ids)
  return team.filter((a) => chosen.has(a.id))
}
