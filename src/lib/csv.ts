import {
  elapsedMs,
  formatDelta,
  formatElapsed,
  formatMinSec,
  formatPr,
  formatWallClock,
  isoStamp,
} from './clock'
import { pacePerMile, projectedFinish } from './distance'
import { prGap } from './splits'
import type { Race, Tap } from './types'

function cell(value: string | number | undefined): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS = [
  'date',
  'meet',
  'race',
  // Boys or girls, spelled out rather than left to the race name, so a coach
  // merging a dozen volunteer files can split them on a column instead of on
  // whatever each volunteer typed into "Other".
  'team',
  'station',
  'station_meters',
  'race_meters',
  'timer',
  'place',
  'athlete',
  'note',
  'clock_time',
  'iso_time',
  'elapsed_from_gun',
  'elapsed_seconds',
  'pace_per_mile',
  'projected_finish',
  'pr',
  'pr_seconds',
  'projected_vs_pr',
  'projected_vs_pr_seconds',
  'gun_iso',
  'session',
]

/**
 * Long format, one row per crossing. Self describing on purpose: the coach is
 * reassembling files from several volunteers, so every row has to carry its own
 * meet, race, station and timer.
 */
export function toCsv(race: Race, taps: Tap[]): string {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  const rows = taps.map((tap) => {
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const proj = ms == null ? undefined : projectedFinish(race.station.meters, race.raceMeters, ms)
    // The best time and the gap against it, so the file answers "was that a good
    // split for that runner" without the coach looking every PR up again. Printed
    // and in signed seconds both, because a column of "+0:12" cannot be sorted.
    const gap = prGap(proj, athlete?.pr, race.raceMeters)
    return [
      race.date,
      race.meet,
      race.race,
      race.team ?? '',
      race.station.label,
      race.station.meters ?? '',
      race.raceMeters,
      race.timer,
      tap.seq,
      athlete?.name ?? '',
      tap.note ?? '',
      formatWallClock(tap.wallMs),
      isoStamp(tap.wallMs),
      ms == null ? '' : formatElapsed(ms),
      ms == null ? '' : (ms / 1000).toFixed(1),
      ms == null || !race.station.meters ? '' : pacePerMile(race.station.meters, ms),
      proj == null ? '' : formatMinSec(proj),
      athlete?.pr == null ? '' : formatPr(athlete.pr),
      athlete?.pr == null ? '' : (athlete.pr / 1000).toFixed(2),
      gap == null ? '' : formatDelta(gap),
      gap == null ? '' : (gap / 1000).toFixed(1),
      race.gun ? isoStamp(race.gun.wallMs) : '',
      tap.sessionId,
    ]
      .map(cell)
      .join(',')
  })
  return [COLUMNS.join(','), ...rows].join('\n')
}

/**
 * Goes in the body of the text message. Has to stay legible after being pasted
 * into Messages, so no alignment tricks that depend on a monospace font.
 */
export function toTextSummary(race: Race, taps: Tap[]): string {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  let anyGap = false

  const body = taps.map((tap) => {
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const who = athlete?.name ?? tap.note ?? 'unassigned'
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const time = ms == null ? formatWallClock(tap.wallMs) : formatElapsed(ms)
    const proj = ms == null ? undefined : projectedFinish(race.station.meters, race.raceMeters, ms)
    const gap = prGap(proj, athlete?.pr, race.raceMeters)
    if (gap != null) anyGap = true
    return `${tap.seq}. ${time}  ${who}${gap == null ? '' : `  ${formatDelta(gap)}`}`
  })

  const lines = [
    `${race.meet} ${race.date}`,
    `${race.race} at ${race.station.label}`,
    race.timer ? `Timed by ${race.timer}` : '',
    race.gun ? `Gun ${formatWallClock(race.gun.wallMs)}` : 'No gun time recorded',
    `${taps.length} crossings`,
    // Only when there is one to read. A legend for a column that is not there is
    // one more line of a text message nobody asked for.
    anyGap ? "Last number is this pace against that runner's 5K best" : '',
    '',
  ].filter(Boolean)

  return [...lines, ...body].join('\n')
}

export function csvFilename(race: Race): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${race.date}-${slug(race.race)}-${slug(race.station.label)}.csv`
}
