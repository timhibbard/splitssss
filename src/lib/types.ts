/** A moment, captured two ways. See DESIGN.md for why both are needed. */
export type Stamp = {
  /** Time of day in epoch ms. Comparable across devices, vulnerable to NTP correction. */
  wallMs: number
  /** Monotonic time in epoch-like ms. Immune to clock correction, only comparable within a session. */
  monoMs: number
}

export type Tap = Stamp & {
  id: string
  /** 1-based crossing order at this station. This is the athlete's place. */
  seq: number
  /** Which page session captured this, so monotonic times are only compared within a frame. */
  sessionId: string
  /** Attached later, during the assign step. */
  athleteId?: string
  /** Free text for a volunteer who does not recognize the athlete. "tall kid, orange shoes" */
  note?: string
}

/**
 * Where a volunteer is standing. Course markers are not always at whole miles,
 * so the distance is a real value rather than a choice from a fixed list.
 */
export type Station = {
  /** How a coach says it: "Mile 2", "2K", "1200m". */
  label: string
  /** Distance from the start in meters. Optional, but pace cannot be computed without it. */
  meters?: number
}

/**
 * Which of the two teams. Both coaches record with this app, so a phone holds
 * both lists and a race says which one it is. See DESIGN.md for why this is a
 * field on a runner rather than a second roster.
 */
export type Team = 'boys' | 'girls'

/**
 * Which of the two races a runner is in. Not a standing rank and not derived from
 * anything: the coach sets it per meet, so it arrives on the roster line the same
 * way the best time does. See DESIGN.md for why this is not read off PR order.
 */
export type Squad = 'varsity' | 'jv'

export type Athlete = {
  id: string
  name: string
  /**
   * Personal best in ms, at the race distance: a 5K best, since that is every
   * race this team runs. Optional, because a freshman's first meet has no best
   * to beat and a typed in name has nothing behind it at all.
   */
  pr?: number
  /**
   * Which team this runner is on. Optional, because a phone that has not yet
   * taken the two team list holds untagged runners, and an untagged runner
   * matches any race rather than disappearing out of every one.
   */
  team?: Team
  /**
   * Which race this runner is in this week. Optional: a list from before the
   * roster said falls back to the order it is in, and on a list that does say, a
   * runner with nothing here is on the team but in neither race, which is what an
   * injury or a missed bus looks like. Either way the picker is one tap away.
   */
  squad?: Squad
}

/** What the setup form collects. Everything else about a race is assigned on save. */
export type RaceDraft = {
  meet: string
  race: string
  station: Station
  timer: string
  /** Full race distance, for projecting a finish time from a split. */
  raceMeters: number
  /** Which team is racing, so the lineup and the grid show one team's names. */
  team?: Team
  /** The lineup: who out of the team list is in this race. */
  athletes: Athlete[]
}

export type Race = {
  id: string
  /** "GVSU Invite" */
  meet: string
  /** "JV Girls" */
  race: string
  station: Station
  /** Full race distance in meters. 5000 for a high school 5K. */
  raceMeters: number
  /**
   * Which team is racing. Absent on races recorded before the phone knew there
   * were two, which is why it is optional and why absent means no filtering.
   */
  team?: Team
  /** Who is holding the phone, so the coach knows whose export this is. */
  timer: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** Optional and correctable. Elapsed times are derived from this, not stored. */
  gun?: Stamp
  /** Set by the stop button. Freezes the running clock and closes the race. */
  stoppedAt?: Stamp
  /** Which session captured the gun, so its monotonic reading is only used with taps that share it. */
  gunSessionId?: string
  createdWallMs: number
  athletes: Athlete[]
}
