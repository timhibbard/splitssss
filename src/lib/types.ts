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

export type Athlete = {
  id: string
  name: string
  bib?: string
}

export type Race = {
  id: string
  /** "GVSU Invite" */
  meet: string
  /** "JV Boys" */
  race: string
  /** "Mile 2" */
  station: string
  /** Who is holding the phone, so the coach knows whose export this is. */
  timer: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** Optional and correctable. Elapsed times are derived from this, not stored. */
  gun?: Stamp
  /** Which session captured the gun, so its monotonic reading is only used with taps that share it. */
  gunSessionId?: string
  createdWallMs: number
  athletes: Athlete[]
}
