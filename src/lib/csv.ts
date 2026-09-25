// Explicit extensions: see the note in link.ts.
import {
  elapsedMs,
  formatDelta,
  formatElapsed,
  formatMinSec,
  formatPr,
  formatWallClock,
  isoStamp,
} from './clock.ts'
import { pacePerMile, projectedFinish } from './distance.ts'
import { legOf, placesOf, prGap, stationsOf } from './splits.ts'
import type { Race, Station, Tap } from './types.ts'

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
 * The crossings in the order a file lists them: by spot, first spot first, and
 * in crossing order at each. A race that never moved is just crossing order.
 */
function byStation(taps: Tap[]): Tap[] {
  return [...taps].sort((a, b) => legOf(a) - legOf(b) || a.seq - b.seq)
}

/** Where a crossing was taken. A spot past the end reads as the current one, as on screen. */
function stationOf(race: Race, tap: Tap): Station {
  return stationsOf(race)[legOf(tap)] ?? race.station
}

/**
 * Long format, one row per crossing. Self describing on purpose: the coach is
 * reassembling files from several volunteers, so every row has to carry its own
 * meet, race, station and timer.
 *
 * A split taker who moved has crossings at more than one spot, and a runner with
 * one at each. Still one row per crossing: each carries its own station and its
 * place there, so a runner's Mile 1 and Mile 2 are two rows the coach can pivot,
 * the same as two volunteers' files would be.
 */
export function toCsv(race: Race, taps: Tap[]): string {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  const places = placesOf(taps)
  const rows = byStation(taps).map((tap) => {
    const station = stationOf(race, tap)
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const proj = ms == null ? undefined : projectedFinish(station.meters, race.raceMeters, ms)
    // The PR and the gap against it, so the file answers "was that a good
    // split for that runner" without the coach looking every PR up again. Printed
    // and in signed seconds both, because a column of "+0:12" cannot be sorted.
    const gap = prGap(proj, athlete?.pr, race.raceMeters)
    return [
      race.date,
      race.meet,
      race.race,
      race.team ?? '',
      station.label,
      station.meters ?? '',
      race.raceMeters,
      race.timer,
      places.get(tap.id) ?? tap.seq,
      athlete?.name ?? '',
      tap.note ?? '',
      formatWallClock(tap.wallMs),
      isoStamp(tap.wallMs),
      ms == null ? '' : formatElapsed(ms),
      ms == null ? '' : (ms / 1000).toFixed(1),
      ms == null || !station.meters ? '' : pacePerMile(station.meters, ms),
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
  const places = placesOf(taps)
  const stations = stationsOf(race)
  let anyGap = false

  const line = (tap: Tap, station: Station) => {
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const who = athlete?.name ?? tap.note ?? 'unassigned'
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const time = ms == null ? formatWallClock(tap.wallMs) : formatElapsed(ms)
    const proj = ms == null ? undefined : projectedFinish(station.meters, race.raceMeters, ms)
    const gap = prGap(proj, athlete?.pr, race.raceMeters)
    if (gap != null) anyGap = true
    return `${places.get(tap.id) ?? tap.seq}. ${time}  ${who}${gap == null ? '' : `  ${formatDelta(gap)}`}`
  }

  // One section per spot, under its own name, once there is more than one. A
  // spot the phone moved on from with nothing tapped there has nothing to say.
  const sections = stations.map((station, leg) => ({
    station,
    taps: byStation(taps).filter((tap) => Math.min(legOf(tap), stations.length - 1) === leg),
  }))
  const moved = stations.length > 1
  const body = moved
    ? sections
        .filter((section) => section.taps.length > 0)
        .flatMap((section, i) => [
          ...(i > 0 ? [''] : []),
          `At ${section.station.label}, ${section.taps.length} crossing${section.taps.length === 1 ? '' : 's'}`,
          ...section.taps.map((tap) => line(tap, section.station)),
        ])
    : taps.map((tap) => line(tap, race.station))

  const lines = [
    `${race.meet} ${race.date}`,
    `${race.race} at ${stationNames(race, taps)}`,
    race.timer ? `Timed by ${race.timer}` : '',
    race.gun ? `Gun ${formatWallClock(race.gun.wallMs)}` : 'No gun time recorded',
    moved ? '' : `${taps.length} crossings`,
    // Only when there is one to read. A legend for a column that is not there is
    // one more line of a text message nobody asked for.
    anyGap ? "Last number is this pace against that runner's 5K PR" : '',
    '',
  ].filter(Boolean)

  return [...lines, ...body].join('\n')
}

/**
 * The spots this race has crossings at, in order. A spot moved on from with
 * nothing tapped there is left out; the one the phone is at always counts, so a
 * race with no crossings still says where it was.
 */
function usedStations(race: Race, taps: Tap[]): Station[] {
  const stations = stationsOf(race)
  const last = stations.length - 1
  return stations.filter(
    (_, leg) => leg === last || taps.some((tap) => Math.min(legOf(tap), last) === leg),
  )
}

/**
 * Those spots for a title: "Mile 1" for a race that never moved, "0.5 mi and
 * 2 mi" for one that did. Without the crossings to look at, every spot it stood at.
 */
export function stationNames(race: Race, taps?: Tap[]): string {
  const labels = (taps ? usedStations(race, taps) : stationsOf(race)).map((s) => s.label)
  return labels.length <= 2 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

/** Names every spot with crossings in it, so two files from one phone cannot look alike. */
export function csvFilename(race: Race, taps: Tap[] = []): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${race.date}-${slug(race.race)}-${usedStations(race, taps).map((s) => slug(s.label)).join('-')}.csv`
}
