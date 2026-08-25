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

export type Athlete = {
  id: string
  name: string
}

/** What the setup form collects. Everything else about a race is assigned on save. */
export type RaceDraft = {
  meet: string
  race: string
  station: Station
  timer: string
  /** Full race distance, for projecting a finish time from a split. */
  raceMeters: number
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
